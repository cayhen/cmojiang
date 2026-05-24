'use client';

import { useState } from 'react';

interface Props {
  collectionId: string;
  initialCount: number;
  initialHasKudos: boolean;
  loggedIn: boolean;
}

export function KudosButton({ collectionId, initialCount, initialHasKudos, loggedIn }: Props) {
  const [count, setCount] = useState(initialCount);
  const [hasKudos, setHasKudos] = useState(initialHasKudos);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      window.location.href = '/login';
      return;
    }
    if (loading) return;
    setLoading(true);

    // Optimistic update
    const newHasKudos = !hasKudos;
    setHasKudos(newHasKudos);
    setCount(c => newHasKudos ? c + 1 : c - 1);

    try {
      const res = await fetch(`/api/collections/${collectionId}/kudos`, { method: 'POST' });
      if (!res.ok) {
        // Revert on failure
        setHasKudos(hasKudos);
        setCount(c => newHasKudos ? c - 1 : c + 1);
      }
    } catch {
      // Revert on network error
      setHasKudos(hasKudos);
      setCount(c => newHasKudos ? c - 1 : c + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={hasKudos ? 'Remove kudos' : 'Give kudos'}
      className="flex items-center gap-1.5 text-[#666] hover:text-[#888] transition-colors disabled:opacity-50 group"
    >
      <span className={`text-base leading-none transition-colors ${hasKudos ? 'text-[#bbb]' : 'text-[#666] group-hover:text-[#888]'}`}>
        {hasKudos ? '♥' : '♡'}
      </span>
      <span className="text-xs font-light">{count}</span>
    </button>
  );
}
