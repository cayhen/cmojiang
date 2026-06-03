import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { publicPhotoUrl, thumbPath } from '@/lib/r2';
import { ManageCollectionClient } from './ManageCollectionClient';

export default async function ManageCollectionPage({ params }: { params: { id: string } }) {
  const [{ data: collection }, { data: photos, error: photosError }] = await Promise.all([
    supabaseAdmin.from('collections').select('id, name, password_plain, event_date').eq('id', params.id).single(),
    supabaseAdmin
      .from('photos')
      .select('id, filename, storage_path')
      .eq('collection_id', params.id)
      .order('uploaded_at', { ascending: true }),
  ]);
  console.log('[manage] photos count:', photos?.length, 'error:', photosError);

  if (!collection) notFound();

  const photosWithUrls = (photos ?? []).map(photo => ({
    id: photo.id,
    filename: photo.filename,
    url: publicPhotoUrl(thumbPath(photo.storage_path)),
    originalUrl: publicPhotoUrl(photo.storage_path),
  }));

  return (
    <ManageCollectionClient
      collection={collection}
      initialPhotos={photosWithUrls}
    />
  );
}
