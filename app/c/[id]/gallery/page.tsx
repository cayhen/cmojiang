import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyToken, verifyAdminToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { signViewUrl, signDownloadUrl, thumbPath } from '@/lib/r2';
import { GalleryClient } from '@/components/GalleryClient';
import { AccountMenu } from '@/components/AccountMenu';
import { PageHeader } from '@/components/PageHeader';
import { AmbientGlow } from '@/components/AmbientGlow';
import { glowPalette } from '@/lib/glow';
import { cachedFetch, galleryPhotosKey } from '@/lib/redis';
import { fetchPhotosChronological, type PhotoRow } from '@/lib/photos';

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
    supabaseAdmin.from('collections').select('name, event_date').eq('id', params.id).single(),
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

  const eventDate = (collection as { event_date?: string | null }).event_date;
  const countLabel = `${photosWithUrls.length} ${photosWithUrls.length === 1 ? 'Photo' : 'Photos'}`;
  const subtitle = eventDate ? `${formatEventDate(eventDate)} · ${countLabel}` : countLabel;

  // Weighted toward the opening photos, which is what the header sits above.
  const glow = glowPalette(photosWithUrls.slice(0, 60).map(p => p.dominantColor));

  return (
    <main className="relative isolate min-h-screen bg-bg">
      <AmbientGlow colors={glow} />
      {photosWithUrls.slice(0, 8).map(p => (
        <link key={p.id} rel="preload" as="image" href={p.url} />
      ))}
      {signingError ? (
        <>
          <PageHeader width="wide" title={collection.name} back={{ href: '/', label: 'Collections' }} actions={<AccountMenu />} />
          <p className="mx-auto w-full px-4 text-subhead text-label2 sm:px-6 lg:px-8">
            Photos are temporarily unavailable. Please try again in a moment.
          </p>
        </>
      ) : (
        <GalleryClient
          collectionId={params.id}
          collectionName={collection.name}
          subtitle={subtitle}
          photos={photosWithUrls}
          kudosCount={kudosCount ?? 0}
          hasKudos={hasKudos}
          loggedIn={!!userSession}
          comments={comments}
          currentUsername={userSession?.username ?? null}
          likedPhotoIds={likedPhotoIds}
          accountMenu={<AccountMenu />}
        />
      )}
    </main>
  );
}

/** "2026-10-11" → "October 11, 2026" (date-only, no timezone shift). */
function formatEventDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-US', d ? { month: 'long', day: 'numeric', year: 'numeric' } : { month: 'long', year: 'numeric' });
}
