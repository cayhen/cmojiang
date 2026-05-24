import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export async function signToken(collectionId: string): Promise<string> {
  return new SignJWT({ collectionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
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

export async function signAdminToken(): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    return payload.admin === true;
  } catch {
    return false;
  }
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
