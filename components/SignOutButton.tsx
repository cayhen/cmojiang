'use client';

/** Sign-out row for grouped lists. */
export function SignOutButton() {
  async function handleSignOut() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <button type="button" onClick={handleSignOut} className="list-row justify-center text-destructive">
      Sign Out
    </button>
  );
}
