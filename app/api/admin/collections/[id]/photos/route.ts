import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { deleteObject, thumbPath } from '@/lib/r2';
import { galleryPhotosKey, invalidate } from '@/lib/redis';

// Called after client uploads directly to R2 via presigned PUT URL.
// Body: { uploads: [{ storagePath, filename }] }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { uploads } = await req.json() as {
    uploads: { storagePath: string; filename: string; width?: number; height?: number; dominantColor?: string }[];
  };

  if (!uploads?.length) {
    return NextResponse.json({ error: 'No uploads provided' }, { status: 400 });
  }

  const results = await Promise.all(
    uploads.map(async ({ storagePath, filename, width, height, dominantColor }) => {
      const { error: dbError } = await supabaseAdmin
        .from('photos')
        .insert({
          collection_id: params.id,
          storage_path: storagePath,
          filename,
          ...(width != null && { width }),
          ...(height != null && { height }),
          ...(dominantColor != null && { dominant_color: dominantColor }),
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { photoId } = await req.json();

  const { data: photo } = await supabaseAdmin
    .from('photos')
    .select('storage_path')
    .eq('id', photoId)
    .eq('collection_id', params.id)
    .single();

  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete the original and its thumbnail. R2 delete is idempotent, so a
  // missing thumbnail (legacy photos without one) is a harmless no-op.
  try {
    await Promise.all([
      deleteObject(photo.storage_path),
      deleteObject(thumbPath(photo.storage_path)),
    ]);
  } catch {
    return NextResponse.json({ error: 'Storage delete failed' }, { status: 500 });
  }

  const { error: dbError } = await supabaseAdmin.from('photos').delete().eq('id', photoId);
  if (dbError) return NextResponse.json({ error: 'DB delete failed' }, { status: 500 });

  await invalidate(galleryPhotosKey(params.id));
  return new NextResponse(null, { status: 204 });
}
