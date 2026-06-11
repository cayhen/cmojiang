'use client';

import { useRouter } from 'next/navigation';

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-[11px] font-normal tracking-[0.06em] uppercase text-[#555] hover:text-[#888] transition-colors"
    >
      Sign out
    </button>
  );
}
