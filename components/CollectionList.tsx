'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRightIcon, CloseIcon, SearchIcon } from './icons';
import { AmbientGlow } from './AmbientGlow';

interface Collection {
  id: string;
  name: string;
  photo_count: number;
  event_date?: string | null;
  /** Ambient glow palette from the collection's photo colors ([] = none). */
  glow: string[];
}

function formatMonth(date: string) {
  const [year, month] = date.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Search field plus the collections it filters. Phones and tablets get a
 * grouped inset list; from lg up the same rows become a full-width index:
 * names in large type, count and date in aligned columns, hairline rules.
 * It also owns the page glow: the latest collection's colors at rest, easing
 * to whichever collection is hovered or focused.
 */
export function CollectionList({ collections }: { collections: Collection[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? collections.filter(c => c.name.toLowerCase().includes(q)) : collections;
  const [glow, setGlow] = useState(() => collections.find(c => c.glow.length > 0)?.glow ?? []);
  const lightUp = (c: Collection) => { if (c.glow.length > 0) setGlow(c.glow); };

  return (
    <div>
      <AmbientGlow colors={glow} reach="page" />
      {collections.length > 5 && (
        <div className="relative mb-5 lg:mb-8 lg:max-w-xs">
          <SearchIcon size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-label2" />
          <input
            type="search"
            placeholder="Search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search collections"
            className="field h-10 rounded-[10px] pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-label2 text-surface transition-transform active:scale-90"
            >
              <CloseIcon size={11} strokeWidth={3} />
            </button>
          )}
        </div>
      )}

      {collections.length === 0 ? (
        <div className="list px-4 py-10 text-center">
          <p className="text-headline">No Collections Yet</p>
          <p className="mt-1 text-subhead text-label2">New events will show up here.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-subhead text-label2 lg:text-left">No collections match “{query.trim()}”.</p>
      ) : (
        <div className="list list-index">
          {filtered.map(c => {
            const count = `${c.photo_count} ${c.photo_count === 1 ? 'photo' : 'photos'}`;
            const month = c.event_date ? formatMonth(c.event_date) : null;
            return (
              <Link
                key={c.id}
                href={`/c/${c.id}`}
                onMouseEnter={() => lightUp(c)}
                onFocus={() => lightUp(c)}
                className="list-row group py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_8rem_7rem_1.25rem] lg:items-center lg:gap-x-8 lg:px-0 lg:py-6"
              >
                <span className="min-w-0 flex-1 lg:contents">
                  <span className="block truncate text-body lg:text-title1 lg:font-semibold lg:transition-transform lg:duration-300 lg:ease-ios lg:group-hover:translate-x-1.5 lg:group-active:opacity-60">
                    {c.name}
                  </span>
                  <span className="mt-0.5 block text-subhead text-label2 tabular-nums lg:hidden">
                    {count}
                    {month && <> · {month}</>}
                  </span>
                </span>
                <span className="hidden text-right text-body text-label2 tabular-nums transition-colors duration-200 group-hover:text-label lg:block">
                  {count}
                </span>
                <span className="hidden text-right text-body text-label2 tabular-nums transition-colors duration-200 group-hover:text-label lg:block">
                  {month}
                </span>
                <ChevronRightIcon
                  size={15}
                  className="shrink-0 self-center text-label2 opacity-60 transition-[transform,opacity,color] duration-300 ease-ios group-hover:translate-x-0.5 lg:size-[18px] lg:justify-self-end lg:group-hover:translate-x-1 lg:group-hover:text-label lg:group-hover:opacity-100"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
