import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { signToken } from '@/lib/auth';
import { sessionCookieOptions } from '@/lib/session';

export async function POST(req: NextRequest) {
  let collectionId: string | undefined;
  let password: string | undefined;
  try {
    const body = await req.json() as { collectionId?: string; password?: string };
    collectionId = body.collectionId;
    password = body.password;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!collectionId || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { data: collection, error } = await supabaseAdmin
    .from('collections')
    .select('id, password_hash')
    .eq('id', collectionId)
    .single();

  if (error || !collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, collection.password_hash);

  if (!valid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const token = await signToken(collectionId);
  const opts = sessionCookieOptions();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(opts.name, token, opts);
  return res;
}
