'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { MasonryGrid, findTileImage } from './MasonryGrid';
import { Lightbox } from './Lightbox';
import { KudosButton } from './KudosButton';
import { CommentSection } from './CommentSection';
import { ScrollToTop } from './ScrollToTop';
import { PageHeader } from './PageHeader';
import { Sheet } from './Sheet';
import { FloatingBar, ProgressTrack } from './FloatingBar';
import { CommentIcon, DownloadIcon, MinusIcon, PlusIcon, PhotoStackIcon } from './icons';
import { prefersReducedMotion } from './usePresence';
import { downloadPhotosAsZip } from '@/lib/zip';
import { useCanShareFiles, sharePhotos } from '@/lib/share';

const BATCH_SIZE = 24;
// Above this count, keep using the zip even on share-capable devices — pushing
// hundreds of files through the OS share sheet is unreliable and memory-heavy.
// Small/medium saves go straight to the native "Save to Photos" sheet.
const MAX_SHARE_FILES = 50;
const MIN_SIZE = 1;
const MAX_SIZE = 4;

export interface GalleryPhoto {
  id: string;
  filename: string;
  url: string;            // thumbnail — for masonry grid
  originalUrl: string;    // full quality — for lightbox
  downloadUrl: string;    // presigned, forces attachment download
  width?: number;         // thumbnail pixel width (stored at upload time)
  height?: number;        // thumbnail pixel height (stored at upload time)
  dominantColor?: string; // average color sampled at upload time, e.g. "#a3b4c5"
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  username: string;
}

interface Props {
  collectionId: string;
  collectionName: string;
  subtitle: string;
  photos: GalleryPhoto[];
  kudosCount: number;
  hasKudos: boolean;
  loggedIn: boolean;
  comments: Comment[];
  currentUsername: string | null;
  likedPhotoIds?: string[];
  /** Server-rendered account control for the header. */
  accountMenu: React.ReactNode;
}

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

export function GalleryClient({
  collectionId,
  collectionName,
  subtitle,
  photos,
  kudosCount,
  hasKudos,
  loggedIn,
  comments,
  currentUsername,
  likedPhotoIds,
  accountMenu,
}: Props) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set(likedPhotoIds ?? []));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(comments.length);
  const [downloading, setDownloading] = useState(false);
  const [zipProgress, setZipProgress] = useState(0); // 0–1
  const [downloadError, setDownloadError] = useState('');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [sizeLevel, setSizeLevel] = useState(2); // photo size 1 (small) – 4 (large)
  const [sharing, setSharing] = useState(false); // share path active (vs. zip) — drives progress label
  const [pendingFiles, setPendingFiles] = useState<File[]>([]); // iOS retap: fetched files awaiting a fresh gesture
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const canShareFiles = useCanShareFiles();

  const hasMore = visibleCount < photos.length;
  const visiblePhotos = photos.slice(0, visibleCount);

  // Restore photo size after mount (not in the initializer — SSR markup must match)
  useEffect(() => {
    const stored = Number(localStorage.getItem('gallery-size'));
    if (stored >= MIN_SIZE && stored <= MAX_SIZE) setSizeLevel(stored);
  }, []);

  /**
   * Step the grid size. The visible tiles glide to their new places in a view
   * transition, and the photo at the top of the screen stays put.
   */
  function changeSize(next: number) {
    const level = Math.min(MAX_SIZE, Math.max(MIN_SIZE, next));
    if (level === sizeLevel) return;
    try { localStorage.setItem('gallery-size', String(level)); } catch { /* storage blocked */ }

    const order = new Map(photos.map((p, i) => [p.id, i]));
    const tiles = Array.from(document.querySelectorAll<HTMLElement>('[data-photo-id]'));
    const onScreen = tiles.filter(t => {
      const r = t.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    });
    const anchor = onScreen
      .filter(t => t.getBoundingClientRect().bottom > 64)
      .sort((a, b) => (order.get(a.dataset.photoId!) ?? 0) - (order.get(b.dataset.photoId!) ?? 0))[0];
    const anchorTop = anchor?.getBoundingClientRect().top ?? 0;

    const named = new Set(onScreen.map(t => t.dataset.photoId!));
    const anchorId = anchor?.dataset.photoId;
    let renamed: HTMLElement[] = [];

    const apply = () => {
      flushSync(() => setSizeLevel(level));
      // Changing the column count remounts tiles in new columns, so the new
      // elements need the same names for the browser to glide old → new.
      renamed = Array.from(document.querySelectorAll<HTMLElement>('[data-photo-id]'))
        .filter(t => named.has(t.dataset.photoId!));
      renamed.forEach(t => { t.style.setProperty('view-transition-name', `ph-${t.dataset.photoId}`); });
      const newAnchor = anchorId ? document.querySelector<HTMLElement>(`[data-photo-id="${anchorId}"]`) : null;
      if (newAnchor && window.scrollY > 0) {
        window.scrollBy(0, newAnchor.getBoundingClientRect().top - anchorTop);
      }
    };

    const doc = document as DocWithVT;
    if (!doc.startViewTransition || prefersReducedMotion()) { apply(); renamed.forEach(t => t.style.removeProperty('view-transition-name')); return; }
    onScreen.forEach(t => { t.style.setProperty('view-transition-name', `ph-${t.dataset.photoId}`); });
    doc.startViewTransition(apply).finished.finally(() => {
      [...onScreen, ...renamed].forEach(t => { t.style.removeProperty('view-transition-name'); });
    });
  }

  // Deep link: /c/[id]/gallery?photo=<id> opens the lightbox on that photo
  useEffect(() => {
    const photoId = new URLSearchParams(window.location.search).get('photo');
    if (!photoId) return;
    const idx = photos.findIndex(p => p.id === photoId);
    if (idx >= 0) setLightboxIndex(idx);
  }, [photos]);

  // Keep ?photo= in sync with the lightbox without adding history entries
  function syncPhotoParam(photoId: string | null) {
    const url = new URL(window.location.href);
    if (photoId) url.searchParams.set('photo', photoId);
    else url.searchParams.delete('photo');
    window.history.replaceState(null, '', url);
  }

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + BATCH_SIZE, photos.length));
  }, [photos.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '800px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function handleTap(index: number) {
    if (selectionMode) toggleSelect(photos[index].id);
    else setLightboxIndex(index);
  }

  async function handleToggleLike(photoId: string) {
    if (!loggedIn) return;
    const wasLiked = likedIds.has(photoId);
    setLikedIds(prev => {
      const next = new Set(prev);
      if (wasLiked) next.delete(photoId); else next.add(photoId);
      return next;
    });
    try {
      const res = await fetch(`/api/photos/${photoId}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('Like failed');
    } catch {
      setLikedIds(prev => {
        const next = new Set(prev);
        if (wasLiked) next.add(photoId); else next.delete(photoId);
        return next;
      });
    }
  }

  // Lightbox ↔ grid hand-off: where to zoom from, and making sure the tile
  // exists (it may be past the loaded batch) before zooming back into it.
  const getOrigin = useCallback((i: number) => {
    const p = photos[i];
    return p ? findTileImage(p.id)?.getBoundingClientRect() ?? null : null;
  }, [photos]);

  const prepareClose = useCallback((i: number) => {
    if (i >= visibleCount) {
      flushSync(() => setVisibleCount(Math.min(photos.length, i + BATCH_SIZE)));
    }
  }, [visibleCount, photos.length]);

  function cancelDownload() {
    abortRef.current?.abort();
  }

  async function downloadPhotos(photoList: GalleryPhoto[], zipName: string) {
    const controller = new AbortController();
    abortRef.current = controller;
    setDownloading(true);
    setZipProgress(0);
    setDownloadError('');

    try {
      const failed = await downloadPhotosAsZip(photoList, zipName, controller.signal, setZipProgress);
      if (failed > 0 && !controller.signal.aborted) {
        setDownloadError(
          failed === photoList.length
            ? 'Download failed. Please try again.'
            : `${failed} of ${photoList.length} photos couldn't be downloaded and were left out of the zip.`
        );
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        console.error('Download failed', err);
        setDownloadError('Download failed. Please try again.');
      }
    } finally {
      abortRef.current = null;
      setDownloading(false);
      setZipProgress(0);
      exitSelection();
    }
  }

  // On share-capable touch devices, saving hands the files to the OS sheet
  // ("Save to Photos"/"Save to Files"); otherwise it falls back to the zip.
  // Large requests always zip (see MAX_SHARE_FILES).
  function getPhotos(photoList: GalleryPhoto[], zipName: string) {
    if (canShareFiles && photoList.length <= MAX_SHARE_FILES) {
      return savePhotosToDevice(photoList);
    }
    return downloadPhotos(photoList, zipName);
  }

  async function savePhotosToDevice(photoList: GalleryPhoto[]) {
    const controller = new AbortController();
    abortRef.current = controller;
    setDownloading(true);
    setSharing(true);
    setZipProgress(0);
    setDownloadError('');
    setPendingFiles([]);

    try {
      const result = await sharePhotos(photoList, { onProgress: setZipProgress, signal: controller.signal });
      if (result.outcome === 'no_activation') {
        // iOS dropped the gesture during the fetch — keep the files for a retap.
        setPendingFiles(result.files);
      } else if (result.outcome === 'error') {
        setDownloadError('Couldn’t prepare photos. Please try again.');
      } else if (result.outcome === 'shared') {
        if (result.failed > 0) {
          setDownloadError(`${result.failed} of ${photoList.length} photos couldn’t be prepared and were left out.`);
        }
        exitSelection();
      }
      // 'canceled' → no-op
    } finally {
      abortRef.current = null;
      setDownloading(false);
      setSharing(false);
      setZipProgress(0);
    }
  }

  // Second tap re-establishes a fresh user activation, so share the already
  // fetched files synchronously (no awaited work before navigator.share).
  async function retapShare() {
    const files = pendingFiles;
    setPendingFiles([]);
    const result = await sharePhotos([], { preparedFiles: files });
    if (result.outcome === 'error') {
      setDownloadError('Couldn’t save photos. Please try again.');
    } else if (result.outcome === 'shared') {
      exitSelection();
    }
  }

  const slugName = collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photos';
  const selectedPhotos = photos.filter(p => selectedIds.has(p.id));
  const savesToDevice = (n: number) => canShareFiles && n <= MAX_SHARE_FILES;
  const allLabel = savesToDevice(photos.length) ? 'Save All' : 'Download All';
  const barOpen = selectionMode || downloading || pendingFiles.length > 0;

  const toolbar = photos.length > 0 && (
    <div className="flex items-center justify-between gap-2 lg:gap-5">
      <div className="flex items-center gap-2">
        <KudosButton collectionId={collectionId} initialCount={kudosCount} initialHasKudos={hasKudos} loggedIn={loggedIn} />
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          aria-label={commentCount > 0 ? `Comments (${commentCount})` : 'Comments'}
          className={`btn btn-sm btn-tinted gap-1.5 tabular-nums ${commentCount > 0 ? 'px-3' : 'w-8 px-0'}`}
        >
          <CommentIcon size={17} />
          {commentCount > 0 && commentCount}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-8 items-center rounded-full bg-fill" role="group" aria-label="Photo size">
          <button
            type="button"
            onClick={() => changeSize(sizeLevel - 1)}
            disabled={sizeLevel <= MIN_SIZE}
            aria-label="Smaller photos"
            className="flex h-8 w-9 items-center justify-center rounded-full text-label transition-[transform,opacity] duration-150 active:scale-90 disabled:opacity-30"
          >
            <MinusIcon size={15} />
          </button>
          <span className="h-4 w-px bg-separator" aria-hidden />
          <button
            type="button"
            onClick={() => changeSize(sizeLevel + 1)}
            disabled={sizeLevel >= MAX_SIZE}
            aria-label="Larger photos"
            className="flex h-8 w-9 items-center justify-center rounded-full text-label transition-[transform,opacity] duration-150 active:scale-90 disabled:opacity-30"
          >
            <PlusIcon size={15} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => getPhotos(photos, slugName)}
          disabled={downloading}
          aria-label={allLabel}
          className="btn btn-sm btn-tinted gap-1.5 px-3"
        >
          <DownloadIcon size={17} />
          <span className="hidden sm:inline">{allLabel}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        width="wide"
        title={collectionName}
        subtitle={subtitle}
        back={{ href: '/', label: 'Collections' }}
        actions={
          <>
            {photos.length > 0 && (
              <button
                type="button"
                onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
                className={`btn-plain px-1 py-2 ${selectionMode ? 'font-semibold' : ''}`}
              >
                {selectionMode ? 'Done' : 'Select'}
              </button>
            )}
            {accountMenu}
          </>
        }
        toolbar={toolbar}
      />

      {downloadError && (
        <p role="alert" className="animate-rise mx-auto mb-3 w-full px-4 text-footnote text-destructive sm:px-6 lg:px-8">
          {downloadError}
        </p>
      )}

      {photos.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-24 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fill text-label2">
            <PhotoStackIcon size={26} />
          </span>
          <p className="text-headline">No Photos Yet</p>
          <p className="mt-1 text-subhead text-label2">Photos from this event will appear here.</p>
        </div>
      ) : (
        <div className="pb-28 sm:px-6 lg:px-8">
          <MasonryGrid
            photos={visiblePhotos}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onTap={handleTap}
            likedIds={likedIds}
            onToggleLike={loggedIn ? handleToggleLike : undefined}
            sizeLevel={sizeLevel}
            hiddenId={hiddenId}
            onDensityStep={dir => changeSize(sizeLevel + dir)}
          />
          {hasMore && <div ref={sentinelRef} className="h-px" />}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          getOrigin={getOrigin}
          prepareClose={prepareClose}
          onActiveChange={setHiddenId}
          onClose={() => { setLightboxIndex(null); setHiddenId(null); syncPhotoParam(null); }}
          onIndexChange={i => syncPhotoParam(photos[i].id)}
          showShare
          likedIds={likedIds}
          onToggleLike={loggedIn ? handleToggleLike : undefined}
        />
      )}

      <Sheet open={commentsOpen} onClose={() => setCommentsOpen(false)} title="Comments">
        <CommentSection
          collectionId={collectionId}
          initialComments={comments}
          currentUsername={currentUsername}
          onCountChange={setCommentCount}
        />
      </Sheet>

      <FloatingBar open={barOpen}>
        {downloading ? (
          <>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between text-subhead">
                <span className="font-semibold">{sharing ? 'Preparing Photos' : 'Zipping Photos'}</span>
                <span className="tabular-nums text-label2">{Math.round(zipProgress * 100)}%</span>
              </div>
              <ProgressTrack value={zipProgress} />
            </div>
            <button type="button" onClick={cancelDownload} className="btn-plain shrink-0 pl-2">Cancel</button>
          </>
        ) : pendingFiles.length > 0 ? (
          <>
            <span className="flex-1 text-subhead">
              {pendingFiles.length} {pendingFiles.length === 1 ? 'photo is' : 'photos are'} ready
            </span>
            <button type="button" onClick={retapShare} className="btn btn-sm btn-filled">Save</button>
          </>
        ) : (
          <>
            <span className="flex-1 text-subhead font-semibold tabular-nums">
              {selectedIds.size === 0 ? 'Select Photos' : `${selectedIds.size} Selected`}
            </span>
            <button
              type="button"
              onClick={() => getPhotos(selectedPhotos, slugName)}
              disabled={selectedIds.size === 0}
              className="btn btn-sm btn-filled gap-1.5"
            >
              <DownloadIcon size={16} strokeWidth={2} />
              {savesToDevice(selectedIds.size || 1) ? 'Save' : 'Download'}
            </button>
          </>
        )}
      </FloatingBar>

      <ScrollToTop hidden={barOpen || lightboxIndex !== null} />
    </>
  );
}
