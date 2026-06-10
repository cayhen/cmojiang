import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { deleteObjects, thumbPath } from '@/lib/r2';
import { galleryPhotosKey, invalidate } from '@/lib/redis';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { name, password, event_date } = await req.json();
  const updates: Record<string, string> = {};

  if (name?.trim()) updates.name = name.trim();
  if (password) {
    updates.password_hash = await bcrypt.hash(password, 12);
    updates.password_plain = password;
  }
  if (event_date) updates.event_date = event_date;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('collections')
    .update(updates)
    .eq('id', params.id)
    .select('id, name')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Fetch all storage_path values for this collection from DB
  const { data: photos } = await supabaseAdmin
    .from('photos')
    .select('storage_path')
    .eq('collection_id', params.id);

  // Delete all objects from R2 — originals and their thumbnails.
  if (photos?.length) {
    const originals = photos.map(p => p.storage_path);
    await deleteObjects([...originals, ...originals.map(thumbPath)]);
  }

  const { error } = await supabaseAdmin
    .from('collections')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });

  await invalidate(galleryPhotosKey(params.id));
  return new NextResponse(null, { status: 204 });
}
