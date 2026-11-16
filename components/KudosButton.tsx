'use client';

import { useState } from 'react';
import { HeartIcon } from './icons';

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
  const [pulse, setPulse] = useState(0);

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
    if (newHasKudos) setPulse(p => p + 1);

    try {
      const res = await fetch(`/api/collections/${collectionId}/kudos`, { method: 'POST' });
      if (!res.ok) throw new Error('Kudos failed');
    } catch {
      setHasKudos(hasKudos);
      setCount(c => newHasKudos ? c - 1 : c + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hasKudos}
      aria-label={hasKudos ? `Remove kudos (${count})` : count > 0 ? `Give kudos (${count})` : 'Give kudos'}
      title={loggedIn ? 'Kudos' : 'Sign in to give kudos'}
      className={`btn btn-sm btn-tinted gap-1.5 tabular-nums ${count > 0 ? 'px-3' : 'w-8 px-0'}`}
    >
      <span key={pulse} className={pulse ? 'animate-badge' : undefined}>
        <HeartIcon size={17} filled={hasKudos} className={`transition-colors duration-150 ${hasKudos ? 'text-heart' : 'text-label'}`} />
      </span>
      {count > 0 && count}
    </button>
  );
}
