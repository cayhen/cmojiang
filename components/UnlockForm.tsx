'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckIcon, LockIcon, Spinner } from './icons';

type Phase = 'idle' | 'checking' | 'unlocked';

export function UnlockForm({ collectionId, name }: { collectionId: string; name: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== 'idle') return;
    setPhase('checking');
    setError('');

    try {
      const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId, password }),
      });

      if (res.ok) {
        setPhase('unlocked');
        setTimeout(() => router.push(`/c/${collectionId}/gallery`), 450);
        return;
      }

      // A server crash returns an empty or HTML body, so don't assume JSON.
      const data: { error?: string } = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't unlock this collection. Please try again.");
      setAttempt(a => a + 1);
      setPhase('idle');
    } catch {
      setError('Network error. Check your connection and try again.');
      setPhase('idle');
    }
  }

  const unlocked = phase === 'unlocked';

  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-300 ${
          unlocked ? 'bg-label text-onlabel' : 'bg-fill text-label'
        }`}
      >
        {unlocked ? <CheckIcon size={28} className="animate-badge" /> : <LockIcon size={28} />}
      </span>
      <h1 className="text-title1">{name}</h1>

      <form key={attempt} onSubmit={handleSubmit} className={`mt-8 w-full space-y-3 ${attempt ? 'animate-shake' : ''}`}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
          required
          autoFocus
          autoComplete="current-password"
          aria-label="Collection password"
          aria-invalid={!!error}
          aria-describedby={error ? 'unlock-error' : undefined}
          className="field text-center"
        />
        <button type="submit" disabled={phase !== 'idle' || !password} className="btn btn-filled w-full">
          {phase === 'checking' ? <Spinner size={18} /> : unlocked ? 'Unlocked' : 'Unlock'}
        </button>
      </form>
      <p id="unlock-error" role="alert" className="mt-3 min-h-[18px] text-footnote text-destructive">{error}</p>
    </div>
  );
}
