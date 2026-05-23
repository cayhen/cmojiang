'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function UnlockForm({ collectionId }: { collectionId: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId, password }),
      });

      if (res.ok) {
        router.push(`/c/${collectionId}/gallery`);
        return;
      }

      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        className="w-full bg-[#161616] border border-[#1e1e1e] rounded px-3 py-2.5 text-[#888] text-sm placeholder:text-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a] font-light"
      />
      {error && <p className="text-red-500/70 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#161616] border border-[#1e1e1e] text-[#666] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#888] transition-colors disabled:opacity-50"
      >
        {loading ? 'Checking...' : 'Unlock'}
      </button>
    </form>
  );
}
