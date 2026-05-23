import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import path from 'path';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const formData = await req.formData();
  const files = formData.getAll('photos') as File[];

  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const results = await Promise.all(
    files.map(async file => {
      const photoId = randomUUID();
      const ext = path.extname(file.name).toLowerCase() || '.jpg';
      const storagePath = `${params.id}/${photoId}${ext}`;

      const buffer = await file.arrayBuffer();

      const { error: uploadError } = await supabaseAdmin.storage
        .from('photos')
        .upload(storagePath, buffer, { contentType: file.type });

      if (uploadError) return { filename: file.name, error: uploadError.message };

      const { error: dbError } = await supabaseAdmin
        .from('photos')
        .insert({ collection_id: params.id, storage_path: storagePath, filename: file.name });

      if (dbError) {
        await supabaseAdmin.storage.from('photos').remove([storagePath]);
        return { filename: file.name, error: dbError.message };
      }

      return { filename: file.name, ok: true };
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
