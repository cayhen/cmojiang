import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { signUserToken } from '@/lib/auth';
import { userCookieOptions, USER_COOKIE_NAME } from '@/lib/session';
import { signupRatelimit, enforceRateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, signupRatelimit);
  if (limited) return limited;

  let body: { username?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { username, email, password } = body;

  if (!username?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  // Check username availability
  const { data: existingUsername } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', username.trim())
    .single();

  if (existingUsername) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  // Check email availability
  const { data: existingEmail } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .single();

  if (existingEmail) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .insert({ username: username.trim(), email: email.trim().toLowerCase(), password_hash })
    .select('id, username')
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }

  const token = await signUserToken(user.id, user.username);
  const opts = userCookieOptions();
  const res = NextResponse.json({ ok: true, username: user.username });
  res.cookies.set(USER_COOKIE_NAME, token, opts);
  return res;
}
