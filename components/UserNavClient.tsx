'use client';

import Link from 'next/link';

export function UserNavClient({ username }: { username: string | null }) {
  if (username) {
    return (
      <Link
        href="/profile"
        aria-label="My profile"
        className="text-[#555] hover:text-[#888] transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-3.866 3.582-7 8-7s8 3.134 8 7" />
        </svg>
      </Link>
    );
  }

  return (
    <p className="text-[13px] font-light tracking-[0.04em] text-[#555] leading-none pb-[3px]">
      <Link href="/login" className="text-[#999] hover:text-[#bbb] transition-colors">sign in</Link>
      {' '}to like and collect photos
    </p>
  );
}
