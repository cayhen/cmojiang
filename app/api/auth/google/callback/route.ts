import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { signUserToken } from '@/lib/auth';
import { userCookieOptions, USER_COOKIE_NAME } from '@/lib/session';

async function deriveUsername(name: string): Promise<string> {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'user';

  const { data } = await supabaseAdmin.from('users').select('username').eq('username', base).single();
  if (!data) return base;

  for (let i = 0; i < 10; i++) {
    const candidate = `${base}${Math.floor(Math.random() * 9000) + 1000}`;
    const { data: taken } = await supabaseAdmin.from('users').select('username').eq('username', candidate).single();
    if (!taken) return candidate;
  }

  return `${base}${Date.now()}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = req.cookies.get('oauth_state')?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL('/login?error=oauth', req.url));
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/login?error=oauth', req.url));
  }

  const { access_token } = await tokenRes.json() as { access_token: string };

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userInfoRes.ok) {
    return NextResponse.redirect(new URL('/login?error=oauth', req.url));
  }

  const googleUser = await userInfoRes.json() as { email?: string; name?: string; given_name?: string };
  const email = googleUser.email?.toLowerCase();
  const name = googleUser.name ?? googleUser.given_name ?? 'user';

  if (!email) {
    return NextResponse.redirect(new URL('/login?error=oauth', req.url));
  }

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id, username')
    .eq('email', email)
    .single();

  let userId: string;
  let username: string;

  if (existingUser) {
    userId = existingUser.id;
    username = existingUser.username;
  } else {
    const derivedUsername = await deriveUsername(name);
    const password_hash = await bcrypt.hash(randomUUID(), 10);

    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({ username: derivedUsername, email, password_hash })
      .select('id, username')
      .single();

    if (error || !newUser) {
      return NextResponse.redirect(new URL('/login?error=oauth', req.url));
    }

    userId = newUser.id;
    username = newUser.username;
  }

  const token = await signUserToken(userId, username);
  const opts = userCookieOptions();
  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set(USER_COOKIE_NAME, token, opts);
  res.cookies.delete('oauth_state');
  return res;
}
