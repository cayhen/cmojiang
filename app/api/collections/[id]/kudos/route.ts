import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyUserToken } from '@/lib/auth';
import { USER_COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const userToken = cookieStore.get(USER_COOKIE_NAME)?.value;
  const userSession = userToken ? await verifyUserToken(userToken) : null;

  const { count } = await supabaseAdmin
    .from('kudos')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', params.id);

  let hasKudos = false;
  if (userSession) {
    const { data } = await supabaseAdmin
      .from('kudos')
      .select('user_id')
      .eq('user_id', userSession.userId)
      .eq('collection_id', params.id)
      .single();
    hasKudos = !!data;
  }

  return NextResponse.json({ count: count ?? 0, hasKudos });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const userToken = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!userToken) return NextResponse.json({ error: 'Sign in to give kudos' }, { status: 401 });

  const userSession = await verifyUserToken(userToken);
  if (!userSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if already given kudos
  const { data: existing } = await supabaseAdmin
    .from('kudos')
    .select('user_id')
    .eq('user_id', userSession.userId)
    .eq('collection_id', params.id)
    .single();

  if (existing) {
    // Remove kudos
    await supabaseAdmin
      .from('kudos')
      .delete()
      .eq('user_id', userSession.userId)
      .eq('collection_id', params.id);
    return NextResponse.json({ hasKudos: false });
  } else {
    // Add kudos
    await supabaseAdmin
      .from('kudos')
      .insert({ user_id: userSession.userId, collection_id: params.id });
    return NextResponse.json({ hasKudos: true });
  }
}
