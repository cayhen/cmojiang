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

  const headers = {
    'Content-Disposition': `attachment; filename="${photo.filename}"`,
    'Cache-Control': 'private, max-age=300',
  };

  // Try R2 first, fall back to Supabase Storage for pre-migration photos
  try {
    const r2Url = await getDownloadUrl(photo.storage_path, 300);
    const r2Res = await fetch(r2Url);
    if (r2Res.ok && r2Res.body) {
      return new NextResponse(r2Res.body, {
        headers: { ...headers, 'Content-Type': r2Res.headers.get('Content-Type') ?? 'image/jpeg' },
      });
    }
  } catch {
    // Fall through to Supabase
  }

  // Supabase Storage fallback
  try {
    const { data: supaRes } = await supabaseAdmin.storage
      .from('photos')
      .download(photo.storage_path);
    if (supaRes) {
      const buffer = Buffer.from(await supaRes.arrayBuffer());
      return new NextResponse(buffer, {
        headers: { ...headers, 'Content-Type': supaRes.type || 'image/jpeg' },
      });
    }
  } catch {
    // Fall through
  }

  return new NextResponse('Photo unavailable', { status: 502 });
}
