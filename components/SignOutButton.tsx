'use client';

export function SignOutButton() {
  async function handleSignOut() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
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
