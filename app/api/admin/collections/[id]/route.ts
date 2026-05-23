import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { name, password } = await req.json();
  const updates: Record<string, string> = {};

  if (name?.trim()) updates.name = name.trim();
  if (password) updates.password_hash = await bcrypt.hash(password, 12);

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
  // List and remove all files from storage first
  const { data: files } = await supabaseAdmin.storage
    .from('photos')
    .list(params.id);

  if (files?.length) {
    const paths = files.map(f => `${params.id}/${f.name}`);
    await supabaseAdmin.storage.from('photos').remove(paths);
  }

  const { error } = await supabaseAdmin
    .from('collections')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
