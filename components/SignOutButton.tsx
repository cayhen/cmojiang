'use client';

export function SignOutButton() {
  async function handleSignOut() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-[11px] font-normal tracking-[0.06em] uppercase text-[#888] hover:text-[#bbb] transition-colors"
    >
      Sign out
    </button>
  );
}
