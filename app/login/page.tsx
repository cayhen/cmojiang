'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HomeLink } from '@/components/HomeLink';
import { FloatingPaths } from '@/components/ui/background-paths';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [oauthError, setOauthError] = useState(false);

  useEffect(() => {
    setOauthError(new URLSearchParams(window.location.search).get('error') === 'oauth');
  }, []);

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
    <main className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
      <div className="w-full max-w-xs">
        <div className="relative flex items-center mb-8">
          <HomeLink />
          <p className="absolute inset-x-0 text-[#666] text-xs tracking-widest uppercase text-center font-light pointer-events-none">Sign in</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            autoFocus
            className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#bbb] text-sm placeholder:text-[#666] focus:outline-none focus:border-[#2a2a2a] font-light"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#bbb] text-sm placeholder:text-[#666] focus:outline-none focus:border-[#2a2a2a] font-light"
          />
          {(error || oauthError) && (
            <p className="text-red-500/70 text-xs">{error || 'Google sign-in failed. Please try again.'}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#161616] border border-[#1a1a1a] text-[#888] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#bbb] transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Google auth — disabled until configured
        <div className="relative flex items-center my-4">
          <div className="flex-grow border-t border-[#1a1a1a]" />
          <span className="mx-3 text-[#444] text-xs">or</span>
          <div className="flex-grow border-t border-[#1a1a1a]" />
        </div>
        <a href="/api/auth/google" className="flex items-center justify-center gap-2 w-full bg-[#161616] border border-[#1a1a1a] text-[#888] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#bbb] transition-colors">
          Continue with Google
        </a>
        */}

        <p className="text-[#555] text-xs text-center mt-5">
          No account?{' '}
          <Link href="/signup" className="text-[#888] hover:text-[#aaa] transition-colors">Create one</Link>
        </p>
      </div>
    </main>
  );
}
