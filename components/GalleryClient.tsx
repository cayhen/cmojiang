'use client';

import { useState } from 'react';
import { MasonryGrid } from './MasonryGrid';
import { Lightbox } from './Lightbox';
import { KudosButton } from './KudosButton';
import { CommentSection } from './CommentSection';

export interface GalleryPhoto {
  id: string;
  filename: string;
  url: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  username: string;
}

interface Props {
  collectionId: string;
  photos: GalleryPhoto[];
  kudosCount: number;
  hasKudos: boolean;
  loggedIn: boolean;
  comments: Comment[];
  currentUsername: string | null;
}

export function GalleryClient({
  collectionId,
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

  const selectedCount = selectedIds.size;
  const downloadAllUrl = `/api/collections/${collectionId}/zip`;
  const downloadSelectedUrl =
    selectedCount > 0
      ? `${downloadAllUrl}?ids=${Array.from(selectedIds).join(',')}`
      : downloadAllUrl;

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
              <a
                href={downloadAllUrl}
                download
                className="text-[#666] text-xs hover:text-[#888] transition-colors"
              >
                ↓ All
              </a>
            </>
          )}
        </div>
      </div>

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
            {selectedCount === 0 ? 'Tap photos to select' : `${selectedCount} selected`}
          </span>
          {selectedCount > 0 && (
            <a
              href={downloadSelectedUrl}
              download
              onClick={exitSelection}
              className="text-[#0f0f0f] bg-[#bbb] text-xs font-medium rounded px-4 py-2 hover:bg-white transition-colors"
            >
              Download {selectedCount}
            </a>
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
