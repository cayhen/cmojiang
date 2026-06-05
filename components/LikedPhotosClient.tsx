'use client';

import { useState } from 'react';
import { MasonryGrid } from './MasonryGrid';
import Link from 'next/link';

export interface LikedPhoto {
  id: string;
  filename: string;
  url: string;
  originalUrl: string;
  width?: number;
  height?: number;
  dominantColor?: string;
  collectionId: string;
}

export interface LikedSection {
  collectionId: string;
  name: string;
  photos: LikedPhoto[];
}

interface Props {
  initialSections: LikedSection[];
}

export function LikedPhotosClient({ initialSections }: Props) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  async function handleUnlike(photoId: string) {
    // Optimistically remove
    setRemovedIds(prev => { const n = new Set(prev); n.add(photoId); return n; });
    try {
      const res = await fetch(`/api/photos/${photoId}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('Unlike failed');
    } catch {
      // Revert on error
      setRemovedIds(prev => { const n = new Set(prev); n.delete(photoId); return n; });
    }
  }

  const sections = initialSections
    .map(section => ({
      ...section,
      photos: section.photos.filter(p => !removedIds.has(p.id)),
    }))
    .filter(section => section.photos.length > 0);

  const likedIds = new Set(sections.flatMap(s => s.photos.map(p => p.id)));

  if (sections.length === 0) {
    return (
      <p className="text-[#444] text-sm font-light">No liked photos yet. Double-tap any photo to like it.</p>
    );
  }

  return (
    <div className="space-y-12">
      {sections.map(section => (
        <div key={section.collectionId}>
          <div className="mb-4">
            <Link
              href={`/c/${section.collectionId}/gallery`}
              className="text-[#555] text-xs uppercase tracking-widest hover:text-[#888] transition-colors"
            >
              {section.name}
            </Link>
          </div>
          <MasonryGrid
            photos={section.photos}
            likedIds={likedIds}
            onUnlike={handleUnlike}
          />
        </div>
      ))}
    </div>
  );
}
