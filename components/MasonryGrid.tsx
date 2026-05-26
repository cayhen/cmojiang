'use client';

import { useState, useEffect } from 'react';
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
  const [numCols, setNumCols] = useState(() => {
    if (typeof window === 'undefined') return 4;
    const w = window.innerWidth;
    return w < 640 ? 2 : w < 1024 ? 3 : 4;
  });

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      setNumCols(w < 640 ? 2 : w < 1024 ? 3 : 4);
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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

  // Each photo is permanently assigned to column (i % numCols).
  // Appending new photos never redistributes existing ones.
  const columns = Array.from({ length: numCols }, (_, ci) =>
    photos
      .map((photo, i) => ({ photo, originalIndex: i }))
      .filter(({ originalIndex: i }) => i % numCols === ci)
  );

  return (
    <>
      <div className="flex gap-1.5">
        {columns.map((colItems, ci) => (
          <div key={ci} className="flex-1 flex flex-col gap-1.5">
            {colItems.map(({ photo, originalIndex: i }) => {
              const selected = selectedIds?.has(photo.id) ?? false;
              const loaded = loadedIds.has(photo.id);
              const hasDims = photo.width != null && photo.height != null;
              const priority = i < 8;

              return (
                <button
                  key={photo.id}
                  className="group w-full block focus:outline-none focus:ring-1 focus:ring-[#333] rounded-sm relative overflow-hidden"
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
                    loading="eager"
                    decoding="async"
                    fetchPriority={priority ? 'high' : 'auto'}
                    onLoad={() => markLoaded(photo.id)}
                    onError={e => {
                      markLoaded(photo.id);
                      if (photo.originalUrl) e.currentTarget.src = photo.originalUrl;
                    }}
                    className={`w-full block rounded-sm transition-opacity duration-300 ${
                      selected ? 'opacity-60' : (loaded ? 'opacity-100' : 'opacity-0')
                    }`}
                  />
                  {!selectionMode && (
                    <a
                      href={`/api/photo/${photo.id}`}
                      download={photo.filename}
                      onClick={e => e.stopPropagation()}
                      aria-label={`Download ${photo.filename}`}
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-black/50 hover:bg-black/70 rounded p-1.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M6 1v7M3 6l3 3 3-3M1 10h10" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  )}
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
        ))}
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
