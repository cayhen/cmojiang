import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { MasonryGrid } from '@/components/MasonryGrid';
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
      const { data } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 3600);
      return { id: photo.id, filename: photo.filename, url: data?.signedUrl ?? '' };
    })
  );

  return (
    <main className="min-h-screen p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#3a3a3a] text-xs hover:text-[#555] transition-colors">
            ← All
          </Link>
          <h1 className="text-[#888] font-light text-sm">{collection.name}</h1>
        </div>
        <a
          href={`/api/collections/${params.id}/zip`}
          className="text-[#3a3a3a] text-xs hover:text-[#666] transition-colors"
        >
          Download all
        </a>
      </div>
      {photosWithUrls.length === 0 ? (
        <p className="text-[#3a3a3a] text-sm">No photos yet.</p>
      ) : (
        <MasonryGrid photos={photosWithUrls} />
      )}
    </main>
  );
}
