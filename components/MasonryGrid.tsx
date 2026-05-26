'use client';

import { useState, useEffect, useRef } from 'react';
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
  onDoubleTap?: (index: number) => void;
  likedIds?: Set<string>;
}

export function MasonryGrid({ photos, selectionMode, selectedIds, onTap, onDoubleTap, likedIds }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());
  const lastClickRef = useRef<{ time: number; index: number } | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  function triggerHeartAnimation(photoId: string) {
    setAnimatingIds(prev => { const n = new Set(prev); n.add(photoId); return n; });
    setTimeout(() => {
      setAnimatingIds(prev => { const n = new Set(prev); n.delete(photoId); return n; });
    }, 700);
  }

  function handleClick(i: number) {
    const now = Date.now();
    const last = lastClickRef.current;

    if (last && last.index === i && now - last.time < 300) {
      // Double-click detected
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      lastClickRef.current = null;
      if (!selectionMode && onDoubleTap) {
        triggerHeartAnimation(photos[i].id);
        onDoubleTap(i);
      }
      return;
    }

    lastClickRef.current = { time: now, index: i };

    if (selectionMode) {
      onTap?.(i);
      return;
    }

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      if (onTap) onTap(i);
      else setLightboxIndex(i);
    }, 300);
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
              const liked = likedIds?.has(photo.id) ?? false;
              const animating = animatingIds.has(photo.id);

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

                  {/* Heart burst animation on double-click */}
                  {animating && (
                    <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <svg className="animate-heart-burst" width="56" height="56" viewBox="0 0 24 24" fill="#ff4d6d">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                  )}

                  {/* Persistent liked indicator */}
                  {liked && !selectionMode && (
                    <div aria-hidden className="absolute top-2 left-2 pointer-events-none">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff4d6d">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                  )}

                  {/* Per-photo download button */}
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

                  {/* Selection mode checkbox */}
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
