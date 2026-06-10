import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { signAdminToken } from '@/lib/auth';
import { adminLoginRatelimit, enforceRateLimit } from '@/lib/ratelimit';

/** Constant-time string comparison. Returns false on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, adminLoginRatelimit);
  if (limited) return limited;

  let password: string | undefined;
  try {
    ({ password } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: 'Missing password' }, { status: 400 });
  }

  const expected = process.env.ADMIN_PASSWORD ?? '';
  if (!expected || !safeEqual(password, expected)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const token = await signAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  return res;
}
