'use client';

import { memo, useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
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
  /** Double-tap on a tile (like / unlike). Single taps then wait one double-tap window. */
  onDoubleTap?: (index: number) => void;
  /** Press and hold on a tile outside selection mode (start selecting with it). */
  onLongPress?: (index: number) => void;
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

const DOUBLE_TAP_MS = 250;
const LONG_PRESS_MS = 450;
/** How far a finger may drift and still be a press rather than a scroll. */
const PRESS_SLOP = 10;
/** The pressed look waits this long, so the start of a scroll never flashes it. */
const PRESS_FEEDBACK_MS = 70;

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function breakpointFor(width: number): Breakpoint {
  return width < 640 ? 'sm' : width < 1024 ? 'md' : 'lg';
}

/** The on-screen image for a photo tile, used to measure zoom origins. */
export function findTileImage(photoId: string): HTMLImageElement | null {
  return document.querySelector<HTMLImageElement>(`[data-photo-id="${photoId}"] img`);
}

interface TileHandlers {
  down: (e: React.PointerEvent<HTMLElement>, index: number) => void;
  move: (e: React.PointerEvent<HTMLElement>) => void;
  end: () => void;
  click: (index: number) => void;
  contextMenu: (e: React.MouseEvent) => void;
  like: (photoId: string) => void;
}

interface Press {
  x: number;
  y: number;
  tile: HTMLElement;
  longTimer?: ReturnType<typeof setTimeout>;
  feedbackTimer: ReturnType<typeof setTimeout>;
}

export function MasonryGrid({
  photos, selectionMode = false, selectedIds, onTap, onDoubleTap, onLongPress, likedIds, onToggleLike,
  sizeLevel = 2, hiddenId, onDensityStep,
}: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [internalHidden, setInternalHidden] = useState<string | null>(null);
  const [hearts, setHearts] = useState<Map<string, 'like' | 'unlike'>>(new Map());
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

  // Tiles are memoized and share one stable set of handlers that read the
  // latest props from here, so a tile re-renders only when its own photo,
  // selection, like or visibility changes, not on every grid update.
  const live = useRef({ photos, selectionMode, onTap, onDoubleTap, onLongPress, likedIds, onToggleLike });
  live.current = { photos, selectionMode, onTap, onDoubleTap, onLongPress, likedIds, onToggleLike };

  const press = useRef<Press | null>(null);
  const suppressClick = useRef(false);
  const lastPointer = useRef('mouse');
  const lastTap = useRef<{ time: number; index: number } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (press.current) { clearTimeout(press.current.longTimer); clearTimeout(press.current.feedbackTimer); }
  }, []);

  const handlers = useMemo<TileHandlers>(() => {
    function endPress() {
      const p = press.current;
      if (!p) return;
      clearTimeout(p.longTimer);
      clearTimeout(p.feedbackTimer);
      delete p.tile.dataset.pressed;
      press.current = null;
    }

    function open(i: number) {
      const { onTap } = live.current;
      if (onTap) onTap(i);
      else setLightboxIndex(i);
    }

    function showHeart(photoId: string, kind: 'like' | 'unlike') {
      setHearts(prev => new Map(prev).set(photoId, kind));
      setTimeout(() => {
        setHearts(prev => { const n = new Map(prev); n.delete(photoId); return n; });
      }, 820);
    }

    return {
      down(e, index) {
        lastPointer.current = e.pointerType;
        // A second finger means a pinch, not a press.
        if (!e.isPrimary) { endPress(); return; }
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        endPress();
        suppressClick.current = false;
        const tile = e.currentTarget.closest<HTMLElement>('[data-photo-id]');
        if (!tile) return;
        const p: Press = {
          x: e.clientX,
          y: e.clientY,
          tile,
          feedbackTimer: setTimeout(() => { tile.dataset.pressed = ''; }, PRESS_FEEDBACK_MS),
        };
        const { onLongPress, selectionMode } = live.current;
        if (onLongPress && !selectionMode) {
          p.longTimer = setTimeout(() => {
            suppressClick.current = true; // the lift that ends this hold is not a tap
            endPress();
            window.getSelection()?.removeAllRanges(); // in case the hold began a text selection
            navigator.vibrate?.(8);
            live.current.onLongPress?.(index);
          }, LONG_PRESS_MS);
        }
        press.current = p;
      },
      move(e) {
        const p = press.current;
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > PRESS_SLOP) endPress();
      },
      end: endPress,
      click(index) {
        if (suppressClick.current) { suppressClick.current = false; return; }
        const { selectionMode, onTap, onDoubleTap, photos, likedIds } = live.current;
        if (selectionMode) { onTap?.(index); return; }
        // Without double-tap there is nothing to wait for: open at once.
        if (!onDoubleTap) { open(index); return; }

        const now = performance.now();
        const last = lastTap.current;
        if (last && last.index === index && now - last.time < DOUBLE_TAP_MS) {
          if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
          lastTap.current = null;
          const id = photos[index].id;
          // Read liked state before onDoubleTap flips it optimistically
          showHeart(id, likedIds?.has(id) ? 'unlike' : 'like');
          onDoubleTap(index);
          return;
        }
        lastTap.current = { time: now, index };
        if (tapTimer.current) clearTimeout(tapTimer.current);
        tapTimer.current = setTimeout(() => {
          tapTimer.current = null;
          lastTap.current = null;
          open(index);
        }, DOUBLE_TAP_MS);
      },
      contextMenu(e) {
        // A held finger is our long press; keep the system image menu out of it.
        if (lastPointer.current === 'touch') e.preventDefault();
      },
      like(photoId) {
        live.current.onToggleLike?.(photoId);
      },
    };
  }, []);

  const numCols = SIZE_COLUMNS[bp][Math.min(Math.max(Math.round(sizeLevel), 1), 4) - 1];
  const hidden = hiddenId ?? internalHidden;

  // Two-finger pinch steps the grid once per gesture, like Photos.
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 2) return;
    handlers.end();
    if (!onDensityStep) return;
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
  const columns = useMemo(() => {
    const cols: { photo: Photo; index: number }[][] = Array.from({ length: numCols }, () => []);
    photos.forEach((photo, index) => cols[index % numCols].push({ photo, index }));
    return cols;
  }, [photos, numCols]);

  return (
    <>
      {/* Nothing in the grid is text to select: a held finger is a long press. */}
      <div
        className="flex select-none gap-0.5 [-webkit-touch-callout:none] sm:gap-1.5"
        style={onDensityStep ? { touchAction: 'pan-x pan-y' } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {columns.map((colItems, ci) => (
          <div key={ci} className="flex min-w-0 flex-1 flex-col gap-0.5 sm:gap-1.5">
            {colItems.map(({ photo, index }) => (
              <Tile
                key={photo.id}
                photo={photo}
                index={index}
                selectionMode={selectionMode}
                selected={selectedIds?.has(photo.id) ?? false}
                liked={likedIds?.has(photo.id) ?? false}
                canLike={!!onToggleLike}
                hidden={hidden === photo.id}
                heart={hearts.get(photo.id)}
                handlers={handlers}
              />
            ))}
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

interface TileProps {
  photo: Photo;
  index: number;
  selectionMode: boolean;
  selected: boolean;
  liked: boolean;
  canLike: boolean;
  hidden: boolean;
  heart?: 'like' | 'unlike';
  handlers: TileHandlers;
}

/**
 * One photo. It owns its loaded state, so an image arriving repaints only its
 * own tile. Hover controls (like, download) exist only for a real pointer: on
 * touch screens every tap reaches the photo, and a liked heart is just a mark.
 */
const Tile = memo(function Tile({ photo, index, selectionMode, selected, liked, canLike, hidden, heart, handlers }: TileProps) {
  const [loaded, setLoaded] = useState(false);
  const hasDims = photo.width != null && photo.height != null;

  return (
    <div
      data-photo-id={photo.id}
      className="group relative overflow-hidden rounded-[2px] sm:rounded-tile"
      style={{
        // Placeholder colour until the image lands, then clear so a selected
        // (inset) photo sits on the page, not on a coloured frame.
        backgroundColor: loaded ? 'transparent' : photo.dominantColor ?? 'var(--fill)',
        visibility: hidden ? 'hidden' : undefined,
        aspectRatio: hasDims ? `${photo.width} / ${photo.height}` : undefined,
      }}
    >
      <button
        type="button"
        className="block h-full w-full select-none transition-transform duration-150 ease-out [-webkit-touch-callout:none] group-data-[pressed]:scale-[0.97]"
        style={{ touchAction: 'manipulation' }}
        onPointerDown={e => handlers.down(e, index)}
        onPointerMove={handlers.move}
        onPointerUp={handlers.end}
        onPointerCancel={handlers.end}
        onPointerLeave={handlers.end}
        onContextMenu={handlers.contextMenu}
        onClick={() => handlers.click(index)}
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
          loading={index < 12 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 8 ? 'high' : 'auto'}
          onLoad={() => setLoaded(true)}
          onError={e => {
            setLoaded(true);
            const el = e.currentTarget;
            if (!el.dataset.fallback) {
              // thumbnail failed → fall back to the (presigned) original once
              el.dataset.fallback = '1';
              if (photo.originalUrl) el.src = photo.originalUrl;
            }
          }}
          className={`pointer-events-none block h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out [-webkit-touch-callout:none] ${
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

      {!selectionMode && canLike && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); handlers.like(photo.id); }}
          aria-label={liked ? 'Unlike photo' : 'Like photo'}
          aria-pressed={liked}
          className={`pointer-events-none absolute bottom-1.5 left-1.5 flex h-8 w-8 items-center justify-center rounded-full transition-[opacity,transform] duration-200 ease-out can-hover:pointer-events-auto focus-visible:opacity-100 active:scale-90 ${
            liked ? 'opacity-100' : 'opacity-0 can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100'
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
      {!selectionMode && !canLike && liked && (
        <HeartIcon size={16} filled className="pointer-events-none absolute bottom-2 left-2 text-heart drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]" />
      )}

      {!selectionMode && photo.downloadUrl && (
        <a
          href={photo.downloadUrl}
          download={photo.filename}
          onClick={e => e.stopPropagation()}
          aria-label={`Download ${photo.filename}`}
          className="absolute bottom-1.5 right-1.5 hidden h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-200 hover:bg-black/60 focus-visible:opacity-100 can-hover:flex can-hover:group-hover:opacity-100 can-hover:group-focus-within:opacity-100"
        >
          <DownloadIcon size={16} strokeWidth={2} />
        </a>
      )}

      {selectionMode && (
        <span
          aria-hidden
          className={`pointer-events-none absolute bottom-1.5 right-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full ring-[1.5px] ring-white transition-colors duration-150 ${
            selected ? 'animate-badge bg-white text-black shadow-[0_1px_4px_rgba(0,0,0,0.35)]' : 'bg-black/20'
          }`}
        >
          {selected && <CheckIcon size={13} strokeWidth={2.5} />}
        </span>
      )}
    </div>
  );
});
