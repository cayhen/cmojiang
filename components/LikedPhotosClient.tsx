'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { MasonryGrid } from './MasonryGrid';
import { PageHeader } from './PageHeader';
import { FloatingBar, ProgressTrack } from './FloatingBar';
import { ChevronRightIcon, DownloadIcon, HeartIcon } from './icons';
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
  accountMenu: React.ReactNode;
}

export function LikedPhotosClient({ initialSections, accountMenu }: Props) {
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
    .map(section => ({ ...section, photos: section.photos.filter(p => !removedIds.has(p.id)) }))
    .filter(section => section.photos.length > 0);

  const likedIds = new Set(sections.flatMap(s => s.photos.map(p => p.id)));
  const allPhotos = sections.flatMap(s => s.photos);
  const selectedPhotos = allPhotos.filter(p => selectedIds.has(p.id));
  const total = allPhotos.length;

  return (
    <>
      <PageHeader
        width="wide"
        title="Liked Photos"
        subtitle={total > 0 ? `${total} ${total === 1 ? 'Photo' : 'Photos'}` : undefined}
        back={{ href: '/profile', label: 'Profile' }}
        actions={
          <>
            {total > 0 && (
              <button
                type="button"
                onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
                className={`btn btn-sm ${selectionMode ? 'btn-filled' : 'btn-tinted'}`}
              >
                {selectionMode ? 'Done' : 'Select'}
              </button>
            )}
            {accountMenu}
          </>
        }
      />

      {downloadError && (
        <p role="alert" className="animate-rise mb-3 px-4 text-footnote text-destructive sm:px-6 lg:px-8">{downloadError}</p>
      )}

      {sections.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-24 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fill text-heart">
            <HeartIcon size={26} filled />
          </span>
          <p className="text-headline">No Liked Photos</p>
          <p className="mt-1 max-w-xs text-subhead text-label2">Double-tap a photo, or tap its heart, and it will be saved here.</p>
        </div>
      ) : (
        <div className="space-y-10 pb-28">
          {sections.map(section => {
            const slug = section.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photos';
            const isDownloadingThis = downloading === section.collectionId;

            return (
              <section key={section.collectionId}>
                <div className="mb-3 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                  <Link href={`/c/${section.collectionId}/gallery`} className="group flex min-w-0 items-center gap-1">
                    <h2 className="truncate text-title3">{section.name}</h2>
                    <ChevronRightIcon size={16} className="shrink-0 text-label2 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                  {!selectionMode && (
                    <button
                      type="button"
                      onClick={() => downloadPhotos(section.photos, slug, section.collectionId)}
                      disabled={downloading !== null}
                      aria-label={`Download ${section.name}`}
                      className="btn btn-sm btn-tinted shrink-0 gap-1.5 px-3"
                    >
                      <DownloadIcon size={16} />
                      <span className="tabular-nums">{isDownloadingThis ? `${Math.round(zipProgress * 100)}%` : section.photos.length}</span>
                    </button>
                  )}
                </div>
                <div className="sm:px-6 lg:px-8">
                  <MasonryGrid
                    photos={section.photos}
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onTap={selectionMode ? (i) => toggleSelect(section.photos[i].id) : undefined}
                    onLongPress={i => { setSelectionMode(true); setSelectedIds(new Set([section.photos[i].id])); }}
                    likedIds={likedIds}
                    onToggleLike={selectionMode ? undefined : handleUnlike}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}

      <FloatingBar open={selectionMode || downloading !== null}>
        {downloading !== null ? (
          <>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between text-subhead">
                <span className="font-semibold">Zipping Photos</span>
                <span className="tabular-nums text-label2">{Math.round(zipProgress * 100)}%</span>
              </div>
              <ProgressTrack value={zipProgress} />
            </div>
            <button type="button" onClick={() => abortRef.current?.abort()} className="btn-plain shrink-0 pl-2">Cancel</button>
          </>
        ) : (
          <>
            <span className="flex-1 text-subhead font-semibold tabular-nums">
              {selectedIds.size === 0 ? 'Select Photos' : `${selectedIds.size} Selected`}
            </span>
            <button
              type="button"
              onClick={() => downloadPhotos(selectedPhotos, 'liked-photos', 'selection')}
              disabled={selectedIds.size === 0}
              className="btn btn-sm btn-filled gap-1.5"
            >
              <DownloadIcon size={16} strokeWidth={2} />
              Download
            </button>
          </>
        )}
      </FloatingBar>
    </>
  );
}
