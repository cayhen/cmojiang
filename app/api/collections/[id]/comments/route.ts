import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, verifyUserToken } from '@/lib/auth';
import { COOKIE_NAME, USER_COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Verify gallery session (must have unlocked collection)
  const cookieStore = cookies();
  const galleryToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!galleryToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const galleryPayload = await verifyToken(galleryToken);
  if (!galleryPayload || galleryPayload.collectionId !== params.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: comments, error } = await supabaseAdmin
    .from('comments')
    .select('id, content, created_at, users(username)')
    .eq('collection_id', params.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });

  // Flatten the joined username
  const formatted = (comments ?? []).map(c => ({
    id: c.id,
    content: c.content,
    created_at: c.created_at,
    username: (c.users as unknown as { username: string } | null)?.username ?? 'unknown',
  }));

  return NextResponse.json(formatted);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();

  // Must be logged in
  const userToken = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!userToken) return NextResponse.json({ error: 'Sign in to comment' }, { status: 401 });
  const userSession = await verifyUserToken(userToken);
  if (!userSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Must have unlocked the collection
  const galleryToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!galleryToken) return NextResponse.json({ error: 'Unlock collection first' }, { status: 401 });
  const galleryPayload = await verifyToken(galleryToken);
  if (!galleryPayload || galleryPayload.collectionId !== params.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { content?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const content = body.content?.trim();
  if (!content) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });

  const { data: comment, error } = await supabaseAdmin
    .from('comments')
    .insert({ user_id: userSession.userId, collection_id: params.id, content })
    .select('id, content, created_at')
    .single();

  if (error || !comment) return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });

  return NextResponse.json({
    id: comment.id,
    content: comment.content,
    created_at: comment.created_at,
    username: userSession.username,
  }, { status: 201 });
}
