import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { getDownloadUrl } from '@/lib/r2';
import { GalleryClient } from '@/components/GalleryClient';
import { UserNav } from '@/components/UserNav';
import Link from 'next/link';

export const revalidate = 0;

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

  const { data: photos } = await supabaseAdmin
    .from('photos')
    .select('id, filename, storage_path')
    .eq('collection_id', params.id)
    .order('uploaded_at', { ascending: true });

  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async photo => {
      const url = await getDownloadUrl(photo.storage_path, 3600);
      return { id: photo.id, filename: photo.filename, url };
    })
  );

  const userSession = await getUserSession();

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
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#666] text-xs hover:text-[#777] transition-colors">
            ← All
          </Link>
          <h1 className="text-[#bbb] font-light text-sm">{collection.name}</h1>
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
        />
      )}
    </main>
  );
}
