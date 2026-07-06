'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MasonryGrid } from './MasonryGrid';
import { Lightbox } from './Lightbox';
import { KudosButton } from './KudosButton';
import { CommentSection } from './CommentSection';
import { ScrollToTop } from './ScrollToTop';
import { downloadPhotosAsZip } from '@/lib/zip';

const BATCH_SIZE = 24;

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
  photos: GalleryPhoto[];
  kudosCount: number;
  hasKudos: boolean;
  loggedIn: boolean;
  comments: Comment[];
  currentUsername: string | null;
  likedPhotoIds?: string[];
}

export function GalleryClient({
  collectionId,
  collectionName,
  photos,
  kudosCount,
  hasKudos,
  loggedIn,
  comments,
  currentUsername,
  likedPhotoIds,
}: Props) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set(likedPhotoIds ?? []));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(comments.length);
  const [downloading, setDownloading] = useState(false);
  const [zipProgress, setZipProgress] = useState(0); // 0–1
  const [downloadError, setDownloadError] = useState('');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [sizeLevel, setSizeLevel] = useState(2); // photo size 1 (small) – 4 (large)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasMore = visibleCount < photos.length;
  const visiblePhotos = photos.slice(0, visibleCount);

  // Restore photo size after mount (not in the initializer — SSR markup must match)
  useEffect(() => {
    const stored = Number(localStorage.getItem('gallery-size'));
    if (stored >= 1 && stored <= 4) setSizeLevel(stored);
  }, []);

  function handleSizeChange(level: number) {
    setSizeLevel(level);
    localStorage.setItem('gallery-size', String(level));
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
      { rootMargin: '600px' }
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
    if (selectionMode) {
      toggleSelect(photos[index].id);
    } else {
      setLightboxIndex(index);
    }
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

  function handleDoubleTap(index: number) {
    handleToggleLike(photos[index].id);
  }

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

  const slugName = collectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photos';
  const selectedPhotos = photos.filter(p => selectedIds.has(p.id));

  return (
    <>
      {/* Action row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <KudosButton
            collectionId={collectionId}
            initialCount={kudosCount}
            initialHasKudos={hasKudos}
            loggedIn={loggedIn}
          />
          <button
            onClick={() => setCommentsOpen(o => !o)}
            className="flex items-center gap-1.5 group transition-colors"
            aria-label="Toggle comments"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-colors duration-150 ${commentsOpen ? 'stroke-[#bbb]' : 'stroke-[#666] group-hover:stroke-[#888]'}`}>
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </svg>
            <span className={`text-xs font-light transition-colors ${commentsOpen ? 'text-[#bbb]' : 'text-[#666] group-hover:text-[#888]'}`}>
              {commentCount}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-4">
          {selectionMode ? (
            <button
              onClick={exitSelection}
              className="text-[#666] text-xs hover:text-[#888] transition-colors"
            >
              Cancel
            </button>
          ) : (
            <>
              <div className="flex items-center gap-1.5" title="Photo size">
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
                  <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="#555" />
                </svg>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={sizeLevel}
                  onChange={e => handleSizeChange(Number(e.target.value))}
                  aria-label="Photo size"
                  className="w-14 sm:w-20 accent-[#888] cursor-pointer"
                />
                <svg width="14" height="14" viewBox="0 0 10 10" fill="none" aria-hidden>
                  <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="#555" />
                </svg>
              </div>
              <button
                onClick={() => setSelectionMode(true)}
                className="text-[#666] text-xs hover:text-[#888] transition-colors"
              >
                Select
              </button>
              <button
                onClick={() => downloadPhotos(photos, slugName)}
                disabled={downloading}
                className="text-[#666] text-xs hover:text-[#888] transition-colors disabled:opacity-50"
              >
                {downloading ? 'Zipping…' : 'Download all'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Zip progress bar */}
      {downloading && (
        <div className="mb-4 space-y-1">
          <div className="flex justify-between text-[#555] text-xs">
            <span>Zipping…</span>
            <div className="flex items-center gap-3">
              <span>{Math.round(zipProgress * 100)}%</span>
              <button onClick={cancelDownload} className="text-[#444] hover:text-[#666] transition-colors">
                Cancel
              </button>
            </div>
          </div>
          <div className="h-px bg-[#1e1e1e] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#555] transition-all duration-200"
              style={{ width: `${zipProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {downloadError && <p className="text-red-500/70 text-xs mb-4">{downloadError}</p>}

      {/* Comments — expands above grid */}
      {commentsOpen && (
        <CommentSection
          collectionId={collectionId}
          initialComments={comments}
          currentUsername={currentUsername}
          onCountChange={setCommentCount}
        />
      )}

      {/* Grid */}
      {photos.length === 0 ? (
        <p className="text-[#555] text-sm font-light mt-4">No photos yet.</p>
      ) : (
        <>
          <MasonryGrid
            photos={visiblePhotos}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onTap={handleTap}
            onDoubleTap={loggedIn ? handleDoubleTap : undefined}
            likedIds={likedIds}
            onToggleLike={loggedIn ? handleToggleLike : undefined}
            sizeLevel={sizeLevel}
          />
          {hasMore && <div ref={sentinelRef} />}
        </>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => { setLightboxIndex(null); syncPhotoParam(null); }}
          onIndexChange={i => syncPhotoParam(photos[i].id)}
          showShare
        />
      )}

      {/* Bottom bar — selection mode */}
      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#111]/95 backdrop-blur-sm border-t border-[#222] px-5 py-4 flex items-center justify-between">
          <span className="text-[#777] text-sm">
            {selectedIds.size === 0 ? 'Tap photos to select' : `${selectedIds.size} selected`}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={() => downloadPhotos(selectedPhotos, slugName)}
              disabled={downloading}
              className="text-[#0f0f0f] bg-[#bbb] text-xs font-medium rounded px-4 py-2 hover:bg-white transition-colors disabled:opacity-50"
            >
              {downloading ? 'Zipping…' : `Download ${selectedIds.size}`}
            </button>
          )}
        </div>
      )}

      <ScrollToTop />
    </>
  );
}
