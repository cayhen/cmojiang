import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export async function signToken(collectionId: string): Promise<string> {
  return new SignJWT({ collectionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret());
}

export async function verifyToken(token: string): Promise<{ collectionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.collectionId !== 'string') return null;
    return { collectionId: payload.collectionId };
  } catch {
    return null;
  }
}

/**
 * Invite tokens let anyone with the link unlock a collection without typing
 * the password. Exchanged for a gallery_session at /join/[token].
 */
export async function signInviteToken(collectionId: string): Promise<string> {
  return new SignJWT({ collectionId, invite: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret());
}

export async function verifyInviteToken(token: string): Promise<{ collectionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.invite !== true || typeof payload.collectionId !== 'string') return null;
    return { collectionId: payload.collectionId };
  } catch {
    return null;
  }
}

/**
 * Admin is a property of an account, not a separate password: the user IDs
 * listed in ADMIN_USER_IDS (comma-separated) have it. Unset means no one does.
 */
export function isAdminUserId(userId: string): boolean {
  return (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
    .includes(userId);
}

/** The account behind a user_session token, if that account is an admin. */
export async function verifyAdminUser(token: string | undefined): Promise<{ userId: string; username: string } | null> {
  if (!token) return null;
  const user = await verifyUserToken(token);
  return user && isAdminUserId(user.userId) ? user : null;
}

export async function signUserToken(userId: string, username: string): Promise<string> {
  const s = new TextEncoder().encode(process.env.JWT_SECRET!);
  return new SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(s);
}

export async function verifyUserToken(token: string): Promise<{ userId: string; username: string } | null> {
  try {
    const s = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, s);
    if (typeof payload.userId !== 'string' || typeof payload.username !== 'string') return null;
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}
