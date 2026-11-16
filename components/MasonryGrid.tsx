'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Lightbox } from './Lightbox';
import { HeartIcon, DownloadIcon, CheckIcon } from './icons';

interface Photo {
  id: string;
  filename: string;
  url: string;
  originalUrl?: string;
  downloadUrl?: string;
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
  onToggleLike?: (photoId: string) => void;
  /** Photo size 1 (smallest) – 4 (largest); maps to column count per breakpoint. */
  sizeLevel?: number;
  /** Tile hidden while its photo is open in the viewer, so the zoom reads as the tile lifting out. */
  hiddenId?: string | null;
  /** Pinch on touch screens steps the grid size: +1 bigger, -1 smaller. */
  onDensityStep?: (dir: 1 | -1) => void;
}

type Breakpoint = 'sm' | 'md' | 'lg';

// Columns per breakpoint, indexed by sizeLevel − 1 (bigger photos = fewer columns)
const SIZE_COLUMNS: Record<Breakpoint, number[]> = {
  sm: [4, 3, 2, 1],
  md: [5, 4, 3, 2],
  lg: [7, 5, 4, 3],
};

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function breakpointFor(width: number): Breakpoint {
  return width < 640 ? 'sm' : width < 1024 ? 'md' : 'lg';
}

/** The on-screen image for a photo tile, used to measure zoom origins. */
export function findTileImage(photoId: string): HTMLImageElement | null {
  return document.querySelector<HTMLImageElement>(`[data-photo-id="${photoId}"] img`);
}

export function MasonryGrid({
  photos, selectionMode, selectedIds, onTap, onDoubleTap, likedIds, onToggleLike,
  sizeLevel = 2, hiddenId, onDensityStep,
}: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [internalHidden, setInternalHidden] = useState<string | null>(null);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [hearts, setHearts] = useState<Map<string, 'like' | 'unlike'>>(new Map());
  const lastClickRef = useRef<{ time: number; index: number } | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchRef = useRef<{ start: number; fired: boolean } | null>(null);
  // Server and first client render agree on the phone layout (the main device);
  // the real breakpoint is applied before the first paint after hydration.
  const [bp, setBp] = useState<Breakpoint>('sm');

  useIsomorphicLayoutEffect(() => {
    function update() { setBp(breakpointFor(window.innerWidth)); }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => () => { if (clickTimerRef.current) clearTimeout(clickTimerRef.current); }, []);

  const numCols = SIZE_COLUMNS[bp][Math.min(Math.max(Math.round(sizeLevel), 1), 4) - 1];
  const hidden = hiddenId ?? internalHidden;

  function triggerHeartAnimation(photoId: string, kind: 'like' | 'unlike') {
    setHearts(prev => new Map(prev).set(photoId, kind));
    setTimeout(() => {
      setHearts(prev => { const n = new Map(prev); n.delete(photoId); return n; });
    }, 820);
  }

  function open(i: number) {
    if (onTap) onTap(i);
    else setLightboxIndex(i);
  }

  function handleClick(i: number) {
    if (selectionMode) { onTap?.(i); return; }

    // Without double-tap-to-like there is nothing to wait for: open at once.
    if (!onDoubleTap) { open(i); return; }

    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.index === i && now - last.time < 280) {
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      lastClickRef.current = null;
      // Read liked state before onDoubleTap flips it optimistically
      triggerHeartAnimation(photos[i].id, likedIds?.has(photos[i].id) ? 'unlike' : 'like');
      onDoubleTap(i);
      return;
    }
    lastClickRef.current = { time: now, index: i };
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; open(i); }, 280);
  }

  function markLoaded(id: string) {
    setLoadedIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  // Two-finger pinch steps the grid once per gesture, like Photos.
  function onTouchStart(e: React.TouchEvent) {
    if (!onDensityStep || e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    pinchRef.current = { start: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), fired: false };
  }
  function onTouchMove(e: React.TouchEvent) {
    const p = pinchRef.current;
    if (!onDensityStep || !p || p.fired || e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const ratio = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / p.start;
    if (ratio > 1.22) { p.fired = true; onDensityStep(1); }
    else if (ratio < 0.8) { p.fired = true; onDensityStep(-1); }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null;
  }

  const getOrigin = useCallback((i: number) => {
    const p = photos[i];
    return p ? findTileImage(p.id)?.getBoundingClientRect() ?? null : null;
  }, [photos]);

  // Each photo is permanently assigned to column (i % numCols).
  // Appending new photos never redistributes existing ones.
  const columns = Array.from({ length: numCols }, (_, ci) =>
    photos
      .map((photo, i) => ({ photo, originalIndex: i }))
      .filter(({ originalIndex: i }) => i % numCols === ci)
  );

  return (
    <>
      <div
        className="flex gap-0.5 sm:gap-1.5"
        style={onDensityStep ? { touchAction: 'pan-x pan-y' } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {columns.map((colItems, ci) => (
          <div key={ci} className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-1.5">
            {colItems.map(({ photo, originalIndex: i }) => {
              const selected = selectedIds?.has(photo.id) ?? false;
              const loaded = loadedIds.has(photo.id);
              const liked = likedIds?.has(photo.id) ?? false;
              const hasDims = photo.width != null && photo.height != null;
              const heart = hearts.get(photo.id);

              return (
                <div
                  key={photo.id}
                  data-photo-id={photo.id}
                  className="group relative overflow-hidden rounded-[2px] sm:rounded-tile"
                  style={{
                    // Placeholder colour until the image lands, then clear so a selected
                    // (inset) photo sits on the page, not on a coloured frame.
                    backgroundColor: loaded ? 'transparent' : photo.dominantColor ?? 'var(--fill)',
                    visibility: hidden === photo.id ? 'hidden' : undefined,
                    aspectRatio: hasDims ? `${photo.width} / ${photo.height}` : undefined,
                  }}
                >
                  <button
                    type="button"
                    className="block h-full w-full"
                    style={{ touchAction: 'manipulation' }}
                    onClick={() => handleClick(i)}
                    aria-pressed={selectionMode ? selected : undefined}
                    aria-label={selectionMode
                      ? (selected ? `Deselect ${photo.filename}` : `Select ${photo.filename}`)
                      : `Open ${photo.filename}`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.filename}
                      width={hasDims ? photo.width : undefined}
                      height={hasDims ? photo.height : undefined}
                      draggable={false}
                      loading={i < 12 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={i < 8 ? 'high' : 'auto'}
                      onLoad={() => markLoaded(photo.id)}
                      onError={e => {
                        markLoaded(photo.id);
                        const el = e.currentTarget;
                        if (!el.dataset.fallback) {
                          // thumbnail failed → fall back to the (presigned) original once
                          el.dataset.fallback = '1';
                          if (photo.originalUrl) el.src = photo.originalUrl;
                        }
                      }}
                      className={`block h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out ${
                        loaded ? 'opacity-100' : 'opacity-0'
                      } ${selected ? 'scale-[0.94]' : 'scale-100'}`}
                    />
                  </button>

                  {/* Double-tap burst: pink for like, grey and struck for unlike */}
                  {heart && (
                    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className={`animate-heart-pop relative ${heart === 'like' ? 'text-heart' : 'text-white/80'}`}>
                        <HeartIcon size={60} filled className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]" />
                        {heart === 'unlike' && (
                          <span className="absolute left-1/2 top-1/2 h-[3px] w-[70px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white/90" />
                        )}
                      </div>
                    </div>
                  )}

                  {!selectionMode && onToggleLike && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onToggleLike(photo.id); }}
                      aria-label={liked ? 'Unlike photo' : 'Like photo'}
                      aria-pressed={liked}
                      className={`absolute bottom-1.5 left-1.5 flex h-8 w-8 items-center justify-center rounded-full transition-[opacity,transform] duration-200 ease-out active:scale-90 ${
                        liked
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100'
                      }`}
                    >
                      <HeartIcon
                        size={18}
                        filled={liked}
                        strokeWidth={2}
                        className={`drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] ${liked ? 'text-heart' : 'text-white'}`}
                      />
                    </button>
                  )}
                  {!selectionMode && !onToggleLike && liked && (
                    <HeartIcon size={16} filled className="pointer-events-none absolute bottom-2 left-2 text-heart drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
                  )}

                  {!selectionMode && photo.downloadUrl && (
                    <a
                      href={photo.downloadUrl}
                      download={photo.filename}
                      onClick={e => e.stopPropagation()}
                      aria-label={`Download ${photo.filename}`}
                      className="absolute bottom-1.5 right-1.5 hidden h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-md transition-opacity duration-200 hover:bg-black/55 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 sm:flex"
                    >
                      <DownloadIcon size={16} strokeWidth={2} />
                    </a>
                  )}

                  {selectionMode && (
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute bottom-1.5 right-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full ring-[1.5px] ring-white transition-colors duration-150 ${
                        selected ? 'animate-badge bg-tint' : 'bg-black/20'
                      }`}
                    >
                      {selected && <CheckIcon size={13} className="text-white" />}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {!onTap && lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          getOrigin={getOrigin}
          onActiveChange={id => setInternalHidden(id)}
          onClose={() => { setLightboxIndex(null); setInternalHidden(null); }}
          likedIds={likedIds}
          onToggleLike={onToggleLike}
        />
      )}
    </>
  );
}
