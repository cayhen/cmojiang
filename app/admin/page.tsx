'use client';

import { useState } from 'react';
import { TopBar } from '@/components/PageHeader';
import { LockIcon, Spinner } from '@/components/icons';

export default function AdminSignIn() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Bumped on each rejected password so the shake replays every time.
  const [attempt, setAttempt] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = '/admin/dashboard';
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Incorrect password.');
        setAttempt(n => n + 1);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-grouped">
      <TopBar back={{ href: '/', label: 'Site' }} />

      <div className="flex flex-1 items-center justify-center px-4 pb-[calc(52px+env(safe-area-inset-top))]">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-fill text-label">
              <LockIcon size={26} />
            </div>
            <h1 className="mt-4 text-title1 text-label">Admin</h1>
            <p className="mt-1 text-footnote text-label2">Enter the admin password to manage collections.</p>
          </div>

          <div key={attempt} className={attempt > 0 ? 'animate-shake' : undefined}>
            <form onSubmit={handleSubmit} className="mt-8 space-y-3">
              <input
                type="password"
                placeholder="Password"
                aria-label="Password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'admin-error' : undefined}
                className="field"
              />
              {error && (
                <p id="admin-error" role="alert" className="px-1 text-footnote text-destructive">
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading} className="btn btn-filled w-full">
                {loading ? (
                  <>
                    <Spinner />
                    <span className="sr-only">Signing in…</span>
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
