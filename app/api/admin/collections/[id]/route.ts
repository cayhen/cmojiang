import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { deleteObjects } from '@/lib/r2';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { name, password } = await req.json();
  const updates: Record<string, string> = {};

  if (name?.trim()) updates.name = name.trim();
  if (password) {
    updates.password_hash = await bcrypt.hash(password, 12);
    updates.password_plain = password;
  }

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

  // Delete all objects from R2
  if (photos?.length) {
    await deleteObjects(photos.map(p => p.storage_path));
  }

  const { error } = await supabaseAdmin
    .from('collections')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
