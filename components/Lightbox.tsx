'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import FocusTrap from 'focus-trap-react';
import { useCanShareFiles, sharePhotos } from '@/lib/share';
import { useScrollLock, prefersReducedMotion } from './usePresence';
import { animateSpring, lerp, progressVelocity, settled } from './spring';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, DownloadIcon, HeartIcon, ShareIcon, Spinner } from './icons';

interface Photo {
  id: string;
  filename: string;
  url: string;
  originalUrl?: string;
  downloadUrl?: string;
  width?: number;
  height?: number;
}

interface Props {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
  /** Called on open and whenever the visible photo changes — used to sync ?photo= in the URL. */
  onIndexChange?: (index: number) => void;
  /** Show the share button (gallery pages only — a share link makes no sense from /profile/likes). */
  showShare?: boolean;
  /** Liked photo ids, so the heart button stays correct as you navigate. */
  likedIds?: Set<string>;
  /** Presence enables liking (double-tap + heart button); absence keeps double-tap as zoom. */
  onToggleLike?: (photoId: string) => void;
  /** Rect of the grid tile the photo zooms out of and back into. */
  getOrigin?: (index: number) => DOMRect | null;
  /** Tells the grid which tile to hide while its photo is open. */
  onActiveChange?: (photoId: string | null) => void;
  /** Lets the grid render the tile for this index before the closing zoom measures it. */
  prepareClose?: (index: number) => void;
}

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const GAP = 28;              // space between slides while paging
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 260;

interface Zoom { scale: number; x: number; y: number }
const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 };
interface Box { left: number; top: number; width: number; height: number }

function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}

interface Parts { x: number; y: number; sx: number; sy: number }
const IDENTITY_PARTS: Parts = { x: 0, y: 0, sx: 1, sy: 1 };

/** Offset and scale that place box `to` over box `from`. */
function boxDelta(from: Box, to: Box): Parts {
  return {
    x: from.left + from.width / 2 - (to.left + to.width / 2),
    y: from.top + from.height / 2 - (to.top + to.height / 2),
    sx: from.width / to.width,
    sy: from.height / to.height,
  };
}

function partsAt(a: Parts, b: Parts, p: number) {
  return `translate(${lerp(a.x, b.x, p)}px, ${lerp(a.y, b.y, p)}px) scale(${lerp(a.sx, b.sx, p)}, ${lerp(a.sy, b.sy, p)})`;
}

function dragScaleFor(dy: number, vh: number) {
  return 1 - Math.min(dy / (vh * 0.55), 1) * 0.3;
}

function isOnScreen(r: DOMRect | null, vh: number): boolean {
  return !!r && r.width > 0 && r.bottom > 0 && r.top < vh;
}

export function Lightbox({
  photos, initialIndex, onClose, onIndexChange, showShare, likedIds, onToggleLike,
  getOrigin, onActiveChange, prepareClose,
}: Props) {
  const { w: vw, h: vh } = useViewport();
  const [index, setIndex] = useState(initialIndex);
  const [chrome, setChrome] = useState(false);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [aspects, setAspects] = useState<Record<string, number>>(() => {
    const p = photos[initialIndex];
    const r = getOrigin?.(initialIndex);
    return p && !(p.width && p.height) && r && r.height ? { [p.id]: r.width / r.height } : {};
  });
  const [zoom, setZoom] = useState<Zoom>(NO_ZOOM);
  const [trackX, setTrackX] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [gesturing, setGesturing] = useState(false);
  const [heart, setHeart] = useState<'like' | 'unlike' | null>(null);
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const pagingRef = useRef(false);
  const heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef({
    mode: null as null | 'page' | 'dismiss' | 'pan' | 'pinch' | 'none',
    startX: 0, startY: 0, startZoom: NO_ZOOM,
    startDist: 0, startMidX: 0, startMidY: 0,
    lastX: 0, lastY: 0, lastT: 0, vx: 0, vy: 0,
    lastTap: 0,
  });

  const photo = photos[index];
  const canShareFiles = useCanShareFiles();
  const canLike = !!onToggleLike;
  const liked = likedIds?.has(photo.id) ?? false;
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  useScrollLock(true);

  const fitFor = useCallback((p: Photo): Box => {
    const aspect = p.width && p.height ? p.width / p.height : aspects[p.id] ?? 1.5;
    const padX = vw < 640 ? 0 : 56;
    const padY = vw < 640 ? 0 : 76;
    const availW = vw - padX * 2;
    const availH = vh - padY * 2;
    let width = availW;
    let height = width / aspect;
    if (height > availH) { height = availH; width = height * aspect; }
    return { left: (vw - width) / 2, top: (vh - height) / 2, width, height };
  }, [aspects, vw, vh]);

  // Latest drag/track values for animations that start outside a render.
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const trackXRef = useRef(trackX);
  trackXRef.current = trackX;
  const releaseVelocity = useRef({ x: 0, y: 0 });
  /** Finishes a paging/snap spring that is still moving, so new input never waits on it. */
  const settleRef = useRef<null | (() => void)>(null);

  // ── Open: zoom out of the tile ─────────────────────────────────────────
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const backdrop = backdropRef.current;
    if (!frame || !backdrop) return;
    const origin = getOrigin?.(initialIndex) ?? null;
    if (prefersReducedMotion()) {
      frame.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    } else if (isOnScreen(origin, window.innerHeight)) {
      const from = boxDelta(origin!, fitFor(photos[initialIndex]));
      const a = animateSpring(frame, p => ({ transform: partsAt(from, IDENTITY_PARTS, p) }), { response: 0.42, damping: 0.86 });
      settled(a).then(() => a.cancel());
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
    } else {
      frame.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    }
    const t = setTimeout(() => setChrome(true), 140);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setZoom(NO_ZOOM);
    onIndexChange?.(index);
    onActiveChange?.(photos[index]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => () => {
    if (heartTimer.current) clearTimeout(heartTimer.current);
    if (tapTimer.current) clearTimeout(tapTimer.current);
  }, []);

  // ── Close: settle back into the tile, carrying the release speed ──────
  const close = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setChrome(false);
    setZoom(NO_ZOOM);
    const frame = frameRef.current;
    const backdrop = backdropRef.current;
    const current = photos[index];

    prepareClose?.(index);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    let origin = getOrigin?.(index) ?? null;
    if (origin && !isOnScreen(origin, window.innerHeight)) {
      // Bring the tile into view behind the viewer so the photo has somewhere to land.
      window.scrollBy({ top: origin.top - window.innerHeight / 2 + origin.height / 2, behavior: 'instant' as ScrollBehavior });
      origin = getOrigin?.(index) ?? null;
    }

    const opacity0 = backdrop ? Number(getComputedStyle(backdrop).opacity) : 1;
    if (!frame || !backdrop) {
      // nothing to animate
    } else if (prefersReducedMotion()) {
      frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' });
      await settled(backdrop.animate([{ opacity: opacity0 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }));
    } else if (isOnScreen(origin, window.innerHeight)) {
      const d = dragRef.current;
      const scale = dragScaleFor(d.y, window.innerHeight);
      const from: Parts = { x: d.x, y: d.y, sx: scale, sy: scale };
      const to = boxDelta(origin!, fitFor(current));
      const dist = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const v = releaseVelocity.current;
      const along = (v.x * (to.x - from.x) + v.y * (to.y - from.y)) / dist; // px/ms toward the tile
      const opts = { response: 0.4, damping: 0.9, velocity: progressVelocity(along, dist) };
      const a = animateSpring(frame, p => ({ transform: partsAt(from, to, p) }), opts);
      animateSpring(backdrop, p => ({ opacity: Math.max(0, opacity0 * (1 - Math.min(1, p) * 1.15)) }), opts);
      await settled(a);
    } else {
      frame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
      await settled(backdrop.animate([{ opacity: opacity0 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
    }
    onClose();
  }, [fitFor, getOrigin, index, onClose, photos, prepareClose]);

  // ── Paging ─────────────────────────────────────────────────────────────
  /** Springs the track back to centre (an aborted or edge swipe). */
  function snapTrack(vx = 0) {
    const track = trackRef.current;
    const start = trackXRef.current;
    if (!track || !start || prefersReducedMotion()) { setTrackX(0); return; }
    pagingRef.current = true;
    const a = animateSpring(track, p => ({ transform: `translate3d(${lerp(start, 0, p)}px, 0, 0)` }),
      { response: 0.36, damping: 0.86, velocity: progressVelocity(vx, -start) });
    let done = false;
    const settle = () => {
      if (done) return;
      done = true;
      settleRef.current = null;
      flushSync(() => setTrackX(0));
      a.cancel();
      pagingRef.current = false;
    };
    settleRef.current = settle;
    settled(a).then(settle);
  }

  const go = useCallback((dir: 1 | -1, vx = 0) => {
    if (closingRef.current) return;
    settleRef.current?.(); // a quick second swipe or key press lands the first one now
    if ((dir === 1 && !hasNext) || (dir === -1 && !hasPrev)) { snapTrack(vx); return; }
    pagingRef.current = true;
    const track = trackRef.current;
    if (!track || prefersReducedMotion()) { finishPage(dir); return; }
    const start = trackXRef.current;
    const target = -dir * (vw + GAP);
    const a = animateSpring(track, p => ({ transform: `translate3d(${lerp(start, target, p)}px, 0, 0)` }),
      { response: 0.38, damping: 0.92, velocity: progressVelocity(vx, target - start) });
    let done = false;
    const settle = () => {
      if (done) return;
      done = true;
      settleRef.current = null;
      finishPage(dir);
      a.cancel();
    };
    settleRef.current = settle;
    settled(a).then(settle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNext, hasPrev, vw]);

  function finishPage(dir: 1 | -1) {
    flushSync(() => {
      setIndex(i => i + dir);
      setTrackX(0);
    });
    pagingRef.current = false;
  }

  /** Springs a cancelled drag-to-dismiss back into place. */
  function snapDrag(vx: number, vy: number) {
    const frame = frameRef.current;
    const d = dragRef.current;
    if (!frame || prefersReducedMotion()) { setDrag({ x: 0, y: 0 }); return; }
    const scale = dragScaleFor(d.y, window.innerHeight);
    const from: Parts = { x: d.x, y: d.y, sx: scale, sy: scale };
    const dist = Math.hypot(d.x, d.y) || 1;
    const along = -(vx * d.x + vy * d.y) / dist;
    const a = animateSpring(frame, p => ({ transform: partsAt(from, IDENTITY_PARTS, p) }),
      { response: 0.38, damping: 0.84, velocity: progressVelocity(along, dist) });
    setDrag({ x: 0, y: 0 });
    settled(a).then(() => a.cancel());
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, close]);

  // ── Gestures ───────────────────────────────────────────────────────────
  const fit = fitFor(photo);

  function clampPan(z: Zoom): Zoom {
    if (z.scale <= 1) return NO_ZOOM;
    const bx = (fit.width * (z.scale - 1)) / 2;
    const by = (fit.height * (z.scale - 1)) / 2;
    return { scale: z.scale, x: Math.max(-bx, Math.min(bx, z.x)), y: Math.max(-by, Math.min(by, z.y)) };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (closingRef.current) return;
    if ((e.target as HTMLElement).closest('[data-chrome]')) return;
    settleRef.current?.(); // grabbing mid-flight lands the moving page first
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = g.current;
    s.startZoom = zoom;
    if (pointers.current.size === 1) {
      s.mode = null;
      s.startX = s.lastX = e.clientX;
      s.startY = s.lastY = e.clientY;
      s.lastT = performance.now();
      s.vx = s.vy = 0;
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      s.mode = 'pinch';
      s.startDist = Math.hypot(a.x - b.x, a.y - b.y);
      s.startMidX = (a.x + b.x) / 2;
      s.startMidY = (a.y + b.y) / 2;
      setTrackX(0);
      setDrag({ x: 0, y: 0 });
    }
    setGesturing(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = g.current;

    if (s.mode === 'pinch' && pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const scale = Math.max(1, Math.min(MAX_SCALE, s.startZoom.scale * (dist / s.startDist)));
      const ratio = scale / s.startZoom.scale;
      setZoom(clampPan({ scale, x: midX - s.startMidX + s.startZoom.x * ratio, y: midY - s.startMidY + s.startZoom.y * ratio }));
      return;
    }

    const now = performance.now();
    const dt = Math.max(1, now - s.lastT);
    s.vx = (e.clientX - s.lastX) / dt;
    s.vy = (e.clientY - s.lastY) / dt;
    s.lastX = e.clientX; s.lastY = e.clientY; s.lastT = now;

    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (s.mode === null && Math.hypot(dx, dy) > TAP_SLOP) {
      if (s.startZoom.scale > 1) s.mode = 'pan';
      else if (Math.abs(dx) > Math.abs(dy)) s.mode = 'page';
      else s.mode = dy > 0 ? 'dismiss' : 'none';
      if (s.mode === 'page' || s.mode === 'dismiss') setChrome(false);
    }

    if (s.mode === 'pan') {
      setZoom(clampPan({ scale: s.startZoom.scale, x: s.startZoom.x + dx, y: s.startZoom.y + dy }));
    } else if (s.mode === 'page') {
      const edge = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
      setTrackX(edge ? dx * 0.32 : dx);
    } else if (s.mode === 'dismiss') {
      setDrag({ x: dx, y: Math.max(0, dy) });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const s = g.current;
    const wasLast = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);

    if (!wasLast) {
      // Pinch ended with one finger down: continue as a pan from here.
      const remaining = Array.from(pointers.current.values())[0];
      s.mode = 'pan';
      s.startZoom = zoom;
      s.startX = remaining.x;
      s.startY = remaining.y;
      return;
    }
    setGesturing(false);
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const mode = s.mode;
    s.mode = null;

    if (mode === 'page') {
      if ((dx < -vw * 0.2 || s.vx < -0.45) && hasNext) go(1, s.vx);
      else if ((dx > vw * 0.2 || s.vx > 0.45) && hasPrev) go(-1, s.vx);
      else snapTrack(s.vx);
      return;
    }
    if (mode === 'dismiss') {
      if (dy > 110 || s.vy > 0.55) { releaseVelocity.current = { x: s.vx, y: s.vy }; close(); return; }
      snapDrag(s.vx, s.vy);
      setChrome(true);
      return;
    }
    if (mode !== null) return;

    // A tap: double-tap likes (or zooms when liking is off); a single tap toggles the controls.
    const now = Date.now();
    if (now - s.lastTap < DOUBLE_TAP_MS) {
      s.lastTap = 0;
      if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
      if (canLike) toggleLike(true);
      else if (zoom.scale > 1) setZoom(NO_ZOOM);
      else {
        const fx = e.clientX - (fit.left + fit.width / 2);
        const fy = e.clientY - (fit.top + fit.height / 2);
        setZoom(clampPan({ scale: DOUBLE_TAP_SCALE, x: fx * (1 - DOUBLE_TAP_SCALE), y: fy * (1 - DOUBLE_TAP_SCALE) }));
      }
      return;
    }
    s.lastTap = now;
    tapTimer.current = setTimeout(() => { tapTimer.current = null; setChrome(c => !c); }, DOUBLE_TAP_MS);
  }

  function onPointerCancel(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setGesturing(false);
      g.current.mode = null;
      setTrackX(0);
      setDrag({ x: 0, y: 0 });
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────
  function toggleLike(burst: boolean) {
    if (!onToggleLike) return;
    if (burst) {
      setHeart(liked ? 'unlike' : 'like');
      if (heartTimer.current) clearTimeout(heartTimer.current);
      heartTimer.current = setTimeout(() => setHeart(null), 820);
    }
    onToggleLike(photo.id);
  }

  // On share-capable touch devices hand the file to the OS sheet ("Save Image"
  // → Photos); fall back to the direct download URL if that can't complete.
  async function handleSave() {
    if (!photo.downloadUrl) return;
    setSaving(true);
    try {
      const result = await sharePhotos([{ filename: photo.filename, downloadUrl: photo.downloadUrl }]);
      if (result.outcome === 'error' || result.outcome === 'no_activation') {
        window.location.href = photo.downloadUrl;
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}${window.location.pathname}?photo=${photo.id}`;
    if (navigator.share) {
      try { await navigator.share({ url }); } catch { /* sheet dismissed */ }
    } else {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1600);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const dismissProgress = Math.min(drag.y / (vh * 0.55), 1);
  const dragScale = dragScaleFor(drag.y, vh);
  const frameTransform = drag.x || drag.y ? `translate(${drag.x}px, ${drag.y}px) scale(${dragScale})` : 'none';
  const slides = [-1, 0, 1]
    .map(offset => ({ offset, p: photos[index + offset] }))
    .filter((s): s is { offset: number; p: Photo } => !!s.p);

  const chromeClass = `transition-opacity duration-200 ease-out ${chrome ? 'opacity-100' : 'pointer-events-none opacity-0'}`;
  const barButton = 'flex h-11 w-11 items-center justify-center rounded-full text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-90 disabled:opacity-40';

  return createPortal(
    <FocusTrap focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: false, allowOutsideClick: true, fallbackFocus: () => document.body }}>
      <div role="dialog" aria-modal="true" aria-label={photo.filename} className="fixed inset-0 z-50 select-none overflow-hidden text-white">
        <div
          ref={backdropRef}
          className="absolute inset-0 bg-black"
          style={{ opacity: 1 - dismissProgress * 0.85, transition: gesturing ? 'none' : 'opacity 300ms ease-out' }}
        />

        <div
          className="absolute inset-0"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div ref={trackRef} className="absolute inset-0" style={{ transform: `translate3d(${trackX}px, 0, 0)` }}>
            {slides.map(({ offset, p }) => {
              const box = fitFor(p);
              const isCurrent = offset === 0;
              const showOriginal = isCurrent || loaded.has(p.id);
              return (
                <div key={p.id} className="absolute inset-0" style={{ transform: `translate3d(${offset * (vw + GAP)}px, 0, 0)` }}>
                  <div
                    ref={isCurrent ? frameRef : undefined}
                    className="absolute will-change-transform"
                    style={{
                      left: box.left, top: box.top, width: box.width, height: box.height,
                      transform: isCurrent ? frameTransform : 'none',
                    }}
                  >
                    <div
                      className="relative h-full w-full"
                      style={{
                        transform: isCurrent && zoom.scale > 1 ? `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` : 'none',
                        transition: gesturing ? 'none' : `transform 260ms ${EASE}`,
                      }}
                    >
                      <img
                        src={p.url}
                        alt=""
                        draggable={false}
                        className="absolute inset-0 h-full w-full object-cover"
                        onLoad={e => {
                          const img = e.currentTarget;
                          if (!(p.width && p.height) && img.naturalHeight) {
                            setAspects(a => (a[p.id] ? a : { ...a, [p.id]: img.naturalWidth / img.naturalHeight }));
                          }
                        }}
                      />
                      {showOriginal && p.originalUrl && (
                        <img
                          src={p.originalUrl}
                          alt={p.filename}
                          draggable={false}
                          decoding="async"
                          onLoad={() => setLoaded(prev => (prev.has(p.id) ? prev : new Set(prev).add(p.id)))}
                          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out ${loaded.has(p.id) ? 'opacity-100' : 'opacity-0'}`}
                        />
                      )}
                      {isCurrent && !loaded.has(p.id) && p.originalUrl && (
                        <div className="absolute bottom-3 right-3 text-white/70"><Spinner size={16} /></div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {heart && (
            <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`animate-heart-pop relative ${heart === 'like' ? 'text-heart' : 'text-white/80'}`}>
                <HeartIcon size={96} filled className="drop-shadow-[0_4px_16px_rgba(0,0,0,0.4)]" />
                {heart === 'unlike' && (
                  <span className="absolute left-1/2 top-1/2 h-1 w-[110px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white/90" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Top bar */}
        <div data-chrome className={`absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent pb-6 pt-[env(safe-area-inset-top)] ${chromeClass}`}>
          <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-2 sm:px-4">
            <button type="button" onClick={close} aria-label="Close" className={barButton}>
              <CloseIcon size={20} />
            </button>
            <p className="text-subhead tabular-nums text-white/80" aria-live="polite">
              {index + 1} of {photos.length}
            </p>
            <span />
          </div>
        </div>

        {/* Side arrows on pointer devices */}
        {hasPrev && (
          <button data-chrome type="button" onClick={() => go(-1)} aria-label="Previous photo"
            className={`absolute left-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 active:scale-90 md:flex ${chromeClass}`}>
            <ChevronLeftIcon size={20} />
          </button>
        )}
        {hasNext && (
          <button data-chrome type="button" onClick={() => go(1)} aria-label="Next photo"
            className={`absolute right-4 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 active:scale-90 md:flex ${chromeClass}`}>
            <ChevronRightIcon size={20} />
          </button>
        )}

        {/* Bottom bar */}
        <div data-chrome className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent pb-[max(10px,env(safe-area-inset-bottom))] pt-8 ${chromeClass}`}>
          <div className="mx-auto flex h-14 max-w-md items-center justify-around px-4">
            {showShare && (
              <button type="button" onClick={handleShare} aria-label={shared ? 'Link copied' : 'Share link'} className={barButton}>
                {shared ? <span className="animate-pop text-footnote font-semibold">Copied</span> : <ShareIcon size={22} />}
              </button>
            )}
            {canLike && (
              <button type="button" onClick={() => toggleLike(false)} aria-label={liked ? 'Unlike photo' : 'Like photo'} aria-pressed={liked} className={barButton}>
                <HeartIcon size={24} filled={liked} className={`transition-colors duration-150 ${liked ? 'text-heart' : ''}`} />
              </button>
            )}
            {photo.downloadUrl && (
              canShareFiles ? (
                <button type="button" onClick={handleSave} disabled={saving} aria-label="Save photo" className={barButton}>
                  {saving ? <Spinner size={20} /> : <DownloadIcon size={22} />}
                </button>
              ) : (
                <a href={photo.downloadUrl} download={photo.filename} aria-label="Download photo" className={barButton}>
                  <DownloadIcon size={22} />
                </a>
              )
            )}
          </div>
        </div>
      </div>
    </FocusTrap>,
    document.body
  );
}
