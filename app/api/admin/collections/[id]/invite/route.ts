import { NextRequest, NextResponse } from 'next/server';
import { signInviteToken } from '@/lib/auth';

// Mint a 30-day invite link for a collection. Admin-only via middleware.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = await signInviteToken(params.id);
  const base = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
  return NextResponse.json({ url: `${base}/join/${token}` });
}
