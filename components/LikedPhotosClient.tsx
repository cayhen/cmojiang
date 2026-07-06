'use client';

import { useState, useRef } from 'react';
import { MasonryGrid } from './MasonryGrid';
import Link from 'next/link';
import { downloadPhotosAsZip } from '@/lib/zip';

export interface LikedPhoto {
  id: string;
  filename: string;
  url: string;
  originalUrl: string;
  downloadUrl: string;
  width?: number;
  height?: number;
  dominantColor?: string;
  collectionId: string;
}

export interface LikedSection {
  collectionId: string;
  name: string;
  photos: LikedPhoto[];
}

interface Props {
  initialSections: LikedSection[];
}

export function LikedPhotosClient({ initialSections }: Props) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<string | null>(null); // collectionId being zipped, or null
  const [zipProgress, setZipProgress] = useState(0);
  const [downloadError, setDownloadError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  async function handleUnlike(photoId: string) {
    setRemovedIds(prev => { const n = new Set(prev); n.add(photoId); return n; });
    try {
      const res = await fetch(`/api/photos/${photoId}/like`, { method: 'POST' });
      if (!res.ok) throw new Error('Unlike failed');
    } catch {
      setRemovedIds(prev => { const n = new Set(prev); n.delete(photoId); return n; });
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function downloadPhotos(photoList: LikedPhoto[], zipName: string, collectionId: string) {
    const controller = new AbortController();
    abortRef.current = controller;
    setDownloading(collectionId);
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
      setDownloading(null);
      setZipProgress(0);
      exitSelection();
    }
  }

  const sections = initialSections
    .map(section => ({
      ...section,
      photos: section.photos.filter(p => !removedIds.has(p.id)),
    }))
    .filter(section => section.photos.length > 0);

  const likedIds = new Set(sections.flatMap(s => s.photos.map(p => p.id)));
  const allPhotos = sections.flatMap(s => s.photos);
  const selectedPhotos = allPhotos.filter(p => selectedIds.has(p.id));

  if (sections.length === 0) {
    return (
      <p className="text-[#444] text-sm font-light">No liked photos yet. Hover a photo and tap the heart to like it.</p>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-4 mb-6">
        {selectionMode ? (
          <button
            onClick={exitSelection}
            className="text-[#666] text-xs hover:text-[#888] transition-colors"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={() => setSelectionMode(true)}
            className="text-[#666] text-xs hover:text-[#888] transition-colors"
          >
            Select
          </button>
        )}
      </div>

      {downloadError && <p className="text-red-500/70 text-xs mb-4">{downloadError}</p>}

      <div className="space-y-12">
        {sections.map(section => {
          const slug = section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photos';
          const isDownloadingThis = downloading === section.collectionId;
          const sectionProgress = isDownloadingThis ? zipProgress : 0;

          return (
          <div key={section.collectionId}>
            <div className="flex items-center justify-between mb-4">
              <Link
                href={`/c/${section.collectionId}/gallery`}
                className="text-[#555] text-xs uppercase tracking-widest hover:text-[#888] transition-colors"
              >
                {section.name}
              </Link>
              {!selectionMode && (
                isDownloadingThis ? (
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-px bg-[#1e1e1e] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#555] transition-all duration-200"
                        style={{ width: `${sectionProgress * 100}%` }}
                      />
                    </div>
                    <span className="text-[#555] text-xs">{Math.round(sectionProgress * 100)}%</span>
                    <button onClick={() => abortRef.current?.abort()} className="text-[#444] hover:text-[#666] text-xs transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => downloadPhotos(section.photos, slug, section.collectionId)}
                    disabled={downloading !== null}
                    className="text-[#666] text-xs hover:text-[#888] transition-colors disabled:opacity-40"
                  >
                    Download
                  </button>
                )
              )}
            </div>
            <MasonryGrid
              photos={section.photos}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onTap={selectionMode ? (i) => toggleSelect(section.photos[i].id) : undefined}
              likedIds={likedIds}
              onToggleLike={selectionMode ? undefined : handleUnlike}
            />
          </div>
          );
        })}
      </div>

      {/* Bottom bar — selection mode */}
      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#111]/95 backdrop-blur-sm border-t border-[#222] px-5 py-4 flex items-center justify-between">
          <span className="text-[#777] text-sm">
            {selectedIds.size === 0 ? 'Tap photos to select' : `${selectedIds.size} selected`}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={() => downloadPhotos(selectedPhotos, 'liked-photos', 'selection')}
              disabled={downloading !== null}
              className="text-[#0f0f0f] bg-[#bbb] text-xs font-medium rounded px-4 py-2 hover:bg-white transition-colors disabled:opacity-50"
            >
              {downloading !== null ? 'Zipping…' : `Download ${selectedIds.size}`}
            </button>
          )}
        </div>
      )}
    </>
  );
}
