import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyUserToken, signToken } from '@/lib/auth';
import { USER_COOKIE_NAME, sessionCookieOptions, COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.redirect(new URL('/', req.url));

  const cookieStore = cookies();
  const userToken = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!userToken) return NextResponse.redirect(new URL(`/c/${id}`, req.url));

  const userSession = await verifyUserToken(userToken);
  if (!userSession) return NextResponse.redirect(new URL(`/c/${id}`, req.url));

  const { data: access } = await supabaseAdmin
    .from('user_collection_access')
    .select('user_id')
    .eq('user_id', userSession.userId)
    .eq('collection_id', id)
    .single();

  if (!access) return NextResponse.redirect(new URL(`/c/${id}`, req.url));

  const token = await signToken(id);
  const opts = sessionCookieOptions();
  const res = NextResponse.redirect(new URL(`/c/${id}/gallery`, req.url));
  res.cookies.set(COOKIE_NAME, token, opts);
  return res;
}
