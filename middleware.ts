import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('admin_session')?.value;
  const isValid = token ? await verifyAdminToken(token) : false;

  if (!isValid) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path+', '/api/admin/((?!login).+)'],
};