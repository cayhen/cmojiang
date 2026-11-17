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
  /** narrow: centered reading column (lists, forms). wide: full-width (photo grids). index: home. */
  width?: keyof typeof CONTAINER;
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
            {back && <BackLink {...back} />}
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
          <div className="flex items-center justify-end gap-3 lg:gap-4">{actions}</div>
        </div>
      </div>

      {/* From lg the title goes display-size and the toolbar moves onto its baseline. */}
      <header className={`${CONTAINER[width]} pb-4 pt-1 lg:flex lg:items-end lg:justify-between lg:gap-12 lg:pb-10 lg:pt-6`}>
        <div className="min-w-0">
          <h1 ref={titleRef} className="text-large-title md:text-display break-words [text-wrap:balance]">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-1 text-subhead text-label2 md:mt-2 lg:mt-3 lg:text-title3 lg:font-normal">{subtitle}</div>
          )}
        </div>
        {toolbar && <div className="mt-4 lg:mt-0 lg:shrink-0 lg:pb-0.5">{toolbar}</div>}
      </header>
    </>
  );
}

/** Minimal bar for single-task pages (unlock, sign in): back link only. */
export function TopBar({ back, actions }: { back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div className="pt-[env(safe-area-inset-top)]">
      <div className={`${CONTAINER.narrow} flex h-[52px] items-center justify-between`}>
        {back ? <BackLink {...back} /> : <span />}
        <div className="flex items-center gap-3 lg:gap-4">{actions}</div>
      </div>
    </div>
  );
}

/**
 * Back control, the same Fill capsule as every other bar button: a chevron
 * circle on phones (it mirrors the account circle opposite), the destination
 * named from sm up. The label stays in the accessible name at every size.
 */
function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="btn btn-sm btn-tinted w-8 gap-1 px-0 sm:w-auto sm:pl-2 sm:pr-3.5">
      <ChevronLeftIcon size={17} className="shrink-0" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Link>
  );
}
