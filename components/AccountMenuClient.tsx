'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePresence } from './usePresence';
import { HeartIcon, ChevronRightIcon, PersonIcon } from './icons';

/**
 * One account control in two states: an empty circle when signed out (its menu
 * says what an account is for and offers Sign In), the user's initial when
 * signed in (Liked Photos, Your Collections, Sign Out, and Manage Collections
 * for an admin account).
 */
export function AccountMenuClient({ username, isAdmin = false }: { username: string | null; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const { mounted, shown } = usePresence(open, 180);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

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
        aria-label={username ? `Account: ${username}` : 'Account: not signed in'}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-subhead font-semibold uppercase transition-[transform,background-color] duration-150 ease-out hover:bg-fill2 active:scale-95 ${
          open ? 'bg-fill2' : 'bg-fill'
        } ${username ? 'text-label' : 'text-label2'}`}
      >
        {username ? username.slice(0, 1) : <PersonIcon size={19} />}
      </button>

      {mounted && (
        <div
          role="menu"
          className={`absolute right-0 top-full z-40 mt-2 w-64 origin-top-right overflow-hidden rounded-card material-thick shadow-float transition-[opacity,transform] duration-200 ease-out ${
            shown ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          {username ? (
            <>
              <div className="px-4 pb-2 pt-3">
                <p className="text-footnote text-label2">Signed in as</p>
                <p className="truncate text-headline">{username}</p>
              </div>
              <div className="hairline-t">
                <MenuLink href="/profile/likes" onSelect={close}>
                  <HeartIcon size={18} filled className="text-heart" />
                  <span className="flex-1">Liked Photos</span>
                  <ChevronRightIcon size={14} className="text-label2" />
                </MenuLink>
                <MenuLink href="/profile" onSelect={close}>
                  <span className="flex-1">Your Collections</span>
                  <ChevronRightIcon size={14} className="text-label2" />
                </MenuLink>
              </div>
              {isAdmin && (
                <div className="hairline-t">
                  <MenuLink href="/admin/dashboard" onSelect={close}>
                    <span className="flex-1">Manage Collections</span>
                    <ChevronRightIcon size={14} className="text-label2" />
                  </MenuLink>
                </div>
              )}
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
            </>
          ) : (
            <>
              <div className="px-4 pb-4 pt-3.5">
                <p className="text-subhead text-label2">like photos &amp; leave comments</p>
                <Link role="menuitem" href="/login" onClick={close} className="btn btn-sm btn-filled mt-3 w-full">
                  Sign In
                </Link>
              </div>
              <div className="hairline-t">
                <MenuLink href="/signup" onSelect={close}>
                  <span className="flex-1">Create Account</span>
                  <ChevronRightIcon size={14} className="text-label2" />
                </MenuLink>
              </div>
            </>
          )}
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
