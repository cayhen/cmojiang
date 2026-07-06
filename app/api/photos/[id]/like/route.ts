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
    const { error } = await supabaseAdmin
      .from('photo_likes')
      .delete()
      .eq('user_id', userSession.userId)
      .eq('photo_id', params.id);
    if (error) return NextResponse.json({ error: 'Failed to unlike' }, { status: 500 });
    return NextResponse.json({ liked: false });
  } else {
    const { error } = await supabaseAdmin
      .from('photo_likes')
      .insert({ user_id: userSession.userId, photo_id: params.id });
    if (error) {
      // Unique violation: a concurrent request (e.g. rapid double-tap) already
      // inserted this like — the desired state holds, so report success
      if (error.code === '23505') return NextResponse.json({ liked: true });
      return NextResponse.json({ error: 'Failed to like' }, { status: 500 });
    }
    return NextResponse.json({ liked: true });
  }
}
