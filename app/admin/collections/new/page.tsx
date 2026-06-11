'use client';

import { useState } from 'react';
import Link from 'next/link';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewCollectionPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [eventDate, setEventDate] = useState(today);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, event_date: eventDate }),
      });

      if (res.ok) {
        window.location.href = '/admin/dashboard';
      } else {
        const data = await res.json();
        setError(data.error ?? 'Failed to create');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/dashboard" className="text-[#666] text-xs hover:text-[#777]">
          ← Back
        </Link>
        <p className="text-[#666] text-xs tracking-widest uppercase font-light">New Collection</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Collection name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#bbb] text-sm placeholder:text-[#666] focus:outline-none focus:border-[#2a2a2a] font-light"
        />
        <input
          type="password"
          placeholder="Collection password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#bbb] text-sm placeholder:text-[#666] focus:outline-none focus:border-[#2a2a2a] font-light"
        />
        <div>
          <label className="text-[#555] text-xs uppercase tracking-widest block mb-1.5">Event date</label>
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            required
            className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#bbb] text-sm focus:outline-none focus:border-[#2a2a2a] font-light"
          />
        </div>
        {error && <p className="text-red-500/70 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#161616] border border-[#1a1a1a] text-[#888] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#bbb] transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Collection'}
        </button>
      </form>
    </main>
  );
}
