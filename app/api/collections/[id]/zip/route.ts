// app/api/collections/[id]/zip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { getDownloadUrl } from '@/lib/r2';
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
      try {
        const url = await getDownloadUrl(p.storage_path, 1800);
        return { url, filename: p.filename, storagePath: p.storage_path };
      } catch {
        return { url: '', filename: p.filename, storagePath: p.storage_path };
      }
    })
  );

  const passthrough = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(passthrough);
  archive.on('error', err => passthrough.destroy(err));

  (async () => {
    for (const { url, filename, storagePath } of signedPhotos) {
      // Try R2 first
      let appended = false;
      if (url) {
        try {
          const res = await fetch(url);
          if (res.ok && res.body) {
            archive.append(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), { name: filename });
            appended = true;
          }
        } catch { /* fall through */ }
      }
      // Fall back to Supabase Storage for pre-migration photos
      if (!appended) {
        try {
          const { data } = await supabaseAdmin.storage.from('photos').download(storagePath);
          if (data) {
            const buf = Buffer.from(await data.arrayBuffer());
            archive.append(buf, { name: filename });
          }
        } catch { /* skip */ }
      }
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
