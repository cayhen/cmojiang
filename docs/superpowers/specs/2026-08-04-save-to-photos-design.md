# Save to Photos on Mobile — Design Spec
**Date:** 2026-08-04

---

## Overview

Lower the barrier for phone users to get photos off the gallery and into their **Photos album**. Today, the only ways off the site are:

- **Single photo** (Lightbox): a `<a href={downloadUrl} download>` link pointing at a presigned R2 URL with `Content-Disposition: attachment`.
- **Bulk** (GalleryClient): "Download all" / "Download N" → client-side zip via `lib/zip.ts`.

On iOS Safari an `attachment` link saves into the **Files** app, not **Photos**, and a zip can't go into Photos at all. The fix is to route the existing download actions through the **Web Share API with files** (`navigator.share({ files })`) on capable touch devices, which surfaces the native sheet — **Save Image(s)** (→ Photos) or **Save to Files** — exactly like other apps.

This is an **adaptive single action**: the `"Download"` labels never change and no new buttons appear. Behavior adapts to the device. Desktop and unsupported browsers keep today's behavior byte-for-byte.

---

## Non-Goals / Cost

- **No new backend cost.** No new API routes, no Supabase queries, no extra Vercel function invocations. Sharing fetches the *same* presigned R2 blobs the download already fetches, directly from R2. Nothing to flag under the cost-sensitivity policy.
- The Lightbox **Share** button (which shares a *link* to the photo via `?photo=`) is out of scope and untouched — it has a different purpose from saving the image bytes.
- No streaming zip writer, no change to the existing memory profile of the zip path.

---

## Behavior Matrix

| Context | Desktop / non-touch / unsupported | Touch device with `canShare({ files })` |
|---|---|---|
| Lightbox "Download" | unchanged `<a download>` | `navigator.share({ files: [one] })` → native sheet |
| Gallery "Download all" / "Download N" | unchanged zip | `navigator.share({ files: [...] })` → native sheet |
| Bulk request **> `MAX_SHARE_FILES` (50)** on a touch device | zip | zip (silent fallback — see Guard) |

The label is always "Download" / "Download all" / "Download N". The user never chooses between "download" and "save to photos" — the device decides, and the OS sheet offers Photos vs Files.

---

## New Unit — `lib/share.ts`

Isolated so neither component grows tangled, and so the logic is unit-testable in the existing Jest node environment.

### `useCanShareFiles(): boolean`
SSR-safe React hook. Returns `false` on the server and on first client render (so SSR markup matches), then after mount returns `true` **iff both**:
1. `typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'` and `navigator.canShare({ files: [probeFile] })` is `true`, where `probeFile` is a tiny throwaway `new File([], 'probe.jpg', { type: 'image/jpeg' })`.
2. `window.matchMedia('(pointer: coarse)').matches` — a touch device.

The `pointer: coarse` gate is deliberate: desktop Safari and Chrome-on-Windows also support file share, but we want them to keep the direct download. The two checks live in an exported plain predicate `canShareFiles(): boolean`; the hook is a thin wrapper: `useState(false)` + `useEffect(() => setSupported(canShareFiles()), [])`. Exporting the predicate separately is what makes the gate logic unit-testable without rendering a hook.

### `fileFromPhoto(photo, blob): File`
Builds a `File` with the photo's real `filename` and a MIME `type` inferred from the filename extension:

| ext | type |
|---|---|
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.webp` | `image/webp` |
| `.heic` | `image/heic` |
| (anything else) | `image/jpeg` (default, matches the upload-URL route's default) |

iOS decides whether to offer "Save Image" from the file's MIME type, so this must be correct.

### `sharePhotos(photos, opts): Promise<ShareResult>`
```ts
type ShareOutcome = 'shared' | 'canceled' | 'no_activation' | 'error';
interface ShareResult { outcome: ShareOutcome; failed: number; files: File[]; }

interface ShareOpts {
  onProgress?: (fraction: number) => void; // 0..1 across the fetch phase
  signal?: AbortSignal;
  preparedFiles?: File[]; // retap path: skip fetching, share these directly
}
```

Steps:
1. If `preparedFiles` is provided, skip to step 4 with those files (the retap path — see GalleryClient).
2. Fetch each `photo.downloadUrl` as a blob with **bounded concurrency of 6** (reuse the pattern already in `lib/zip.ts` — a shared helper is fine but not required). Respect `signal`. Drive `onProgress` as blobs complete.
3. Build `File[]` via `fileFromPhoto`. Count fetch failures into `failed`. If **all** fetches failed → return `{ outcome: 'error', failed, files: [] }`.
4. `if (!navigator.canShare?.({ files }))` → `{ outcome: 'error', ... }` (shouldn't happen — caller gated — but defensive).
5. `try { await navigator.share({ files }); return { outcome: 'shared', failed, files }; }`
   - `catch (e)`:
     - `AbortError` (user dismissed the sheet) → `{ outcome: 'canceled', failed, files }`.
     - `NotAllowedError` (transient activation lost) → `{ outcome: 'no_activation', failed, files }` — caller can retry synchronously with `preparedFiles: files`.
     - otherwise → `{ outcome: 'error', failed, files }`.

`sharePhotos` never throws for expected conditions; it returns an outcome. (It may still reject if `signal` aborts during fetch — callers already handle `AbortError` like the zip path does.)

---

## Lightbox (`components/Lightbox.tsx`)

The single "Download" action becomes adaptive. Add `const canShareFiles = useCanShareFiles();`.

- **`canShareFiles` false** → render exactly today's `<a href={photo.downloadUrl} download={photo.filename}>Download</a>`.
- **`canShareFiles` true** → render a `<button>Download</button>` (same label, same styling classes) whose click:
  1. sets a transient `saving` state (button shows a subtle busy affordance; single file, so this is brief),
  2. `await sharePhotos([photo])`,
  3. on `outcome === 'error'` → fall back to opening `photo.downloadUrl` (e.g. assign `window.location.href` or click a hidden anchor) so the user still gets the file,
  4. on `no_activation` (unlikely for a single fast fetch) → same fallback to the download URL,
  5. `shared` / `canceled` → no-op.

Because the fetch is a single blob, activation loss is rare; we don't build the two-tap flow here — the download-URL fallback is enough.

This component is also used by `MasonryGrid`'s internal lightbox on `/profile/likes`, so that page gains the same behavior for free — consistent and intended.

---

## Gallery (`components/GalleryClient.tsx`)

"Download all" and "Download N" become adaptive. Add `const canShareFiles = useCanShareFiles();`.

Introduce a single dispatcher used by both buttons:

```
async function getPhotos(list, zipName):
  if canShareFiles && list.length <= MAX_SHARE_FILES:
    await savePhotosToDevice(list)      // share path
  else:
    await downloadPhotos(list, zipName) // existing zip path, unchanged
```

`MAX_SHARE_FILES = 50` (module constant, tunable). Above it we silently use the zip even on a share-capable device — pushing hundreds of files through the share sheet is unreliable and memory-heavy. The label never changes; the user sees no branch.

### `savePhotosToDevice(list)`
Reuses the existing `downloading` / `zipProgress` / `downloadError` state and the existing progress bar (which already renders during `downloading` and is driven by a `0..1` fraction). Flow:

1. `setDownloading(true)`, reset progress/error, create an `AbortController` in `abortRef` (so the existing Cancel button works).
2. `const result = await sharePhotos(list, { onProgress: setZipProgress, signal })`.
3. Branch on `result.outcome`:
   - `shared` → done; if `result.failed > 0` surface the existing partial message ("N of M photos couldn't be prepared…").
   - `canceled` → silent no-op.
   - `no_activation` → **retap fallback**: keep `result.files` in a `pendingFiles` state and flip a `needsRetap` flag. The selection bar's primary button relabels to **"Tap to save N"**; its click calls `sharePhotos(list, { preparedFiles: pendingFiles })` **synchronously** (no awaited fetch before `navigator.share`), which re-establishes a fresh user activation and succeeds. Clear `pendingFiles`/`needsRetap` afterward.
   - `error` → set `downloadError` ("Couldn't prepare photos. Please try again."); the user can retry. (Files could not be shared; unlike the lightbox single-photo case there is no obvious single-URL fallback for a bulk request, so we surface an error rather than silently doing something else.)
4. `finally` → clear `downloading`/progress/`abortRef`; on success exit selection mode (mirrors current `downloadPhotos`).

`downloadPhotos` (zip) stays exactly as it is. The two "Download" buttons in the action row and the selection bottom bar now call `getPhotos(...)` instead of `downloadPhotos(...)` directly.

The progress bar's header text can stay "Zipping…" for the zip path; for the share path it reads "Preparing…" (small conditional on which path is active).

---

## Error Handling & Fallback Summary

| Situation | Result |
|---|---|
| Not a share-capable touch device | Existing download / zip, unchanged |
| User dismisses the share sheet | No-op (like the existing `handleShare`) |
| Some blobs fail to fetch | Share the rest; surface "N of M couldn't be prepared" |
| All blobs fail | Lightbox: fall back to download URL. Gallery: error message, user can retry |
| iOS drops transient activation (bulk) | "Tap to save N" retap fires `share` synchronously |
| iOS drops transient activation (single) | Fall back to opening the download URL |
| Bulk request > 50 files on a touch device | Silent zip fallback |

---

## Testing — `__tests__/lib/share.test.ts`

Follows the existing Jest `jest-environment-node` style (globals mocked, as in `__tests__/lib/r2.test.ts`). `navigator`, `fetch`, `File`, and `matchMedia` are not present in node env, so tests set them on `global`/`globalThis` and restore after.

Cases:
- **`fileFromPhoto`** — MIME inferred correctly for `.jpg/.jpeg/.png/.webp/.heic` and the default; the resulting `File.name` equals `photo.filename`.
- **`canShareFiles` gate logic** — the underlying predicate returns `true` only when both `canShare({files})` and `pointer: coarse` are satisfied; `false` if either is missing. (Test the plain predicate function; the hook wrapper is thin and not unit-tested.)
- **`sharePhotos` success** — mocked `fetch` returns blobs, mocked `navigator.share` resolves → `{ outcome: 'shared', failed: 0 }`, and `share` was called with a `files` array of the right length.
- **`sharePhotos` partial failure** — one `fetch` rejects → `failed === 1`, still shares the rest.
- **`sharePhotos` all-fail** — every `fetch` rejects → `{ outcome: 'error', failed: N }`, `share` not called.
- **`sharePhotos` cancel** — `share` rejects with `AbortError` → `{ outcome: 'canceled' }`.
- **`sharePhotos` activation loss** — `share` rejects with `NotAllowedError` → `{ outcome: 'no_activation' }` with `files` populated for the retap.
- **`sharePhotos` preparedFiles** — passing `preparedFiles` skips fetching and calls `share` directly.

---

## Files Changed

| File | Change |
|---|---|
| `lib/share.ts` | **new** — `useCanShareFiles`, `canShareFiles` predicate, `fileFromPhoto`, `sharePhotos` |
| `components/Lightbox.tsx` | adaptive "Download": button + `sharePhotos([photo])` when capable, else the existing `<a download>` |
| `components/GalleryClient.tsx` | `getPhotos` dispatcher, `savePhotosToDevice`, retap state, `MAX_SHARE_FILES` guard; buttons call `getPhotos` |
| `__tests__/lib/share.test.ts` | **new** — unit tests for `lib/share.ts` |

No changes to API routes, `lib/r2.ts`, the DB, or the zip path itself.

---

## What's Not In Scope

- Grid-level per-photo save (without opening the lightbox) — not requested.
- A streaming zip writer to reduce memory — separate, pre-existing known issue.
- Changing the Lightbox **Share** (link) button.
- Relabeling any button (the request is explicitly to keep one intuitive "Download").
