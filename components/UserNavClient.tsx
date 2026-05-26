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
      <div className="flex items-center gap-3">
        <Link href="/profile" className="text-[#666] text-xs font-light hover:text-[#888] transition-colors">
          {username}
        </Link>
        <button
          onClick={handleLogout}
          className="text-[#555] text-xs hover:text-[#777] transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/login" className="text-[#666] text-xs hover:text-[#777] transition-colors">
        Sign in
      </Link>
      <Link href="/signup" className="text-[#666] text-xs hover:text-[#777] transition-colors">
        Create account
      </Link>
    </div>
  );
}
