'use client';

import { useState } from 'react';
import { MasonryGrid } from './MasonryGrid';
import { Lightbox } from './Lightbox';
import { KudosButton } from './KudosButton';
import { CommentSection } from './CommentSection';

export interface GalleryPhoto {
  id: string;
  filename: string;
  url: string;         // thumbnail — for masonry grid
  originalUrl: string; // full quality — for lightbox
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
}: Props) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [zipProgress, setZipProgress] = useState(0); // 0–1

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
        photos={photos}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onTap={handleTap}
      />

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
    </>
  );
}
