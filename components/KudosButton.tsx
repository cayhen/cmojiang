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
  const [animating, setAnimating] = useState(false);

  async function toggle() {
    if (!loggedIn) {
      window.location.href = '/login';
      return;
    }
    if (loading) return;
    setLoading(true);

    const newHasKudos = !hasKudos;
    setHasKudos(newHasKudos);
    setCount(c => newHasKudos ? c + 1 : c - 1);

    if (newHasKudos) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 700);
    }

    try {
      const res = await fetch(`/api/collections/${collectionId}/kudos`, { method: 'POST' });
      if (!res.ok) {
        setHasKudos(hasKudos);
        setCount(c => newHasKudos ? c - 1 : c + 1);
      }
    } catch {
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
      className="relative flex items-center gap-1.5 text-[#666] hover:text-[#888] transition-colors disabled:opacity-50 group"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        className={`transition-colors duration-150 ${hasKudos ? 'fill-[#ff4d6d] stroke-[#ff4d6d]' : 'fill-none stroke-[#666] group-hover:stroke-[#888]'}`}>
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
      <span className="text-xs font-light">{count}</span>

      {animating && (
        <span aria-hidden className="absolute -top-4 left-0 pointer-events-none">
          <svg className="animate-heart-burst" width="32" height="32" viewBox="0 0 24 24" fill="#ff4d6d">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </span>
      )}
    </button>
  );
}
