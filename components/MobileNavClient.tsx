'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import FocusTrap from 'focus-trap-react';

export function MobileNavClient({ username }: { username: string | null }) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  // Lock body scroll and close on Escape while open. We own the open state
  // ourselves (rather than letting focus-trap's onDeactivate drive it) so React
  // StrictMode's dev remount can't self-close the drawer.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleSignOut() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Menu"
        aria-expanded={open}
        className="-ml-1 p-1 text-[#888] hover:text-[#bbb] transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <FocusTrap focusTrapOptions={{ clickOutsideDeactivates: false, escapeDeactivates: false }}>
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-black/60" onClick={close} />
            <nav className="animate-slide-in-left absolute top-0 left-0 h-full w-64 max-w-[80vw] bg-[#111] border-r border-[#222] flex flex-col p-6">
              <div className="flex items-center justify-between mb-8">
                <span className="text-[#555] text-xs uppercase tracking-widest truncate pr-2">{username ?? 'Menu'}</span>
                <button onClick={close} aria-label="Close menu" className="text-[#777] hover:text-[#bbb] text-2xl leading-none shrink-0">×</button>
              </div>
              <div className="flex flex-col">
                <NavLink href="/" onNavigate={close}>Home</NavLink>
                {username ? (
                  <>
                    <NavLink href="/profile" onNavigate={close}>Profile</NavLink>
                    <NavLink href="/profile/likes" onNavigate={close}>Liked photos</NavLink>
                    <button
                      onClick={handleSignOut}
                      className="text-left text-[#888] hover:text-[#bbb] text-base font-light py-3 border-b border-[#1a1a1a] transition-colors"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <NavLink href="/login" onNavigate={close}>Sign in</NavLink>
                    <NavLink href="/signup" onNavigate={close}>Create account</NavLink>
                  </>
                )}
              </div>
            </nav>
          </div>
        </FocusTrap>
      )}
    </div>
  );
}

function NavLink({ href, onNavigate, children }: { href: string; onNavigate: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="text-[#bbb] hover:text-white text-base font-light py-3 border-b border-[#1a1a1a] transition-colors"
    >
      {children}
    </Link>
  );
}
