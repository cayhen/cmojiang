import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload || payload.collectionId !== params.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: photos, error } = await supabaseAdmin
    .from('photos')
    .select('id, filename, storage_path')
    .eq('collection_id', params.id)
    .order('uploaded_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });

  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async photo => {
      const { data } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 3600);
      return { id: photo.id, filename: photo.filename, url: data?.signedUrl ?? '' };
    })
  );

  return NextResponse.json(photosWithUrls);
}
