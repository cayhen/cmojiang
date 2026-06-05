import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('collections')
    .select('id, name, created_at, photos(count)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { name, password, event_date } = await req.json();

  if (!name?.trim() || !password) {
    return NextResponse.json({ error: 'Name and password required' }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabaseAdmin
    .from('collections')
    .insert({ name: name.trim(), password_hash, password_plain: password, ...(event_date && { event_date }) })
    .select('id, name')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  revalidatePath('/admin/dashboard');
  return NextResponse.json(data, { status: 201 });
}
