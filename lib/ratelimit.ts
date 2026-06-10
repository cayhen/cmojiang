import { Ratelimit } from '@upstash/ratelimit';
import { NextResponse, type NextRequest } from 'next/server';
import { redis } from '@/lib/redis';

type Window = Parameters<typeof Ratelimit.slidingWindow>[1];

function make(prefix: string, limit: number, window: Window): Ratelimit | null {
  return redis
    ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, window), prefix })
    : null;
}

/** Collection unlock — also exported as `ratelimit` for backward compatibility. */
export const ratelimit = make('ratelimit:unlock', 10, '15 m');
export const loginRatelimit = make('ratelimit:login', 10, '15 m');
export const signupRatelimit = make('ratelimit:signup', 5, '60 m');
export const adminLoginRatelimit = make('ratelimit:admin-login', 5, '15 m');

/** Extract the client IP from the first entry of x-forwarded-for. */
export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
}

/**
 * Enforce a rate limit for the given limiter, keyed by client IP.
 * Returns a 429 response if the limit is exceeded, otherwise null.
 * Fails open when no limiter is configured (Redis env vars absent).
 */
export async function enforceRateLimit(
  req: NextRequest,
  limiter: Ratelimit | null
): Promise<NextResponse | null> {
  if (!limiter) return null;
  const { success } = await limiter.limit(getClientIp(req));
  if (!success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': '900' } }
    );
  }
  return null;
}
