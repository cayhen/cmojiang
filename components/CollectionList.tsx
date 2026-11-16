'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRightIcon, CloseIcon, SearchIcon } from './icons';

interface Collection {
  id: string;
  name: string;
  photo_count: number;
  event_date?: string | null;
}

function formatMonth(date: string) {
  const [year, month] = date.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Search field plus the grouped list of collections it filters. */
export function CollectionList({ collections }: { collections: Collection[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? collections.filter(c => c.name.toLowerCase().includes(q)) : collections;

  return (
    <div>
      {collections.length > 5 && (
        <div className="relative mb-5">
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
        <p className="py-10 text-center text-subhead text-label2">No collections match “{query.trim()}”.</p>
      ) : (
        <div className="list">
          {filtered.map(c => (
            <Link key={c.id} href={`/c/${c.id}`} className="list-row group py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body">{c.name}</p>
                <p className="mt-0.5 text-subhead text-label2 tabular-nums">
                  {c.photo_count} {c.photo_count === 1 ? 'photo' : 'photos'}
                  {c.event_date && <> · {formatMonth(c.event_date)}</>}
                </p>
              </div>
              <ChevronRightIcon size={15} className="shrink-0 text-label2 opacity-60 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
