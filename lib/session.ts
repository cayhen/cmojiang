import 'server-only';
import { cookies } from 'next/headers';
import { isAdminUserId, verifyToken, verifyUserToken } from './auth';

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
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  };
}

export const USER_COOKIE_NAME = 'user_session';

export async function getUserSession(): Promise<{ userId: string; username: string } | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyUserToken(token);
}

/** The signed-in user if that account has admin rights (JWT and env only, no DB). */
export async function getAdminSession(): Promise<{ userId: string; username: string } | null> {
  const session = await getUserSession();
  return session && isAdminUserId(session.userId) ? session : null;
}

export function userCookieOptions() {
  return {
    name: USER_COOKIE_NAME,
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  };
}
