import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { deleteObject, deleteObjects, thumbPath } from '@/lib/r2';
import { galleryPhotosKey, invalidate } from '@/lib/redis';

// Called after client uploads directly to R2 via presigned PUT URL.
// Body: { uploads: [{ storagePath, filename }] }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { uploads } = await req.json() as {
    uploads: { storagePath: string; filename: string; width?: number; height?: number; dominantColor?: string; takenAt?: string }[];
  };

  if (!uploads?.length) {
    return NextResponse.json({ error: 'No uploads provided' }, { status: 400 });
  }

  const results = await Promise.all(
    uploads.map(async ({ storagePath, filename, width, height, dominantColor, takenAt }) => {
      const { error: dbError } = await supabaseAdmin
        .from('photos')
        .insert({
          collection_id: params.id,
          storage_path: storagePath,
          filename,
          ...(width != null && { width }),
          ...(height != null && { height }),
          ...(dominantColor != null && { dominant_color: dominantColor }),
          ...(takenAt != null && { taken_at: takenAt }),
        });

      if (dbError) {
        // Clean up the orphaned R2 object
        await deleteObject(storagePath).catch(() => {});
        return { filename, error: dbError.message };
      }

      return { filename, ok: true };
    })
  );

  await invalidate(galleryPhotosKey(params.id));
  return NextResponse.json(results, { status: 201 });
}

// Accepts { photoId } for a single delete or { photoIds } for bulk.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { photoId, photoIds } = await req.json() as { photoId?: string; photoIds?: string[] };
  const ids = photoIds ?? (photoId ? [photoId] : []);
  if (!ids.length) return NextResponse.json({ error: 'No photos specified' }, { status: 400 });

  const { data: photos } = await supabaseAdmin
    .from('photos')
    .select('id, storage_path')
    .in('id', ids)
    .eq('collection_id', params.id);

  if (!photos?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete originals and thumbnails. R2 delete is idempotent, so a missing
  // thumbnail (legacy photos without one) is a harmless no-op.
  try {
    const originals = photos.map(p => p.storage_path);
    await deleteObjects([...originals, ...originals.map(thumbPath)]);
  } catch {
    return NextResponse.json({ error: 'Storage delete failed' }, { status: 500 });
  }

  const { error: dbError } = await supabaseAdmin
    .from('photos')
    .delete()
    .in('id', photos.map(p => p.id));
  if (dbError) return NextResponse.json({ error: 'DB delete failed' }, { status: 500 });

  await invalidate(galleryPhotosKey(params.id));
  return new NextResponse(null, { status: 204 });
}
