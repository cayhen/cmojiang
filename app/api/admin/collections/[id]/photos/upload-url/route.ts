import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import path from 'path';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { files } = await req.json() as { files: { filename: string }[] };

  if (!files?.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const results = await Promise.all(
    files.map(async ({ filename }) => {
      const photoId = randomUUID();
      const ext = path.extname(filename).toLowerCase() || '.jpg';
      const storagePath = `${params.id}/${photoId}${ext}`;

      const { data, error } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUploadUrl(storagePath);

      if (error) return { filename, error: error.message };

      return { filename, storagePath, signedUrl: data.signedUrl };
    })
  );

  return NextResponse.json(results);
}
