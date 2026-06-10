# Private Presigned Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cmojiang collections genuinely private by serving every photo through short-lived presigned R2 URLs (display + download) and locking the R2 bucket's public access, with zero added Vercel bandwidth on page loads.

**Architecture:** Replace all `publicPhotoUrl()` calls (3 server pages) with presigned `signViewUrl()` (24h, inline display) and `signDownloadUrl()` (24h, forced-attachment). Downloads and the client-side zip fetch presigned R2 URLs **directly from the browser** (requires R2 CORS), so the `/api/photo/[id]` Vercel proxy is removed. Finally, R2 public-read is disabled so a raw storage path no longer returns bytes without a signature.

**Tech Stack:** Next.js 14 App Router (RSC), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, Cloudflare R2, Jest + ts-jest.

**Key decisions (locked):** 24h presigned-URL expiry · downloads go direct-to-R2 with a CORS policy · `password_plain` stays (out of scope).

**Load profile (by priority):**
1. *Near-zero Supabase load* — photo rows stay in Redis; presigning happens outside the cache boundary so signatures never enter the cache. Supabase is not in the photo-byte path.
2. *Near-zero Vercel load* — `getSignedUrl` is pure CPU (HMAC-SHA256, no network); ~microseconds per photo. All photo bytes (display, download, zip) go direct browser→R2 with no Vercel proxy hop. The only Vercel work per page load is O(N) HMAC operations.
3. *Privacy* — presigned URLs expire + bucket lock = genuine privacy. Without the bucket lock (Task 10), privacy is soft (URLs expire but the raw path is still open). With it, there is no un-authed path to the bytes.

**Deployment ordering (critical):**
- **Task 9 (CORS) must be applied before Task 8 ships.** Task 8 switches the zip flow from the same-origin `/api/photo/{id}` proxy to a cross-origin R2 fetch. Without CORS headers on the bucket, the browser blocks the response body and zip downloads silently break. Apply the CORS script against production R2 before merging/deploying Task 8.
- Ship Tasks 1–9 and confirm presigned display/download works in production **before** Task 10 (locking the bucket). Locking first would break the live site. Task 11 (remove proxy) can ship with 1–9.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `lib/r2.ts` | Modify | Add `PHOTO_URL_TTL`, `signViewUrl`, `signDownloadUrl`. Remove `publicPhotoUrl`, `getDownloadUrl` (Task 11). |
| `__tests__/lib/r2.test.ts` | Create | Unit-test the two signers. |
| `app/c/[id]/gallery/page.tsx` | Modify | Sign thumb/original/download URLs (async map). |
| `app/profile/likes/page.tsx` | Modify | Same, cross-collection. |
| `app/admin/collections/[id]/page.tsx` | Modify | Sign view URLs only (no download). |
| `components/GalleryClient.tsx` | Modify | `GalleryPhoto.downloadUrl`; zip fetches `photo.downloadUrl`. |
| `components/LikedPhotosClient.tsx` | Modify | `LikedPhoto.downloadUrl`. |
| `components/MasonryGrid.tsx` | Modify | `Photo.downloadUrl`; download button + error fallback drop the proxy. |
| `components/Lightbox.tsx` | Modify | `Photo.downloadUrl`; download link drops the proxy. |
| `scripts/set-r2-cors.ts` | Create | One-shot script to apply the R2 bucket CORS policy. |
| `app/api/photo/[id]/` | Delete | Proxy no longer used (Task 11). |
| `cmojiang/CLAUDE.md` | Modify | Document the new private model (Task 12). |

---

## Task 1: Presigning helpers in `lib/r2.ts`

**Files:**
- Modify: `lib/r2.ts`
- Test: `__tests__/lib/r2.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/r2.test.ts`:

```ts
process.env.R2_ACCOUNT_ID = 'acct';
process.env.R2_ACCESS_KEY_ID = 'akid';
process.env.R2_SECRET_ACCESS_KEY = 'secret';
process.env.R2_BUCKET_NAME = 'test-bucket';

import { signViewUrl, signDownloadUrl, PHOTO_URL_TTL } from '@/lib/r2';

describe('r2 presigning', () => {
  it('exposes a 24h default TTL', () => {
    expect(PHOTO_URL_TTL).toBe(86400);
  });

  it('signViewUrl returns a signed URL for the key with no content-disposition', async () => {
    const url = await signViewUrl('col1/photo1.jpg');
    // SDK uses virtual-hosted style: bucket in the host, key in the path.
    expect(url).toContain('test-bucket'); // bucket appears in the hostname
    expect(url).toContain('/col1/photo1.jpg'); // key path (style-agnostic)
    expect(url).toContain('X-Amz-Signature=');
    expect(url).not.toContain('response-content-disposition');
  });

  it('signDownloadUrl forces attachment with the filename', async () => {
    const url = await signDownloadUrl('col1/photo1.jpg', 'beach day.jpg');
    expect(url).toContain('X-Amz-Signature=');
    expect(decodeURIComponent(url)).toContain('attachment; filename="beach day.jpg"');
  });

  it('signDownloadUrl strips quotes/newlines from the filename', async () => {
    const url = await signDownloadUrl('col1/p.jpg', 'a"b\nc.jpg');
    expect(decodeURIComponent(url)).toContain('attachment; filename="a_b_c.jpg"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest __tests__/lib/r2.test.ts`
Expected: FAIL — `signViewUrl`/`signDownloadUrl`/`PHOTO_URL_TTL` are not exported.

- [ ] **Step 3: Add the helpers**

In `lib/r2.ts`, after the existing `getUploadUrl` function, add:

```ts
/** Default lifetime for presigned photo URLs (24 hours). */
export const PHOTO_URL_TTL = 60 * 60 * 24;

/** Presigned GET URL for inline display (no forced download). */
export async function signViewUrl(key: string, expiresIn = PHOTO_URL_TTL): Promise<string> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
  return getSignedUrl(r2, command, { expiresIn });
}

/** Presigned GET URL that forces a browser download with the given filename. */
export async function signDownloadUrl(key: string, filename: string, expiresIn = PHOTO_URL_TTL): Promise<string> {
  const safe = filename.replace(/["\\\r\n]/g, '_');
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safe}"`,
  });
  return getSignedUrl(r2, command, { expiresIn });
}
```

`GetObjectCommand` and `getSignedUrl` are already imported at the top of the file. Leave `publicPhotoUrl` and `getDownloadUrl` in place for now — they are removed in Task 11 after all callers migrate.

- [ ] **Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest __tests__/lib/r2.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/r2.ts __tests__/lib/r2.test.ts
git commit -m "feat: add presigned view/download URL helpers for R2"
```

---

## Task 2: Sign URLs in the gallery page

**Files:**
- Modify: `app/c/[id]/gallery/page.tsx`

- [ ] **Step 1: Update the r2 import**

Change line 7 from:

```ts
import { publicPhotoUrl, thumbPath } from '@/lib/r2';
```

to:

```ts
import { signViewUrl, signDownloadUrl, thumbPath } from '@/lib/r2';
```

- [ ] **Step 2: Replace the sync URL mapper with an async one**

Replace this block (the `const photosWithUrls = rawPhotos.map(...)` section, including its leading comment):

```ts
  // Seam for privatization: to gate photo bytes, swap publicPhotoUrl for an
  // async presigned getDownloadUrl here and wrap this in Promise.all.
  const photosWithUrls = rawPhotos.map(photo => {
    const hasThumb = photo.width != null;
    const originalUrl = publicPhotoUrl(photo.storage_path);
    return {
      id: photo.id,
      filename: photo.filename,
      url: hasThumb ? publicPhotoUrl(thumbPath(photo.storage_path)) : originalUrl,
      originalUrl,
      width: photo.width ?? undefined,
      height: photo.height ?? undefined,
      dominantColor: photo.dominant_color ?? undefined,
    };
  });
```

with:

```ts
  // Presigned URLs (24h) generated outside the row cache so we never cache an
  // expiring signature. Direct browser→R2 access; Vercel is not in the path.
  const photosWithUrls = await Promise.all(
    rawPhotos.map(async photo => {
      const hasThumb = photo.width != null;
      const [originalUrl, thumbUrl, downloadUrl] = await Promise.all([
        signViewUrl(photo.storage_path),
        hasThumb ? signViewUrl(thumbPath(photo.storage_path)) : Promise.resolve(null),
        signDownloadUrl(photo.storage_path, photo.filename),
      ]);
      return {
        id: photo.id,
        filename: photo.filename,
        url: thumbUrl ?? originalUrl,
        originalUrl,
        downloadUrl,
        width: photo.width ?? undefined,
        height: photo.height ?? undefined,
        dominantColor: photo.dominant_color ?? undefined,
      };
    })
  );
```

- [ ] **Step 3: Remove dead `revalidate` export**

The gallery page uses `cookies()` at the top, which forces dynamic rendering in Next.js — `export const revalidate = 60` has no effect and is dead code. Delete line 13:

```ts
export const revalidate = 60;
```

- [ ] **Step 4: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS (exit 0). `GalleryClient`'s `GalleryPhoto` gains `downloadUrl` in Task 5; until then tsc may flag the prop — that is expected and resolved by Task 5. If you implement tasks strictly in order, run tsc after Task 5 instead and expect PASS there.

- [ ] **Step 5: Commit**

```bash
git add "app/c/[id]/gallery/page.tsx"
git commit -m "feat: presign gallery photo URLs (view + download); remove dead revalidate export"
```

---

## Task 3: Sign URLs in the liked-photos page

**Files:**
- Modify: `app/profile/likes/page.tsx`

- [ ] **Step 1: Update the r2 import**

Change line 4 from:

```ts
import { publicPhotoUrl, thumbPath } from '@/lib/r2';
```

to:

```ts
import { signViewUrl, signDownloadUrl, thumbPath } from '@/lib/r2';
```

- [ ] **Step 2: Make the photo mapper async**

Replace the `const photos: LikedPhoto[] = (likes ?? []).map(...)` block:

```ts
  const photos: LikedPhoto[] = (likes ?? [])
    .map(l => {
      const p = l.photos as unknown as {
        id: string; filename: string; storage_path: string; collection_id: string;
        width: number | null; height: number | null; dominant_color: string | null;
      } | null;
      if (!p) return null;
      const hasThumb = p.width != null;
      const originalUrl = publicPhotoUrl(p.storage_path);
      return {
        id: p.id,
        filename: p.filename,
        url: hasThumb ? publicPhotoUrl(thumbPath(p.storage_path)) : originalUrl,
        originalUrl,
        width: p.width ?? undefined,
        height: p.height ?? undefined,
        dominantColor: p.dominant_color ?? undefined,
        collectionId: p.collection_id,
      };
    })
    .filter(Boolean) as LikedPhoto[];
```

with:

```ts
  const photoRows = (likes ?? [])
    .map(l => l.photos as unknown as {
      id: string; filename: string; storage_path: string; collection_id: string;
      width: number | null; height: number | null; dominant_color: string | null;
    } | null)
    .filter((p): p is NonNullable<typeof p> => p != null);

  const photos: LikedPhoto[] = await Promise.all(
    photoRows.map(async p => {
      const hasThumb = p.width != null;
      const [originalUrl, thumbUrl, downloadUrl] = await Promise.all([
        signViewUrl(p.storage_path),
        hasThumb ? signViewUrl(thumbPath(p.storage_path)) : Promise.resolve(null),
        signDownloadUrl(p.storage_path, p.filename),
      ]);
      return {
        id: p.id,
        filename: p.filename,
        url: thumbUrl ?? originalUrl,
        originalUrl,
        downloadUrl,
        width: p.width ?? undefined,
        height: p.height ?? undefined,
        dominantColor: p.dominant_color ?? undefined,
        collectionId: p.collection_id,
      };
    })
  );
```

- [ ] **Step 3: Typecheck** (will fully pass after Task 5)

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS after Task 5 adds `downloadUrl` to `LikedPhoto`.

- [ ] **Step 4: Commit**

```bash
git add app/profile/likes/page.tsx
git commit -m "feat: presign liked-photo URLs"
```

---

## Task 4: Sign URLs in the admin manage page

**Files:**
- Modify: `app/admin/collections/[id]/page.tsx`

Admin renders `<img src={photo.url}>` only (no download, no lightbox), so it needs **view** URLs only.

- [ ] **Step 1: Update the r2 import**

Change line 3 from:

```ts
import { publicPhotoUrl, thumbPath } from '@/lib/r2';
```

to:

```ts
import { signViewUrl, thumbPath } from '@/lib/r2';
```

- [ ] **Step 2: Make the mapper async**

Replace:

```ts
  const photosWithUrls = (photos ?? []).map(photo => ({
    id: photo.id,
    filename: photo.filename,
    url: publicPhotoUrl(thumbPath(photo.storage_path)),
    originalUrl: publicPhotoUrl(photo.storage_path),
  }));
```

with:

```ts
  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async photo => {
      const [url, originalUrl] = await Promise.all([
        signViewUrl(thumbPath(photo.storage_path)),
        signViewUrl(photo.storage_path),
      ]);
      return { id: photo.id, filename: photo.filename, url, originalUrl };
    })
  );
```

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS (exit 0) — admin types are self-contained.

- [ ] **Step 4: Commit**

```bash
git add "app/admin/collections/[id]/page.tsx"
git commit -m "feat: presign admin manage thumbnails"
```

---

## Task 5: Add `downloadUrl` to client photo types

**Files:**
- Modify: `components/GalleryClient.tsx`
- Modify: `components/LikedPhotosClient.tsx`
- Modify: `components/MasonryGrid.tsx`
- Modify: `components/Lightbox.tsx`

- [ ] **Step 1: GalleryClient — extend `GalleryPhoto`**

In `components/GalleryClient.tsx`, change the interface (currently lines 12–20):

```ts
export interface GalleryPhoto {
  id: string;
  filename: string;
  url: string;            // thumbnail — for masonry grid
  originalUrl: string;    // full quality — for lightbox
  width?: number;         // thumbnail pixel width (stored at upload time)
  height?: number;        // thumbnail pixel height (stored at upload time)
  dominantColor?: string; // average color sampled at upload time, e.g. "#a3b4c5"
}
```

Add the `downloadUrl` line:

```ts
export interface GalleryPhoto {
  id: string;
  filename: string;
  url: string;            // thumbnail — for masonry grid
  originalUrl: string;    // full quality — for lightbox
  downloadUrl: string;    // presigned, forces attachment download
  width?: number;
  height?: number;
  dominantColor?: string;
}
```

- [ ] **Step 2: LikedPhotosClient — extend `LikedPhoto`**

In `components/LikedPhotosClient.tsx`, add `downloadUrl: string;` to the `LikedPhoto` interface, after `originalUrl: string;`:

```ts
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
```

- [ ] **Step 3: MasonryGrid — extend its local `Photo`**

In `components/MasonryGrid.tsx`, change the `Photo` interface (lines 6–14) to add an optional `downloadUrl`:

```ts
interface Photo {
  id: string;
  filename: string;
  url: string;
  originalUrl?: string;
  downloadUrl?: string;
  width?: number;
  height?: number;
  dominantColor?: string;
}
```

- [ ] **Step 4: Lightbox — extend its local `Photo`**

In `components/Lightbox.tsx`, change line 6:

```ts
interface Photo { id: string; filename: string; url: string; originalUrl?: string; collectionId?: string; }
```

to:

```ts
interface Photo { id: string; filename: string; url: string; originalUrl?: string; downloadUrl?: string; collectionId?: string; }
```

- [ ] **Step 5: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS (exit 0). Tasks 2 and 3 now type-check because the consumers accept `downloadUrl`.

- [ ] **Step 6: Commit**

```bash
git add components/GalleryClient.tsx components/LikedPhotosClient.tsx components/MasonryGrid.tsx components/Lightbox.tsx
git commit -m "feat: add downloadUrl to client photo types"
```

---

## Task 6: Rewire MasonryGrid download + error fallback to R2

**Files:**
- Modify: `components/MasonryGrid.tsx`

- [ ] **Step 1: Replace the image error fallback (lines ~133–145)**

Replace:

```tsx
                    onError={e => {
                      markLoaded(photo.id);
                      const el = e.currentTarget;
                      if (!el.dataset.fallback) {
                        // thumbnail failed → try original R2 URL
                        el.dataset.fallback = '1';
                        el.src = photo.originalUrl ?? `/api/photo/${photo.id}`;
                      } else if (el.dataset.fallback === '1') {
                        // original R2 also failed → try server proxy (has Supabase fallback)
                        el.dataset.fallback = '2';
                        el.src = `/api/photo/${photo.id}`;
                      }
                    }}
```

with:

```tsx
                    onError={e => {
                      markLoaded(photo.id);
                      const el = e.currentTarget;
                      // thumbnail failed → fall back to the (presigned) original once
                      if (!el.dataset.fallback && photo.originalUrl) {
                        el.dataset.fallback = '1';
                        el.src = photo.originalUrl;
                      }
                    }}
```

- [ ] **Step 2: Replace the per-photo download button (lines ~186–199)**

Replace:

```tsx
                  {/* Per-photo download button */}
                  {!selectionMode && (
                    <a
                      href={`/api/photo/${photo.id}`}
                      download={photo.filename}
                      onClick={e => e.stopPropagation()}
                      aria-label={`Download ${photo.filename}`}
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-black/50 hover:bg-black/70 rounded p-1.5"
                    >
```

with:

```tsx
                  {/* Per-photo download button */}
                  {!selectionMode && photo.downloadUrl && (
                    <a
                      href={photo.downloadUrl}
                      download={photo.filename}
                      onClick={e => e.stopPropagation()}
                      aria-label={`Download ${photo.filename}`}
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-black/50 hover:bg-black/70 rounded p-1.5"
                    >
```

(Only the `{!selectionMode && (` line becomes `{!selectionMode && photo.downloadUrl && (` and the `href` changes; the rest of the `<a>`/SVG is unchanged.)

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS (exit 0).

- [ ] **Step 4: Commit**

```bash
git add components/MasonryGrid.tsx
git commit -m "refactor: MasonryGrid downloads + fallback use presigned R2 URLs"
```

---

## Task 7: Rewire Lightbox download to R2

**Files:**
- Modify: `components/Lightbox.tsx`

- [ ] **Step 1: Replace the download link (lines ~71–77)**

Replace:

```tsx
            <a
              href={`/api/photo/${photo.id}`}
              download={photo.filename}
              className="text-[#777] hover:text-[#bbb] text-sm transition-colors"
            >
              Download
            </a>
```

with:

```tsx
            {photo.downloadUrl && (
              <a
                href={photo.downloadUrl}
                download={photo.filename}
                className="text-[#777] hover:text-[#bbb] text-sm transition-colors"
              >
                Download
              </a>
            )}
```

The inline `<img src={photo.originalUrl ?? photo.url}>` (line 47) is unchanged — both are presigned now.

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS (exit 0).

- [ ] **Step 3: Commit**

```bash
git add components/Lightbox.tsx
git commit -m "refactor: Lightbox download uses presigned R2 URL"
```

---

## Task 8: Zip fetches presigned R2 URLs directly

> **CORS dependency:** This task switches zip fetches from the same-origin `/api/photo/{id}` proxy to a cross-origin R2 URL. The browser will block `fetch()` response bodies for cross-origin requests unless the server sends `Access-Control-Allow-Origin`. **Task 9's CORS script must be applied against the production bucket before this task is deployed**, or zip downloads will silently break with a CORS error in the browser console.

**Files:**
- Modify: `components/GalleryClient.tsx`

- [ ] **Step 1: Replace the proxy fetch in `downloadPhotos` (line ~140)**

Replace:

```ts
          const res = await fetch(`/api/photo/${photo.id}`, { signal: controller.signal });
```

with:

```ts
          const res = await fetch(photo.downloadUrl, { signal: controller.signal });
```

The presigned download URL points at the full-resolution original with attachment disposition; `jszip` only needs the blob body, which works cross-origin once CORS is set (Task 9). Reading the blob preserves the bytes.

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS (exit 0).

- [ ] **Step 3: Commit**

```bash
git add components/GalleryClient.tsx
git commit -m "feat: zip downloads fetch presigned R2 URLs directly (no Vercel proxy)"
```

---

## Task 9: R2 CORS policy script

**Files:**
- Create: `scripts/set-r2-cors.ts`

The browser-side zip does `fetch(photo.downloadUrl)` cross-origin and reads the response body, which requires the R2 bucket to send CORS headers for our origins.

- [ ] **Step 1: Create the script**

Create `scripts/set-r2-cors.ts`:

```ts
import 'dotenv/config';
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const origins = (
  process.env.CORS_ALLOWED_ORIGINS ??
  'https://www.cmojiang.com,https://cmojiang.com,http://localhost:3000'
)
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

async function main() {
  await r2.send(
    new PutBucketCorsCommand({
      Bucket: process.env.R2_BUCKET_NAME ?? 'cmojiang-photos',
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: ['GET', 'HEAD'],
            AllowedOrigins: origins,
            AllowedHeaders: ['*'],
            ExposeHeaders: ['Content-Length', 'Content-Type'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
  console.log('R2 CORS applied for origins:', origins);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it against R2**

Run: `npx ts-node -r dotenv/config --project tsconfig.json scripts/set-r2-cors.ts`
Expected: prints `R2 CORS applied for origins: [...]` with no error.

- [ ] **Step 3: Verify the preflight succeeds**

After deploying Tasks 1–8 to a preview/prod URL, open a gallery and click "Download all". In DevTools → Network, the R2 requests should return `200` with an `access-control-allow-origin` header and the zip should build. If they fail with a CORS error, re-check the origins list includes the exact deployed origin.

- [ ] **Step 4: Commit**

```bash
git add scripts/set-r2-cors.ts
git commit -m "chore: add R2 CORS configuration script"
```

---

## Task 10: Lock the R2 bucket (disable public read) — INFRA, deploy-gated

**Files:** none (Cloudflare dashboard / API)

> Do this **only after** Tasks 1–9 are deployed to production and verified. Presigned URLs work whether the bucket is public or private; this step removes the public path that currently makes the password meaningless.

- [ ] **Step 1: Record the current public URL**

Note `R2_PUBLIC_URL` and pick a real key from the DB, e.g. `https://<R2_PUBLIC_URL>/<collectionId>/<photoId>.jpg`.

- [ ] **Step 2: Confirm a raw path is currently public (baseline)**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "https://<R2_PUBLIC_URL>/<collectionId>/<photoId>.jpg"`
Expected: `200` (still public — this is what we're closing).

- [ ] **Step 3: Disable public access in Cloudflare**

In the Cloudflare dashboard: R2 → bucket `cmojiang-photos` → Settings → Public access. Remove/disable the `r2.dev` public URL and any public custom domain bound for unauthenticated reads. (Presigned URLs use the S3 endpoint with credentials and are unaffected.)

- [ ] **Step 4: Verify the raw path is now blocked**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "https://<R2_PUBLIC_URL>/<collectionId>/<photoId>.jpg"`
Expected: `403` or `404` (no longer publicly fetchable).

- [ ] **Step 5: Verify presigned access still works**

Load a gallery in the browser (logged in / unlocked). Thumbnails, lightbox full-res, single download, and "Download all" must all still work (they use presigned URLs). If images break, the bucket lock removed access the signatures still rely on — re-enable public access and investigate before proceeding.

- [ ] **Step 6: Note completion**

No commit (infra change). Record in the PR description that public access was disabled and verified.

---

## Task 11: Remove the dead proxy and public-URL helpers

**Files:**
- Delete: `app/api/photo/[id]/route.ts` (and its now-empty `[id]` dir)
- Modify: `lib/r2.ts`

- [ ] **Step 1: Confirm no remaining references to the proxy**

Run: `grep -rn "/api/photo/" app components 2>/dev/null || echo "no references"`
Expected: `no references` (Tasks 6–8 removed them all).

- [ ] **Step 2: Delete the proxy route**

Run: `rm -rf "app/api/photo/[id]"`

- [ ] **Step 3: Confirm `publicPhotoUrl` and `getDownloadUrl` are unused**

Run: `grep -rn "publicPhotoUrl\|getDownloadUrl" app components scripts 2>/dev/null || echo "unused"`
Expected: `unused` (all display sites migrated to `signViewUrl`; the proxy that used `getDownloadUrl` is gone).

- [ ] **Step 4: Remove the dead helpers from `lib/r2.ts`**

Delete the `publicPhotoUrl` function and the `getDownloadUrl` function (keep `signViewUrl`, `signDownloadUrl`, `getUploadUrl`, `thumbPath`, `deleteObject`, `deleteObjects`, and the `r2` client). Leave the `R2_PUBLIC_URL` constant only if still referenced; otherwise delete it too (it becomes unused once `publicPhotoUrl` is gone — remove the `const R2_PUBLIC_URL = ...` line).

- [ ] **Step 5: Typecheck + tests**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/jest`
Expected: tsc exit 0; all Jest suites pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove /api/photo proxy and public-URL helpers"
```

---

## Task 12: Full verification + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Build, lint, test**

Run: `./node_modules/.bin/tsc --noEmit && npm run lint && ./node_modules/.bin/jest && npm run build`
Expected: tsc exit 0; lint only the known `<img>` warnings; Jest green; build succeeds with no `/api/photo/[id]` route in the output.

- [ ] **Step 2: Manual browser smoke (preview server)**

Start the dev server, then verify in the browser:
- Gallery thumbnails load (presigned), no broken images.
- Open the lightbox → full-res shows.
- Per-photo download button downloads with the correct filename.
- "Select" → choose a few → "Download N" produces a working zip.
- "Download all" produces a working zip.
- Liked-photos page (`/profile/likes`) shows thumbnails and per-photo download works.
- Admin manage page thumbnails load.

- [ ] **Step 3: Update CLAUDE.md**

In `CLAUDE.md` (at the project root), update the "Photos publicly accessible without auth" Known Issue and the Gallery data-flow section to state photos are now served via 24h presigned R2 URLs, downloads/zip fetch R2 directly (CORS-enabled), the `/api/photo/[id]` proxy was removed, and the bucket's public read is disabled. Remove the `GET /api/photo/[id]` row from the API table.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document private presigned-photo model"
```

---

## Self-Review Notes

- **Spec coverage:** display privatization (Tasks 2–4), download/zip direct-to-R2 (Tasks 6–8), CORS (Task 9), bucket lock (Task 10), proxy removal (Task 11), verification/docs (Task 12). 24h expiry via `PHOTO_URL_TTL` (Task 1). All locked decisions covered.
- **Type consistency:** `downloadUrl` is the single property name across `GalleryPhoto`, `LikedPhoto`, `MasonryGrid.Photo`, `Lightbox.Photo`; `signViewUrl`/`signDownloadUrl`/`PHOTO_URL_TTL` names match between Task 1 and all callers.
- **Ordering risk:** Task 10 is explicitly gated behind deployment + verification of 1–9 to avoid taking the live site down. Tasks 2–3 reference a `downloadUrl` prop that only type-checks after Task 5 — called out in those tasks' typecheck steps.
- **Out of scope (intentional):** `password_plain` (user chose keep), thumbnail backfill, pagination, rate-limit changes (already shipped).
