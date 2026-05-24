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
        <span className="text-[#3a3a3a] text-xs font-light">{username}</span>
        <button
          onClick={handleLogout}
          className="text-[#2a2a2a] text-xs hover:text-[#555] transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/login" className="text-[#3a3a3a] text-xs hover:text-[#555] transition-colors">
        Sign in
      </Link>
      <Link href="/signup" className="text-[#3a3a3a] text-xs hover:text-[#555] transition-colors">
        Create account
      </Link>
    </div>
  );
}
