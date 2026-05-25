'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'idle' | 'unlocking' | 'open' | 'done';

function LockIcon({ open, fading }: { open: boolean; fading: boolean }) {
  return (
    <div className={`transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[#bbb]"
      >
        {/* Lock body — always visible */}
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />

        {/* Shackle — pops straight up when open */}
        <path
          d="M7 11V7a5 5 0 0 1 10 0v4"
          className="transition-all duration-500 ease-out"
          style={{
            transformOrigin: '12px 11px',
            transform: open ? 'translateY(-4px)' : 'translateY(0)',
            opacity: 1,
          }}
        />
      </svg>
    </div>
  );
}

export function UnlockForm({ collectionId }: { collectionId: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
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
        setPhase('unlocking');
        setTimeout(() => setPhase('open'), 350);
        setTimeout(() => setPhase('done'), 950);
        setTimeout(() => router.push(`/c/${collectionId}/gallery`), 1250);
        return;
      }

      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Unlock animation overlay */}
      {phase !== 'idle' && (
        <div className={`fixed inset-0 bg-[#0f0f0f] z-50 flex flex-col items-center justify-center gap-4 transition-opacity duration-300 ${phase === 'done' ? 'opacity-0' : 'opacity-100'}`}>
          <LockIcon open={phase === 'open' || phase === 'done'} fading={phase === 'done'} />
          <p className={`text-[#555] text-xs tracking-widest font-light transition-opacity duration-300 ${phase === 'open' ? 'opacity-100' : 'opacity-0'}`}>
            unlocked
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full bg-[#161616] border border-[#1e1e1e] rounded px-3 py-2.5 text-[#bbb] text-sm placeholder:text-[#666] focus:outline-none focus:border-[#2a2a2a] font-light"
        />
        {error && <p className="text-red-500/70 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading || phase !== 'idle'}
          className="w-full bg-[#161616] border border-[#1e1e1e] text-[#888] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#bbb] transition-colors disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Unlock'}
        </button>
      </form>
    </>
  );
}
