import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminUserId, verifyUserToken } from '@/lib/auth';

// Admin rides on the signed-in account (ADMIN_USER_IDS); there is no separate admin login.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get('user_session')?.value;
  const user = token ? await verifyUserToken(token) : null;
  if (user && isAdminUserId(user.userId)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Signed out: sign in first. Signed in without admin rights: back home.
  return NextResponse.redirect(new URL(user ? '/' : '/login', req.url));
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
