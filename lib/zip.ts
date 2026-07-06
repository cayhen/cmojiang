// Client-side zip download shared by GalleryClient and LikedPhotosClient.

export interface ZipPhoto {
  filename: string;
  downloadUrl: string;
}

// Bounded so a large collection doesn't open hundreds of simultaneous
// connections; blobs still accumulate in memory until the zip is generated.
const CONCURRENCY = 6;

/**
 * Fetch photos with bounded concurrency, zip them client-side, and trigger a
 * browser download. Returns the number of photos that failed to fetch so the
 * caller can warn about an incomplete zip. Skips the download entirely if the
 * signal aborts or every fetch fails.
 */
export async function downloadPhotosAsZip(
  photos: ZipPhoto[],
  zipName: string,
  signal: AbortSignal,
  onProgress: (fraction: number) => void
): Promise<number> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  let completed = 0;
  let failed = 0;
  const queue = [...photos];

  async function worker() {
    for (let photo = queue.shift(); photo && !signal.aborted; photo = queue.shift()) {
      try {
        const res = await fetch(photo.downloadUrl, { signal });
        if (res.ok) {
          zip.file(photo.filename, await res.blob());
        } else {
          failed++;
        }
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        failed++;
      }
      completed++;
      onProgress(completed / photos.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, photos.length) }, worker));

  if (signal.aborted || failed === photos.length) return failed;

  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${zipName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  return failed;
}
