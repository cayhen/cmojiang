'use client';

import { useState } from 'react';
import { CollectionCard } from './CollectionCard';

interface Collection {
  id: string;
  name: string;
  photo_count: number;
  event_date?: string | null;
}

export function SearchBar({ collections }: { collections: Collection[] }) {
  const [query, setQuery] = useState('');

  const filtered = collections.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Search collections..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2 text-[#bbb] text-sm placeholder:text-[#888] focus:outline-none focus:border-[#888] mb-5 font-light"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(c => (
          <CollectionCard key={c.id} {...c} />
        ))}
        {filtered.length === 0 && query && (
          <p className="text-[#888] text-sm col-span-full">No collections found.</p>
        )}
      </div>
    </div>
  );
}
