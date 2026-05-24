import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Called after client uploads directly to Supabase Storage via signed URL.
// Body: { uploads: [{ storagePath, filename }] }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { uploads } = await req.json() as {
    uploads: { storagePath: string; filename: string }[];
  };

  if (!uploads?.length) {
    return NextResponse.json({ error: 'No uploads provided' }, { status: 400 });
  }

  const results = await Promise.all(
    uploads.map(async ({ storagePath, filename }) => {
      const { error: dbError } = await supabaseAdmin
        .from('photos')
        .insert({ collection_id: params.id, storage_path: storagePath, filename });

      if (dbError) {
        await supabaseAdmin.storage.from('photos').remove([storagePath]);
        return { filename, error: dbError.message };
      }

      return { filename, ok: true };
    })
  );

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

  const { error: storageError } = await supabaseAdmin.storage.from('photos').remove([photo.storage_path]);
  if (storageError) return NextResponse.json({ error: 'Storage delete failed' }, { status: 500 });

  const { error: dbError } = await supabaseAdmin.from('photos').delete().eq('id', photoId);
  if (dbError) return NextResponse.json({ error: 'DB delete failed' }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
