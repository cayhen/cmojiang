import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { publicPhotoUrl, thumbPath } from '@/lib/r2';
import { GalleryClient } from '@/components/GalleryClient';
import { UserNav } from '@/components/UserNav';
import { cachedFetch } from '@/lib/redis';
import { HomeLink } from '@/components/HomeLink';

export const revalidate = 60;

export default async function GalleryPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) redirect(`/c/${params.id}`);

  const payload = await verifyToken(token);
  if (!payload || payload.collectionId !== params.id) {
    redirect(`/c/${params.id}`);
  }

  const { data: collection } = await supabaseAdmin
    .from('collections')
    .select('name')
    .eq('id', params.id)
    .single();

  if (!collection) notFound();

  const photosWithUrls = await cachedFetch(
    `gallery:${params.id}:photos`,
    300,
    async () => {
      const { data: photos } = await supabaseAdmin
        .from('photos')
        .select('id, filename, storage_path, width, height, dominant_color')
        .eq('collection_id', params.id)
        .order('uploaded_at', { ascending: true });

      return (photos ?? []).map(photo => {
        const hasThumb = photo.width != null;
        const originalUrl = publicPhotoUrl(photo.storage_path);
        return {
          id: photo.id,
          filename: photo.filename,
          url: hasThumb ? publicPhotoUrl(thumbPath(photo.storage_path)) : originalUrl,
          originalUrl,
          width: photo.width ?? undefined,
          height: photo.height ?? undefined,
          dominantColor: photo.dominant_color ?? undefined,
        };
      });
    }
  );

  const userSession = await getUserSession();

  let likedPhotoIds: string[] = [];
  if (userSession && photosWithUrls.length > 0) {
    const { data: likes } = await supabaseAdmin
      .from('photo_likes')
      .select('photo_id')
      .eq('user_id', userSession.userId)
      .in('photo_id', photosWithUrls.map(p => p.id));
    likedPhotoIds = (likes ?? []).map((l: { photo_id: string }) => l.photo_id);
  }

  const { count: kudosCount } = await supabaseAdmin
    .from('kudos')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', params.id);

  let hasKudos = false;
  if (userSession) {
    const { data: myKudos } = await supabaseAdmin
      .from('kudos')
      .select('user_id')
      .eq('user_id', userSession.userId)
      .eq('collection_id', params.id)
      .single();
    hasKudos = !!myKudos;
  }

  const { data: commentsRaw } = await supabaseAdmin
    .from('comments')
    .select('id, content, created_at, users(username)')
    .eq('collection_id', params.id)
    .order('created_at', { ascending: true });

  const comments = (commentsRaw ?? []).map(c => ({
    id: c.id,
    content: c.content,
    created_at: c.created_at,
    username: (c.users as unknown as { username: string } | null)?.username ?? 'unknown',
  }));

  return (
    <main className="min-h-screen p-6">
      {photosWithUrls.slice(0, 8).map(p => (
        <link key={p.id} rel="preload" as="image" href={p.url} />
      ))}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <HomeLink />
          <div>
            <h1 className="text-[#bbb] font-light text-sm leading-tight">{collection.name}</h1>
            <p className="text-[#444] text-xs font-light leading-tight mt-0.5">{photosWithUrls.length} {photosWithUrls.length === 1 ? 'photo' : 'photos'}</p>
          </div>
        </div>
        <UserNav />
      </div>

      {photosWithUrls.length === 0 ? (
        <p className="text-[#666] text-sm">No photos yet.</p>
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
