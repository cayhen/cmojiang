'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon } from './icons';
import { CONTAINER } from './container';
import { prefersReducedMotion } from './usePresence';

interface Props {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** Controls that sit under the large title (filters, counts, buttons). */
  toolbar?: React.ReactNode;
  /** narrow: centered reading column (lists, forms). wide: full-width (photo grids). */
  width?: 'narrow' | 'wide';
}


/**
 * Large-title header: the title sits big under a transparent bar, and once it
 * scrolls away the bar turns to frosted material and shows the title small.
 */
export function PageHeader({ title, subtitle, back, actions, toolbar, width = 'narrow' }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { rootMargin: '-52px 0px 0px 0px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        className={`sticky top-0 z-30 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-out ${
          collapsed ? 'material hairline-b' : 'bg-transparent'
        }`}
      >
        <div className={`${CONTAINER[width]} grid h-[52px] grid-cols-[1fr_auto_1fr] items-center gap-2`}>
          <div className="flex min-w-0 items-center">
            {back && (
              <Link href={back.href} className="btn-plain -ml-1.5 min-w-0 py-2 pr-2">
                <ChevronLeftIcon size={22} className="shrink-0" />
                <span className="truncate">{back.label}</span>
              </Link>
            )}
          </div>
          <button
            type="button"
            tabIndex={collapsed ? 0 : -1}
            onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}
            aria-label="Scroll to top"
            aria-hidden={!collapsed}
            className={`max-w-[46vw] truncate text-headline transition-[opacity,transform] duration-300 ease-ios ${
              collapsed ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
            }`}
          >
            {title}
          </button>
          <div className="flex items-center justify-end gap-1.5">{actions}</div>
        </div>
      </div>

      <header className={`${CONTAINER[width]} pb-4 pt-1`}>
        <h1 ref={titleRef} className="text-large-title md:text-[40px] md:leading-[46px] break-words">
          {title}
        </h1>
        {subtitle && <div className="mt-1 text-subhead text-label2">{subtitle}</div>}
        {toolbar && <div className="mt-4">{toolbar}</div>}
      </header>
    </>
  );
}

/** Minimal bar for single-task pages (unlock, sign in): back link only. */
export function TopBar({ back, actions }: { back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div className="pt-[env(safe-area-inset-top)]">
      <div className={`${CONTAINER.narrow} flex h-[52px] items-center justify-between`}>
        {back ? (
          <Link href={back.href} className="btn-plain -ml-1.5 py-2 pr-2">
            <ChevronLeftIcon size={22} />
            <span>{back.label}</span>
          </Link>
        ) : <span />}
        <div className="flex items-center gap-1.5">{actions}</div>
      </div>
    </div>
  );
}
