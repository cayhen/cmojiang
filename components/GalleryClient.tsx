'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MasonryGrid } from './MasonryGrid';
import { Lightbox } from './Lightbox';
import { KudosButton } from './KudosButton';
import { CommentSection } from './CommentSection';
import { ScrollToTop } from './ScrollToTop';

const BATCH_SIZE = 24;

export interface GalleryPhoto {
  id: string;
  filename: string;
  url: string;            // thumbnail — for masonry grid
  originalUrl: string;    // full quality — for lightbox
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
  const [downloading, setDownloading] = useState(false);
  const [zipProgress, setZipProgress] = useState(0); // 0–1
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const hasMore = visibleCount < photos.length;
  const visiblePhotos = photos.slice(0, visibleCount);

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

  async function handleDoubleTap(index: number) {
    if (!loggedIn) return;
    const photo = photos[index];
    const wasLiked = likedIds.has(photo.id);
    setLikedIds(prev => {
      const next = new Set(prev);
      if (wasLiked) next.delete(photo.id); else next.add(photo.id);
      return next;
    });
    try {
      const res = await fetch(`/api/photos/${photo.id}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('Like failed');
    } catch {
      setLikedIds(prev => {
        const next = new Set(prev);
        if (wasLiked) next.add(photo.id); else next.delete(photo.id);
        return next;
      });
    }
  }

  async function downloadPhotos(photoList: GalleryPhoto[], zipName: string) {
    setDownloading(true);
    setZipProgress(0);
    let completed = 0;
    const total = photoList.length;

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      await Promise.all(
        photoList.map(async photo => {
          const res = await fetch(`/api/photo/${photo.id}`);
          if (res.ok) {
            const blob = await res.blob();
            zip.file(photo.filename, blob);
          }
          completed++;
          setZipProgress(completed / total);
        })
      );

      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${zipName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
    } finally {
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
        <KudosButton
          collectionId={collectionId}
          initialCount={kudosCount}
          initialHasKudos={hasKudos}
          loggedIn={loggedIn}
        />
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
                {downloading ? 'Zipping…' : '↓ All'}
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
            <span>{Math.round(zipProgress * 100)}%</span>
          </div>
          <div className="h-px bg-[#1e1e1e] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#555] transition-all duration-200"
              style={{ width: `${zipProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Grid */}
      <MasonryGrid
        photos={visiblePhotos}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onTap={handleTap}
        onDoubleTap={loggedIn ? handleDoubleTap : undefined}
        likedIds={likedIds}
      />
      {hasMore && <div ref={sentinelRef} />}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
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

      {/* Comment section — extra bottom padding when bottom bar visible */}
      <div className={selectionMode ? 'pb-24' : ''}>
        <CommentSection
          collectionId={collectionId}
          initialComments={comments}
          currentUsername={currentUsername}
        />
      </div>

      <ScrollToTop />
    </>
  );
}
