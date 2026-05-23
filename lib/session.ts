import 'server-only';
import { cookies } from 'next/headers';
import { verifyToken } from './auth';

export const COOKIE_NAME = 'gallery_session';

export async function getSessionCollectionId(): Promise<string | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.collectionId ?? null;
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  };
}
