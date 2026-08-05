'use client';

// Save photos to the device via the Web Share API (files). On capable touch
// devices this opens the native sheet — "Save Image(s)" (→ Photos) or "Save to
// Files" — so mobile users can add gallery photos straight to their album.
// Shared by GalleryClient (bulk) and Lightbox (single). Fetches the same
// presigned R2 blobs the zip/download path already uses, so no new backend cost.

import { useEffect, useState } from 'react';

export interface SharePhoto {
  filename: string;
  downloadUrl: string;
}

export type ShareOutcome =
  | 'shared'        // handed off to the OS share sheet successfully
  | 'canceled'      // user dismissed the sheet, or the fetch was aborted
  | 'no_activation' // iOS dropped the transient activation — retry synchronously with preparedFiles
  | 'error';        // nothing could be prepared/shared

export interface ShareResult {
  outcome: ShareOutcome;
  failed: number;   // blobs that couldn't be fetched
  files: File[];    // prepared files (populated even on no_activation, for the retap path)
}

export interface ShareOpts {
  onProgress?: (fraction: number) => void; // 0..1 across the fetch phase
  signal?: AbortSignal;
  preparedFiles?: File[]; // skip fetching and share these directly (retap path)
}

// Mirrors lib/zip.ts: bound concurrent fetches so a large save doesn't open
// hundreds of connections at once.
const CONCURRENCY = 6;

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

// iOS decides whether to offer "Save Image" from the file's MIME type, so this
// must be right. Defaults to image/jpeg — same default as the upload-url route.
function mimeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'image/jpeg';
}

export function fileFromPhoto(photo: SharePhoto, blob: Blob): File {
  return new File([blob], photo.filename, { type: mimeFor(photo.filename) });
}

/**
 * True only where a "Save to Photos" hand-off makes sense: a touch device whose
 * browser can share files. Desktop Safari / Chrome-on-Windows also support file
 * share but are gated out by the pointer:coarse check so they keep the direct
 * download. Exported as a plain predicate so the gate logic is unit-testable
 * without rendering the hook.
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  if (typeof navigator.canShare !== 'function') return false;
  if (typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: coarse)').matches) {
    return false;
  }
  try {
    const probe = new File([], 'probe.jpg', { type: 'image/jpeg' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** SSR-safe hook: false on the server and first render, then the real value after mount. */
export function useCanShareFiles(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(canShareFiles());
  }, []);
  return supported;
}

/**
 * Fetch each photo's blob (bounded concurrency), wrap as File[], and hand off to
 * navigator.share({ files }). Never throws for expected conditions — returns a
 * discriminated outcome instead. Pass `preparedFiles` to skip the fetch and
 * share already-fetched files synchronously (the iOS retap path).
 */
export async function sharePhotos(photos: SharePhoto[], opts: ShareOpts = {}): Promise<ShareResult> {
  const { onProgress, signal, preparedFiles } = opts;

  let files: File[];
  let failed = 0;

  if (preparedFiles) {
    files = preparedFiles;
  } else {
    const results: (File | null)[] = new Array(photos.length).fill(null);
    let completed = 0;
    const queue = photos.map((photo, i) => ({ photo, i }));

    const worker = async () => {
      for (let item = queue.shift(); item && !signal?.aborted; item = queue.shift()) {
        try {
          const res = await fetch(item.photo.downloadUrl, { signal });
          if (res.ok) {
            results[item.i] = fileFromPhoto(item.photo, await res.blob());
          } else {
            failed++;
          }
        } catch (err) {
          if ((err as { name?: string }).name === 'AbortError') return;
          failed++;
        }
        completed++;
        onProgress?.(completed / photos.length);
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, photos.length) }, worker));

    if (signal?.aborted) return { outcome: 'canceled', failed, files: [] };

    files = results.filter((f): f is File => f !== null);
    if (files.length === 0) return { outcome: 'error', failed, files: [] };
  }

  // Defensive: caller gates on canShareFiles(), but re-check before handing off.
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || !navigator.canShare({ files })) {
    return { outcome: 'error', failed, files };
  }

  try {
    await navigator.share({ files });
    return { outcome: 'shared', failed, files };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === 'AbortError') return { outcome: 'canceled', failed, files };
    if (name === 'NotAllowedError') return { outcome: 'no_activation', failed, files };
    return { outcome: 'error', failed, files };
  }
}
