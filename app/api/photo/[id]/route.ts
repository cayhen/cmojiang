import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { getDownloadUrl } from '@/lib/r2';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Verify gallery session
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  // Look up photo
  const { data: photo } = await supabaseAdmin
    .from('photos')
    .select('filename, storage_path, collection_id')
    .eq('id', params.id)
    .single();

  if (!photo) return new NextResponse('Not found', { status: 404 });

  // Verify token is for this photo's collection
  const payload = await verifyToken(token);
  if (!payload || payload.collectionId !== photo.collection_id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Fetch from R2 and stream to browser with download headers
  const url = await getDownloadUrl(photo.storage_path, 300);
  const r2Res = await fetch(url);

  if (!r2Res.ok || !r2Res.body) {
    return new NextResponse('Photo unavailable', { status: 502 });
  }

  return new NextResponse(r2Res.body, {
    headers: {
      'Content-Type': r2Res.headers.get('Content-Type') ?? 'image/jpeg',
      'Content-Disposition': `attachment; filename="${photo.filename}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
