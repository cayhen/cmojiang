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
    return { collectionId: payload.collectionId as string };
  } catch {
    return null;
  }
}
