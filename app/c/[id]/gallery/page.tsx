import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyToken, verifyAdminToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { signViewUrl, signDownloadUrl, thumbPath } from '@/lib/r2';
import { GalleryClient } from '@/components/GalleryClient';
import { UserNav } from '@/components/UserNav';
import { cachedFetch, galleryPhotosKey } from '@/lib/redis';
import { fetchPhotosChronological, type PhotoRow } from '@/lib/photos';
import { HomeLink } from '@/components/HomeLink';
import { MobileNav } from '@/components/MobileNav';

export default async function GalleryPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies();

  // Admin can view any gallery without a gallery_session
  const adminToken = cookieStore.get('admin_session')?.value;
  const isAdmin = adminToken ? await verifyAdminToken(adminToken) : false;

  if (!isAdmin) {
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) redirect(`/c/${params.id}`);
    const payload = await verifyToken(token);
    if (!payload || payload.collectionId !== params.id) {
      redirect(`/c/${params.id}`);
    }
  }

  // Collection-wide reads are independent — fetch them in one round trip.
  // The photo cache holds raw rows (not URLs) so we never cache an expiring
  // signed URL; URL generation happens below, outside the cache boundary.
  const [collectionRes, rawPhotos, kudosRes, commentsRes, userSession] = await Promise.all([
    supabaseAdmin.from('collections').select('name').eq('id', params.id).single(),
    cachedFetch<PhotoRow[]>(galleryPhotosKey(params.id), 300, () =>
      fetchPhotosChronological(params.id)
    ),
    supabaseAdmin.from('kudos').select('*', { count: 'exact', head: true }).eq('collection_id', params.id),
    supabaseAdmin
      .from('comments')
      .select('id, content, created_at, users(username)')
      .eq('collection_id', params.id)
      .order('created_at', { ascending: true }),
    getUserSession(),
  ]);

  const collection = collectionRes.data;
  if (!collection) notFound();

  const kudosCount = kudosRes.count;

  // Presigned URLs (24h) generated outside the row cache so we never cache an
  // expiring signature. Direct browser→R2 access; Vercel is not in the path.
  let photosWithUrls: {
    id: string; filename: string; url: string; originalUrl: string;
    downloadUrl: string; width?: number; height?: number; dominantColor?: string;
  }[] = [];
  let signingError = false;
  try {
    photosWithUrls = await Promise.all(
      rawPhotos.map(async photo => {
        const hasThumb = photo.width != null;
        const [originalUrl, thumbUrl, downloadUrl] = await Promise.all([
          signViewUrl(photo.storage_path),
          hasThumb ? signViewUrl(thumbPath(photo.storage_path)) : Promise.resolve(null),
          signDownloadUrl(photo.storage_path, photo.filename),
        ]);
        return {
          id: photo.id,
          filename: photo.filename,
          url: thumbUrl ?? originalUrl,
          originalUrl,
          downloadUrl,
          width: photo.width ?? undefined,
          height: photo.height ?? undefined,
          dominantColor: photo.dominant_color ?? undefined,
        };
      })
    );
  } catch {
    signingError = true;
  }

  // User-specific reads depend on userSession (and photo IDs) — second batch.
  let likedPhotoIds: string[] = [];
  let hasKudos = false;
  if (userSession) {
    const photoIds = photosWithUrls.map(p => p.id);
    const [likesRes, myKudosRes] = await Promise.all([
      photoIds.length > 0
        ? supabaseAdmin
            .from('photo_likes')
            .select('photo_id')
            .eq('user_id', userSession.userId)
            .in('photo_id', photoIds)
        : Promise.resolve({ data: [] as { photo_id: string }[] }),
      supabaseAdmin
        .from('kudos')
        .select('user_id')
        .eq('user_id', userSession.userId)
        .eq('collection_id', params.id)
        .maybeSingle(),
    ]);
    likedPhotoIds = (likesRes.data ?? []).map((l: { photo_id: string }) => l.photo_id);
    hasKudos = !!myKudosRes.data;
  }

  const comments = (commentsRes.data ?? []).map(c => ({
    id: c.id,
    content: c.content,
    created_at: c.created_at,
    username: (c.users as unknown as { username: string } | null)?.username ?? 'unknown',
  }));

  return (
    <main className="min-h-screen p-4 sm:p-6">
      {photosWithUrls.slice(0, 8).map(p => (
        <link key={p.id} rel="preload" as="image" href={p.url} />
      ))}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="md:hidden"><MobileNav /></div>
          <div className="hidden md:block"><HomeLink /></div>
          <div>
            <h1 className="text-[#bbb] font-light text-sm leading-tight">{collection.name}</h1>
            <p className="text-[#444] text-xs font-light leading-tight mt-0.5">{photosWithUrls.length} {photosWithUrls.length === 1 ? 'photo' : 'photos'}</p>
          </div>
        </div>
        <div className="hidden md:block"><UserNav /></div>
      </div>

      {signingError ? (
        <p className="text-[#666] text-sm">Photos are temporarily unavailable. Please try again in a moment.</p>
      ) : (
        <GalleryClient
          collectionId={params.id}
          collectionName={collection.name}
          photos={photosWithUrls}
          kudosCount={kudosCount ?? 0}
          hasKudos={hasKudos}
          loggedIn={!!userSession}
          comments={comments}
          currentUsername={userSession?.username ?? null}
          likedPhotoIds={likedPhotoIds}
        />
      )}
    </main>
  );
}
