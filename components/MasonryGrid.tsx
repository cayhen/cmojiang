'use client';

import { useState } from 'react';
import { Lightbox } from './Lightbox';

interface Photo {
  id: string;
  filename: string;
  url: string;
  originalUrl?: string;
  width?: number;
  height?: number;
  dominantColor?: string;
}

interface Props {
  photos: Photo[];
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onTap?: (index: number) => void;
}

export function MasonryGrid({ photos, selectionMode, selectedIds, onTap }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());

  function handleClick(i: number) {
    if (onTap) {
      onTap(i);
    } else {
      setLightboxIndex(i);
    }
  }

  function markLoaded(id: string) {
    setLoadedIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-1.5">
        {photos.map((photo, i) => {
          const selected = selectedIds?.has(photo.id) ?? false;
          const loaded = loadedIds.has(photo.id);
          const hasDims = photo.width != null && photo.height != null;
          // Above-the-fold: first 8 load eagerly with high priority
          const priority = i < 8;

          return (
            <button
              key={photo.id}
              className="break-inside-avoid mb-1.5 w-full block focus:outline-none focus:ring-1 focus:ring-[#333] rounded-sm relative overflow-hidden"
              style={{ backgroundColor: photo.dominantColor ?? '#1a1a1a' }}
              onClick={() => handleClick(i)}
              aria-label={selectionMode
                ? (selected ? `Deselect ${photo.filename}` : `Select ${photo.filename}`)
                : `Open ${photo.filename}`}
            >
              <img
                src={photo.url}
                alt={photo.filename}
                width={hasDims ? photo.width : undefined}
                height={hasDims ? photo.height : undefined}
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'auto'}
                onLoad={() => markLoaded(photo.id)}
                onError={e => {
                  markLoaded(photo.id);
                  if (photo.originalUrl) e.currentTarget.src = photo.originalUrl;
                }}
                className={`w-full block rounded-sm transition-opacity duration-500 ${
                  selected ? 'opacity-60' : (loaded ? 'opacity-100' : 'opacity-0')
                }`}
              />
              {selectionMode && (
                <div
                  className={`absolute top-2 right-2 w-5 h-5 rounded-full border border-white/80 flex items-center justify-center transition-colors ${
                    selected ? 'bg-white' : 'bg-black/40'
                  }`}
                >
                  {selected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {!onTap && lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
