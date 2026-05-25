'use client';

import { useState } from 'react';
import { Lightbox } from './Lightbox';

interface Photo { id: string; filename: string; url: string; }

interface Props {
  photos: Photo[];
  /** When provided, selection UI is shown */
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  /** When provided, tap calls this instead of opening lightbox */
  onTap?: (index: number) => void;
}

export function MasonryGrid({ photos, selectionMode, selectedIds, onTap }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function handleClick(i: number) {
    if (onTap) {
      onTap(i);
    } else {
      setLightboxIndex(i);
    }
  }

  return (
    <>
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-1.5">
        {photos.map((photo, i) => {
          const selected = selectedIds?.has(photo.id) ?? false;
          return (
            <button
              key={photo.id}
              className="break-inside-avoid mb-1.5 w-full block focus:outline-none focus:ring-1 focus:ring-[#333] rounded-sm relative"
              onClick={() => handleClick(i)}
              aria-label={selectionMode ? (selected ? `Deselect ${photo.filename}` : `Select ${photo.filename}`) : `Open ${photo.filename}`}
            >
              <img
                src={photo.url}
                alt={photo.filename}
                loading="lazy"
                className={`w-full block rounded-sm transition-opacity ${selected ? 'opacity-60' : 'opacity-100'}`}
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

      {/* Only render lightbox when onTap not provided (standalone use) */}
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
