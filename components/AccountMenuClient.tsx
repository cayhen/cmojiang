'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePresence } from './usePresence';
import { HeartIcon, ChevronRightIcon } from './icons';

export function AccountMenuClient({ username }: { username: string | null }) {
  const [open, setOpen] = useState(false);
  const { mounted, shown } = usePresence(open, 180);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); }
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!username) {
    return (
      <Link href="/login" className="btn-plain py-2">
        Sign In
      </Link>
    );
  }

  async function signOut() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${username}`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-fill text-subhead font-semibold uppercase text-label transition-transform duration-150 ease-out hover:bg-fill2 active:scale-95"
      >
        {username.slice(0, 1)}
      </button>

      {mounted && (
        <div
          role="menu"
          className={`absolute right-0 top-full z-40 mt-2 w-60 origin-top-right overflow-hidden rounded-card material-thick shadow-float transition-[opacity,transform] duration-200 ease-out ${
            shown ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          <div className="px-4 pb-2 pt-3">
            <p className="text-footnote text-label2">Signed in as</p>
            <p className="truncate text-headline">{username}</p>
          </div>
          <div className="hairline-t">
            <MenuLink href="/profile/likes" onSelect={() => setOpen(false)}>
              <HeartIcon size={18} filled className="text-heart" />
              <span className="flex-1">Liked Photos</span>
              <ChevronRightIcon size={14} className="text-label2" />
            </MenuLink>
            <MenuLink href="/profile" onSelect={() => setOpen(false)}>
              <span className="flex-1">Your Collections</span>
              <ChevronRightIcon size={14} className="text-label2" />
            </MenuLink>
          </div>
          <div className="hairline-t">
            <button
              role="menuitem"
              type="button"
              onClick={signOut}
              className="flex w-full items-center px-4 py-3 text-left text-body text-destructive transition-colors hover:bg-fill"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, onSelect, children }: { href: string; onSelect: () => void; children: React.ReactNode }) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onSelect}
      className="flex items-center gap-3 px-4 py-3 text-body transition-colors hover:bg-fill"
    >
      {children}
    </Link>
  );
}
