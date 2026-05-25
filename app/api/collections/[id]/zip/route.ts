// app/api/collections/[id]/zip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { getDownloadUrl } from '@/lib/r2';
import archiver from 'archiver';
import { PassThrough } from 'stream';

export const runtime = 'nodejs';
export const maxDuration = 60; // seconds — requires Vercel Pro for >10s, but set it anyway

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
    .replace(/^-|-$/g, '') || 'photos';

  // Fetch ALL photos in parallel (R2 first, Supabase fallback)
  const photoBuffers = await Promise.all(
    photos.map(async p => {
      // Try R2
      try {
        const url = await getDownloadUrl(p.storage_path, 1800);
        const res = await fetch(url);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          return { filename: p.filename, buf };
        }
      } catch { /* fall through */ }

      // Supabase fallback
      try {
        const { data } = await supabaseAdmin.storage.from('photos').download(p.storage_path);
        if (data) {
          const buf = Buffer.from(await data.arrayBuffer());
          return { filename: p.filename, buf };
        }
      } catch { /* skip */ }

      return null;
    })
  );

  const validPhotos = photoBuffers.filter(p => p !== null) as { filename: string; buf: Buffer }[];
  if (!validPhotos.length) return new NextResponse('No photos available', { status: 404 });

  // Build zip from buffered data
  const passthrough = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 1 } }); // level 1 = fast, images don't compress much anyway
  archive.pipe(passthrough);
  archive.on('error', err => passthrough.destroy(err));

  for (const { filename, buf } of validPhotos) {
    archive.append(buf, { name: filename });
  }
  archive.finalize().catch(err => passthrough.destroy(err));

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
