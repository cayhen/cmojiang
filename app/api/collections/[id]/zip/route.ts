// app/api/collections/[id]/zip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const payload = await verifyToken(token);
  if (!payload || payload.collectionId !== params.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const [{ data: collection }, { data: photos }] = await Promise.all([
    supabaseAdmin.from('collections').select('name').eq('id', params.id).single(),
    supabaseAdmin.from('photos').select('storage_path, filename').eq('collection_id', params.id),
  ]);

  if (!photos?.length) return new NextResponse('No photos', { status: 404 });

  const slug = (collection?.name ?? 'photos')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const signedPhotos = await Promise.all(
    photos.map(async p => {
      const { data } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrl(p.storage_path, 1800);
      return { url: data?.signedUrl ?? '', filename: p.filename };
    })
  );

  const passthrough = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(passthrough);
  archive.on('error', err => passthrough.destroy(err));

  (async () => {
    for (const { url, filename } of signedPhotos) {
      if (!url) continue;
      const res = await fetch(url);
      if (!res.body) continue;
      archive.append(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), { name: filename });
    }
    await archive.finalize();
  })().catch(err => passthrough.destroy(err));

  const stream = new ReadableStream({
    start(controller) {
      passthrough.on('data', chunk => controller.enqueue(chunk));
      passthrough.on('end', () => controller.close());
      passthrough.on('error', err => controller.error(err));
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${slug}.zip"`,
    },
  });
}
