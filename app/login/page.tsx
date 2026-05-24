'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push('/');
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to sign in');
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
        <p className="text-[#3a3a3a] text-xs tracking-widest uppercase mb-8 text-center font-light">Sign in</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoFocus
            className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#888] text-sm placeholder:text-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a] font-light"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#888] text-sm placeholder:text-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a] font-light"
          />
          {error && <p className="text-red-500/70 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#161616] border border-[#1a1a1a] text-[#666] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#888] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="text-[#3a3a3a] text-xs text-center mt-5">
          No account?{' '}
          <Link href="/signup" className="hover:text-[#555] transition-colors">Create one</Link>
        </p>
      </div>
    </main>
  );
}
