'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function UserNavClient({ username }: { username: string | null }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  if (username) {
    return (
      <div className="inline-flex items-center gap-2">
        <Link
          href="/profile"
          className="text-[#666] text-xs font-light hover:text-[#888] transition-colors leading-none inline-flex items-center"
        >
          {username}
        </Link>
        <button
          onClick={handleLogout}
          className="text-[11px] font-normal tracking-[0.06em] uppercase text-[#666] bg-[#161616] rounded px-2.5 py-1 hover:text-[#888] hover:bg-[#1c1c1c] transition-colors leading-none inline-flex items-center"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <p className="text-[11px] font-light tracking-[0.04em] text-[#555] leading-none pb-[3px]">
      <Link href="/login" className="text-[#999] hover:text-[#bbb] transition-colors">sign in</Link>
      {' '}to like and collect photos
    </p>
  );
}
