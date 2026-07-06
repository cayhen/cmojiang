import { NextRequest, NextResponse } from 'next/server';
import { verifyInviteToken, verifyUserToken, signToken } from '@/lib/auth';
import { sessionCookieOptions, USER_COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

// Invite link landing: exchanges a signed invite token for a gallery_session,
// so recipients skip the password form entirely.
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const invite = await verifyInviteToken(params.token);
  if (!invite) return NextResponse.redirect(new URL('/', req.url));

  const { data: collection } = await supabaseAdmin
    .from('collections')
    .select('id')
    .eq('id', invite.collectionId)
    .single();
  if (!collection) return NextResponse.redirect(new URL('/', req.url));

  // Record access for logged-in users so future visits skip the unlock page
  const userToken = req.cookies.get(USER_COOKIE_NAME)?.value;
  if (userToken) {
    const userSession = await verifyUserToken(userToken);
    if (userSession) {
      await supabaseAdmin
        .from('user_collection_access')
        .upsert(
          { user_id: userSession.userId, collection_id: invite.collectionId, accessed_at: new Date().toISOString() },
          { onConflict: 'user_id,collection_id' }
        );
    }
  }

  const token = await signToken(invite.collectionId);
  const opts = sessionCookieOptions();
  const res = NextResponse.redirect(new URL(`/c/${invite.collectionId}/gallery`, req.url));
  res.cookies.set(opts.name, token, opts);
  return res;
}
