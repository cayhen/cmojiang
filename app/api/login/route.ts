import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { signUserToken } from '@/lib/auth';
import { userCookieOptions, USER_COOKIE_NAME } from '@/lib/session';

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { username, password } = body;

  if (!username?.trim() || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, username, password_hash')
    .eq('username', username.trim())
    .single();

  if (!user) {
    return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 });
  }

  const token = await signUserToken(user.id, user.username);
  const opts = userCookieOptions();
  const res = NextResponse.json({ ok: true, username: user.username });
  res.cookies.set(USER_COOKIE_NAME, token, opts);
  return res;
}
