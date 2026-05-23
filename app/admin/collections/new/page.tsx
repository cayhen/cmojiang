'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewCollectionPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/admin/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });

    if (res.ok) {
      router.push('/admin/dashboard');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to create');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/dashboard" className="text-[#3a3a3a] text-xs hover:text-[#555]">
          ← Back
        </Link>
        <p className="text-[#3a3a3a] text-xs tracking-widest uppercase font-light">New Collection</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Collection name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#888] text-sm placeholder:text-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a] font-light"
        />
        <input
          type="password"
          placeholder="Collection password"
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
          {loading ? 'Creating...' : 'Create Collection'}
        </button>
      </form>
    </main>
  );
}
