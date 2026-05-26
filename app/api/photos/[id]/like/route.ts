import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyUserToken } from '@/lib/auth';
import { USER_COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const userToken = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!userToken) return NextResponse.json({ error: 'Sign in to like photos' }, { status: 401 });

  const userSession = await verifyUserToken(userToken);
  if (!userSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: existing } = await supabaseAdmin
    .from('photo_likes')
    .select('id')
    .eq('user_id', userSession.userId)
    .eq('photo_id', params.id)
    .single();

  if (existing) {
    await supabaseAdmin
      .from('photo_likes')
      .delete()
      .eq('user_id', userSession.userId)
      .eq('photo_id', params.id);
    return NextResponse.json({ liked: false });
  } else {
    await supabaseAdmin
      .from('photo_likes')
      .insert({ user_id: userSession.userId, photo_id: params.id });
    return NextResponse.json({ liked: true });
  }
}
