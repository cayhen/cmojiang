import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { signViewUrl, thumbPath } from '@/lib/r2';
import { ManageCollectionClient } from './ManageCollectionClient';

export const revalidate = 0;

export default async function ManageCollectionPage({ params }: { params: { id: string } }) {
  const [{ data: collection }, { data: photos }] = await Promise.all([
    supabaseAdmin.from('collections').select('id, name, password_plain, event_date, is_private').eq('id', params.id).single(),
    supabaseAdmin
      .from('photos')
      .select('id, filename, storage_path')
      .eq('collection_id', params.id)
      .order('uploaded_at', { ascending: true }),
  ]);

  if (!collection) notFound();

  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async photo => ({
      id: photo.id,
      filename: photo.filename,
      url: await signViewUrl(thumbPath(photo.storage_path)),
    }))
  );

  return (
    <ManageCollectionClient
      collection={collection}
      initialPhotos={photosWithUrls}
    />
  );
}
