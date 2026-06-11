'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AdminSignIn() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <div className="relative flex items-center mb-8">
          <Link href="/" className="text-[#555] text-xs hover:text-[#777] transition-colors">← Home</Link>
          <p className="absolute inset-x-0 text-[#666] text-xs tracking-widest uppercase text-center font-light pointer-events-none">Admin</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoFocus
            className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#bbb] text-sm placeholder:text-[#666] focus:outline-none focus:border-[#2a2a2a] font-light"
          />
          {error && <p className="text-red-500/70 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#161616] border border-[#1a1a1a] text-[#888] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#bbb] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}
