'use client';

import { useEffect, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { useCanShareFiles, sharePhotos } from '@/lib/share';

interface Photo { id: string; filename: string; url: string; originalUrl?: string; downloadUrl?: string; collectionId?: string; }

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
}

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_DISTANCE = 50;
const SWIPE_DOWN_DISTANCE = 80;
const TAP_SLOP = 10;
const DOUBLE_TAP_MS = 300;

interface Transform { scale: number; x: number; y: number; }
const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

export function Lightbox({ photos, initialIndex, onClose, onIndexChange, showShare, likedIds, onToggleLike }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [loaded, setLoaded] = useState(false);
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [heart, setHeart] = useState<'like' | 'unlike' | null>(null);
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [gesturing, setGesturing] = useState(false);
  const photo = photos[index];
  const canShareFiles = useCanShareFiles();
  const canLike = !!onToggleLike;
  const liked = likedIds?.has(photo.id) ?? false;

  const imgRef = useRef<HTMLImageElement>(null);
  const heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    startTransform: IDENTITY,
    startX: 0, startY: 0,       // single-pointer start
    startDist: 0,                // pinch start distance
    startMidX: 0, startMidY: 0,  // pinch start midpoint
    moved: false,
    lastTapTime: 0,
  });

  useEffect(() => {
    setLoaded(false);
    setTransform(IDENTITY);
    onIndexChange?.(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, photos.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length, onClose]);

  // Clear a pending heart-burst timer if the lightbox unmounts mid-animation.
  useEffect(() => () => { if (heartTimer.current) clearTimeout(heartTimer.current); }, []);

  /** Keep a zoomed image from being panned fully off-screen. */
  function clampPan(t: Transform): Transform {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect || t.scale <= 1) return { ...t, x: t.scale <= 1 ? 0 : t.x, y: t.scale <= 1 ? 0 : t.y };
    // rect is the already-scaled box; recover the base size to compute bounds
    const baseW = rect.width / transform.scale;
    const baseH = rect.height / transform.scale;
    const boundX = (baseW * (t.scale - 1)) / 2;
    const boundY = (baseH * (t.scale - 1)) / 2;
    return {
      scale: t.scale,
      x: Math.max(-boundX, Math.min(boundX, t.x)),
      y: Math.max(-boundY, Math.min(boundY, t.y)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    g.startTransform = transform;
    g.moved = false;
    setGesturing(true);

    if (pointers.current.size === 1) {
      g.startX = e.clientX;
      g.startY = e.clientY;
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      g.startDist = Math.hypot(a.x - b.x, a.y - b.y);
      g.startMidX = (a.x + b.x) / 2;
      g.startMidY = (a.y + b.y) / 2;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (pointers.current.size === 2) {
      // Pinch: scale about the fingers' midpoint, follow midpoint drift
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const scale = Math.max(1, Math.min(MAX_SCALE, g.startTransform.scale * (dist / g.startDist)));
      const ratio = scale / g.startTransform.scale;
      setTransform(clampPan({
        scale,
        x: midX - g.startMidX + g.startTransform.x * ratio,
        y: midY - g.startMidY + g.startTransform.y * ratio,
      }));
      g.moved = true;
      return;
    }

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;

    if (g.startTransform.scale > 1) {
      // Pan while zoomed
      setTransform(clampPan({
        scale: g.startTransform.scale,
        x: g.startTransform.x + dx,
        y: g.startTransform.y + dy,
      }));
    } else if (g.moved) {
      // Swipe feedback at rest scale: let the image follow the finger
      setTransform({ scale: 1, x: dx, y: 0 });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const g = gesture.current;
    const wasLast = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (!wasLast) {
      // Pinch ended but one finger remains — re-anchor so panning doesn't jump
      const remaining = Array.from(pointers.current.values())[0];
      g.startTransform = transform;
      g.startX = remaining.x;
      g.startY = remaining.y;
      g.moved = true;
      return;
    }
    setGesturing(false);

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (g.startTransform.scale === 1 && g.moved) {
      // Swipe: horizontal → navigate, downward → close
      if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0 && index < photos.length - 1) { setIndex(index + 1); return; }
        if (dx > 0 && index > 0) { setIndex(index - 1); return; }
      } else if (dy > SWIPE_DOWN_DISTANCE && Math.abs(dy) > Math.abs(dx)) {
        onClose();
        return;
      }
      setTransform(IDENTITY); // rebound
      return;
    }

    if (!g.moved) {
      const now = Date.now();
      if (now - g.lastTapTime < DOUBLE_TAP_MS) {
        g.lastTapTime = 0;
        if (canLike) {
          // Double-tap likes when liking is enabled (heart-burst mirrors the grid).
          toggleLike(true);
        } else if (transform.scale > 1) {
          setTransform(IDENTITY);
        } else {
          // Zoom in about the tap point
          const rect = imgRef.current?.getBoundingClientRect();
          const fx = rect ? e.clientX - (rect.left + rect.width / 2) : 0;
          const fy = rect ? e.clientY - (rect.top + rect.height / 2) : 0;
          setTransform(clampPan({
            scale: DOUBLE_TAP_SCALE,
            x: fx * (1 - DOUBLE_TAP_SCALE),
            y: fy * (1 - DOUBLE_TAP_SCALE),
          }));
        }
      } else {
        g.lastTapTime = now;
      }
    }
  }

  function onPointerCancel(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setGesturing(false);
      if (transform.scale <= 1) setTransform(IDENTITY);
    }
  }

  function triggerHeartBurst(kind: 'like' | 'unlike') {
    setHeart(kind);
    if (heartTimer.current) clearTimeout(heartTimer.current);
    heartTimer.current = setTimeout(() => setHeart(null), 700);
  }

  // `burst` distinguishes the double-tap gesture (animates) from the action-row
  // button (no burst) — matching the grid. `liked` is read before the toggle.
  function toggleLike(burst: boolean) {
    if (!onToggleLike) return;
    if (burst) triggerHeartBurst(liked ? 'unlike' : 'like');
    onToggleLike(photo.id);
  }

  // Adaptive "Download" on share-capable touch devices: hand the file to the OS
  // sheet ("Save Image" → Photos, or Save to Files). Falls back to the direct
  // download URL if the share can't be completed.
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
      try { await navigator.share({ url }); } catch { /* user dismissed the sheet */ }
    } else {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    }
  }

  return (
    <FocusTrap focusTrapOptions={{ onDeactivate: onClose, clickOutsideDeactivates: true }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={photo.filename}
        className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative flex flex-col items-center max-w-5xl w-full"
          onClick={e => e.stopPropagation()}
        >
          <div
            className="relative max-w-full overflow-hidden select-none"
            style={{ touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <img
              ref={imgRef}
              src={photo.originalUrl ?? photo.url}
              alt={photo.filename}
              onLoad={() => setLoaded(true)}
              draggable={false}
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transition: gesturing ? 'none' : 'transform 200ms, opacity 300ms',
              }}
              className={`max-h-[80vh] max-w-full object-contain ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {/* Heart burst on double-tap-to-like — pink for like, gray crossed-out for unlike */}
            {heart && (
              <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg
                  className="animate-heart-burst drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                  width="84" height="84" viewBox="0 0 24 24"
                  fill={heart === 'like' ? '#ff4d6d' : '#8f8f8f'}
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  {heart === 'unlike' && (
                    <line x1="3.5" y1="3.5" x2="20.5" y2="20.5" stroke="#1a1a1a" strokeWidth="2.4" strokeLinecap="round" />
                  )}
                </svg>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center w-full mt-4 px-2">
            <div className="flex gap-4">
              <button
                onClick={() => setIndex(i => Math.max(i - 1, 0))}
                disabled={index === 0}
                aria-label="Previous photo"
                className="text-[#777] hover:text-[#bbb] disabled:opacity-30 text-sm transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setIndex(i => Math.min(i + 1, photos.length - 1))}
                disabled={index === photos.length - 1}
                aria-label="Next photo"
                className="text-[#777] hover:text-[#bbb] disabled:opacity-30 text-sm transition-colors"
              >
                Next →
              </button>
            </div>
            <div className="flex gap-4 items-center">
              {canLike && (
                <button
                  onClick={() => toggleLike(false)}
                  aria-label={liked ? 'Unlike photo' : 'Like photo'}
                  className="group/heart flex items-center transition-colors"
                >
                  <svg
                    width="16" height="16" viewBox="0 0 24 24"
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-colors duration-150 ${liked ? 'fill-[#ff4d6d] stroke-none' : 'fill-none stroke-[#777] group-hover/heart:stroke-[#bbb]'}`}
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>
              )}
              {showShare && (
                <button
                  onClick={handleShare}
                  aria-label="Share photo"
                  className="text-[#777] hover:text-[#bbb] text-sm transition-colors"
                >
                  {shared ? 'Copied' : 'Share'}
                </button>
              )}
              {photo.downloadUrl && (
                canShareFiles ? (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="text-[#777] hover:text-[#bbb] text-sm transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Download'}
                  </button>
                ) : (
                  <a
                    href={photo.downloadUrl}
                    download={photo.filename}
                    className="text-[#777] hover:text-[#bbb] text-sm transition-colors"
                  >
                    Download
                  </a>
                )
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Back to gallery"
          className="absolute top-4 left-4 text-[#777] hover:text-[#bbb] text-sm transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onClose}
          aria-label="Close lightbox"
          className="absolute top-4 right-4 text-[#777] hover:text-[#bbb] text-2xl leading-none transition-colors"
        >
          ×
        </button>
      </div>
    </FocusTrap>
  );
}
