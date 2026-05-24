import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyUserToken } from '@/lib/auth';
import { USER_COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const userToken = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!userToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userSession = await verifyUserToken(userToken);
  if (!userSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the comment belongs to this user
  const { data: comment } = await supabaseAdmin
    .from('comments')
    .select('user_id')
    .eq('id', params.id)
    .single();

  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (comment.user_id !== userSession.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await supabaseAdmin.from('comments').delete().eq('id', params.id);

  return new NextResponse(null, { status: 204 });
}
