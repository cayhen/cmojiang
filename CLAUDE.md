# cmojiang — Photo Gallery

Personal password-protected photo gallery for Caden Jiang. Built with Next.js 14 App Router, Cloudflare R2 for object storage, and Supabase (Postgres) for metadata.

Deployed at: **https://www.cmojiang.com**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2 (App Router) |
| Database | Supabase (Postgres via `supabaseAdmin`) |
| Object Storage | Cloudflare R2 (S3-compatible, `@aws-sdk/client-s3`) |
| Auth tokens | `jose` HS256 JWTs |
| Password hashing | `bcryptjs` (12 rounds) |
| Client zip | `jszip` (dynamic import) |
| Server zip | `archiver` (dead code — not called by UI) |
| HEIC conversion | `heic2any` (client-side, sequential) |
| Lightbox focus | `focus-trap-react` |
| Tests | Jest + `ts-jest` + `jest-environment-node` |

---

## Environment Variables

```
JWT_SECRET
ADMIN_PASSWORD
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME          (default: cmojiang-photos)
R2_PUBLIC_URL
```

All env vars fall back to `"placeholder"` strings if missing — no startup crash or validation.

---

## Database Schema

```
users               id, username, email, password_hash, created_at
collections         id, name, password_hash, password_plain*, created_at
photos              id, collection_id, filename, storage_path, uploaded_at,
                    width INTEGER, height INTEGER, dominant_color TEXT
kudos               id, user_id, collection_id, created_at  [unique: user_id+collection_id]
comments            id, user_id, collection_id, content, created_at
user_collection_access  id, user_id, collection_id, accessed_at  [unique: user_id+collection_id]
```

`*` `password_plain` stores the raw collection password alongside the bcrypt hash — a critical security flaw (see Known Issues).

**Required DB migration** (run once in Supabase SQL editor — columns may not exist yet):
```sql
ALTER TABLE photos ADD COLUMN width INTEGER;
ALTER TABLE photos ADD COLUMN height INTEGER;
ALTER TABLE photos ADD COLUMN dominant_color TEXT;
```
Existing rows return null for these columns, which the app handles gracefully.

---

## R2 Storage Layout

```
{collectionId}/{photoId}.{ext}        ← original full-resolution
{collectionId}/t/{photoId}.{ext}      ← thumbnail (max 600px wide, JPEG 0.8)
```

The bucket has **public read access**. `publicPhotoUrl(key)` returns `${R2_PUBLIC_URL}/${key}` — no signing, no auth. Anyone with a key path can fetch the bytes directly.

Key functions in `lib/r2.ts`:
- `getUploadUrl(key, contentType)` — presigned PUT URL (1-hour expiry, `Cache-Control: public, max-age=31536000, immutable`)
- `getDownloadUrl(key, expiresIn)` — presigned GET URL (default 1-hour expiry)
- `publicPhotoUrl(key)` — direct public URL (no signing)
- `thumbPath(storagePath)` — inserts `/t/` after the first path segment to derive thumbnail path
- `deleteObject(key)` — delete one R2 object
- `deleteObjects(keys)` — bulk delete via `DeleteObjectsCommand`

---

## Authentication: Three Independent Sessions

All three session types use the same `JWT_SECRET` with `jose` HS256.

| Cookie | Duration | JWT payload | Verified via |
|---|---|---|---|
| `admin_session` | 7 days | `{ admin: true }` | `=== ADMIN_PASSWORD` (non-timing-safe) |
| `user_session` | 30 days | `{ userId, username }` | bcrypt vs `users.password_hash` |
| `gallery_session` | 7 days | `{ collectionId }` | bcrypt vs `collections.password_hash` |

All cookies: `httpOnly: true`, `sameSite: lax`, `secure` in production.

When a logged-in user unlocks a collection, a `user_collection_access` row is upserted. On subsequent visits to `/c/[id]`, the server checks for that row and redirects straight to the gallery, skipping the password form.

Middleware (`middleware.ts`) protects `/admin/:path+` and `/api/admin/((?!login).+)` by verifying `admin_session`. File ends with stray comment `// hi`.

---

## Page & Data Flow

### Home (`/`)
- Server component. Queries all collections with photo counts (`photos(count)` Supabase aggregate).
- Renders `SearchBar` (client component — filters in-memory on every keystroke, no debounce) and `CollectionCard` grid.
- Footer has hidden admin link `/admin`.
- No error handling on the Supabase query.

### Login (`/login`) / Signup (`/signup`)
- Client-side forms that POST to `/api/login` or `/api/signup`.
- On success, redirects to `/` with `user_session` cookie set.
- Signup enforces password ≥ 8 chars client-side and server-side.

### Unlock (`/c/[id]`)
- Checks `user_collection_access` for logged-in user → redirects to gallery if found.
- Otherwise renders `UnlockForm` (client component).
- `UnlockForm` → `POST /api/unlock` → bcrypt compare → sets `gallery_session` cookie → CSS fade animation (`setTimeout` chain) → navigates to gallery at 1250ms.

### Gallery (`/c/[id]/gallery`)
- Server component. Verifies `gallery_session` cookie (must match `collectionId`).
- Fetches all photos from Supabase, selecting `id, filename, storage_path, width, height, dominant_color`.
- Generates **public R2 URLs** for thumbnails and originals — no presigning, no session gate on bytes:
  ```ts
  url:         publicPhotoUrl(thumbPath(photo.storage_path))  // thumbnail
  originalUrl: publicPhotoUrl(photo.storage_path)             // full-res
  ```
- Injects `<link rel="preload" as="image">` for the first 8 thumbnails in the HTML head.
- Fetches kudos count, whether current user has given kudos, and all comments server-side.
- Passes everything to `GalleryClient` as props — no client-side API calls on initial load.

### Admin Login (`/admin`)
- Simple password form that POSTs to `/api/admin/login`.

### Admin Dashboard (`/admin/dashboard`)
- Lists all collections with photo count and plaintext password displayed inline.

### Admin Manage Collection (`/admin/collections/[id]`)
- Renders `ManageCollectionClient` with collection info and initial photo list.

---

## Components

### `MasonryGrid`
CSS `columns-2 sm:columns-3 lg:columns-4` masonry layout. Per-image state:
- `loadedIds` — tracks which images have fired `onLoad` to drive opacity fade-in.
- First 8 images: `loading="eager"` + `fetchPriority="high"`. Rest: `loading="lazy"`.
- `width`/`height` attributes set when available to prevent CLS.
- Button background uses `dominantColor` placeholder while image loads.
- When `onTap` prop is provided (always from `GalleryClient`), clicks delegate to parent. Without `onTap`, uses internal lightbox state.

### `GalleryClient`
Manages selection mode, lightbox, and download:
- "↓ All" button and selection download call `downloadPhotos()`: fetches originals via `/api/photo/{id}` in parallel, accumulates blobs in memory, generates zip client-side with `jszip`.
- Zip progress bar fills to 100% during fetch phase; zip generation phase has no progress.
- Bottom bar appears in selection mode with "Download N" button.

### `Lightbox`
- Displays `photo.originalUrl ?? photo.url` (direct public R2 URL — no API call).
- Arrow key navigation, Escape to close, `focus-trap-react` for accessibility.
- Download button links to `/api/photo/{id}` (proxied, forced download).

### `KudosButton`
- Optimistic update with revert on failure. `loading` guard prevents double-submission.
- Requires `user_session` to toggle; display is visible to all.

### `CommentSection`
- Renders initial comments from props. POST/DELETE via fetch.
- Delete button visible only to comment owner (matched by `username`). Fires immediately, no confirmation dialog.
- Only logged-in users (`user_session`) can post; all gallery visitors can read.

### `UserNav` / `UserNavClient`
- `UserNav` is a server component that reads `user_session` and passes `username` to `UserNavClient` (client component).
- Shows username + logout link when logged in; login/signup links otherwise.

### `SearchBar` / `CollectionCard`
- `SearchBar`: client component, case-insensitive substring filter on collection names, no debounce.
- `CollectionCard`: plain link card showing name and photo count.

### `UnlockForm`
- Client form. Shows error on wrong password. Runs fade animation then navigates on success.

---

## Admin Upload Flow

Three steps in `ManageCollectionClient.tsx`:

1. **HEIC conversion** (if needed) — sequential, blocks main thread via `heic2any`.

2. **Get presigned URLs** — `POST /api/admin/collections/[id]/photos/upload-url`
   - Server assigns a UUID photo ID per file, derives storage paths for original and thumbnail.
   - Returns presigned PUT URLs (1-hour expiry) for both original and thumbnail.
   - Supports `.jpg/.jpeg/.png/.webp/.heic`; defaults to `image/jpeg` for unknown extensions.

3. **Upload directly to R2** — browser PUTs to presigned URLs (bypasses Vercel size limits).
   - Thumbnail: Canvas resized to max 600px wide, JPEG quality 0.8; `dominantColor` sampled via 5×5 grid of `getImageData` calls; `width`/`height` of the thumbnail canvas captured.
   - Original and thumbnail upload in parallel per photo; all photos upload in parallel.

4. **Register in DB** — `POST /api/admin/collections/[id]/photos`
   - Inserts `{ collection_id, storage_path, filename, width?, height?, dominant_color? }`.
   - On DB insert failure, calls `deleteObject(storagePath)` to clean up orphaned R2 object.

---

## Performance Optimizations (implemented)

| Optimization | Where | Effect |
|---|---|---|
| `<link rel="preload" as="image">` for first 8 thumbnails | `gallery/page.tsx` | Browser fetches hero images before React hydrates |
| `loading="eager"` + `fetchPriority="high"` on first 8 `<img>` | `MasonryGrid.tsx` | Improves LCP |
| `loading="lazy"` on images 9+ | `MasonryGrid.tsx` | Defers off-screen fetches |
| `width`/`height` on `<img>` when dims stored | `MasonryGrid.tsx` | Eliminates CLS (layout shift) |
| Dominant color placeholder on button background | `MasonryGrid.tsx` | No blank flash while image loads |
| Opacity fade-in via `onLoad` | `MasonryGrid.tsx` | Smooth appearance, no pop-in |
| Thumbnail canvas cap lowered to 600px | `ManageCollectionClient.tsx` | 2–4× smaller thumbnail files |
| `Cache-Control: public, max-age=31536000, immutable` on R2 uploads | `lib/r2.ts` | Browser and CDN cache photos permanently |

---

## API Routes Summary

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/unlock` | none | Validate collection password, set `gallery_session` |
| `POST /api/login` | none | Validate user password, set `user_session` |
| `POST /api/signup` | none | Create user account |
| `POST /api/logout` | none | Clear `user_session` cookie |
| `GET /api/photo/[id]` | `gallery_session` | Presigned R2 download, proxied with `Content-Disposition: attachment`; R2 first, Supabase Storage fallback |
| `GET /api/collections/[id]/photos` | `gallery_session` | Presigned download URLs for all photos **(dead code — never called)** |
| `GET /api/collections/[id]/zip` | `gallery_session` | Server-side zip via `archiver` **(dead code — never called; client uses jszip instead)** |
| `GET/POST /api/collections/[id]/kudos` | GET: none, POST: `user_session` | Read kudos count + toggle |
| `GET/POST /api/collections/[id]/comments` | GET: `gallery_session`, POST: both sessions | Read / post comments |
| `DELETE /api/comments/[id]` | `user_session` | Delete own comment (ownership verified) |
| `POST /api/admin/login` | none → sets `admin_session` | Admin login |
| `POST /api/admin/logout` | none | Clear `admin_session` |
| `GET/POST /api/admin/collections` | `admin_session` | List / create collections |
| `PATCH/DELETE /api/admin/collections/[id]` | `admin_session` | Rename, change password, or delete collection + R2 cleanup |
| `POST /api/admin/collections/[id]/photos/upload-url` | `admin_session` | Get presigned PUT URLs for direct R2 upload |
| `POST/DELETE /api/admin/collections/[id]/photos` | `admin_session` | Register photos in DB / delete photo from R2 + DB |

---

## Testing

Jest with `ts-jest` and `jest-environment-node`. Run with `npm test` or `npm run test:watch`.

Tests live in `__tests__/`:
- `api/unlock.test.ts` — tests `POST /api/unlock` (missing fields, not found, wrong password, correct password sets cookie)
- `lib/auth.test.ts` — tests JWT sign/verify functions

Supabase and bcrypt are mocked in tests. No E2E or integration tests exist.

---

## Scripts

`scripts/migrate-to-r2.ts` — one-time migration that copies photos from Supabase Storage to Cloudflare R2. Checks if each key already exists in R2 (via `HeadObject`) before copying. Run with:
```
npx ts-node -r dotenv/config --project tsconfig.json scripts/migrate-to-r2.ts
```

---

## Known Issues

### Critical

- **Plaintext password stored and displayed** — `collections.password_plain` stores the raw password alongside the bcrypt hash. Written on create (`app/api/admin/collections/route.ts:27`) and update (`app/api/admin/collections/[id]/route.ts:16`). Queried and displayed in admin dashboard (`app/admin/dashboard/page.tsx:9,36-37`) and manage page (`ManageCollectionClient.tsx:219`). A DB leak exposes all collection passwords in plaintext.

- **Photos publicly accessible without auth** — `originalUrl` and thumbnail `url` are direct public R2 URLs. `gallery_session` only controls which paths you learn; it does not gate access to the bytes. Anyone who knows or guesses a storage path can fetch a photo.

### High

- **Thumbnails never deleted** — `DELETE /api/admin/collections/[id]/photos` removes the original from R2 and the DB row but never calls `deleteObject(thumbPath(storagePath))`. Collection delete removes originals but not thumbnails. Orphaned thumbnails accumulate indefinitely in R2.

- **No rate limiting** — `/api/admin/login`, `/api/unlock`, `/api/login`, and `/api/signup` have no rate limiting or account lockout.

- **Admin password uses non-timing-safe comparison** — `app/api/admin/login/route.ts:11` uses `password !== process.env.ADMIN_PASSWORD` (string equality) instead of `crypto.timingSafeEqual()`, making it vulnerable to timing attacks.

- **Client-side zip loads entire collection into browser memory** — `GalleryClient.tsx:downloadPhotos` fetches all photo blobs in parallel and holds them all in memory before generating the zip. Large collections can crash or hang the browser tab.

- **Server-side zip buffers all photos in memory** — `app/api/collections/[id]/zip/route.ts` awaits `Promise.all(photos.map(...))` before piping to `archiver`, defeating streaming. This route is dead code but the bug would matter if it were called.

### Medium

- **`middleware.ts` ends with `// hi`** — stray comment on line 19.

- **`app/page.tsx` ends with `// hello from eric kim`** — stray comment on last line.

- **`app/layout.tsx` ends with `// hehe\``** — stray comment with trailing backtick on last line.

- **`GET /api/collections/[id]/photos` is dead code** — generates presigned download URLs on every request but is never called by any UI component.

- **`GET /api/collections/[id]/zip` is dead code** — `GalleryClient` uses client-side `jszip` instead.

- **No comment deletion confirmation** — `CommentSection.handleDelete` fires immediately with no dialog.

- **No email verification on signup** — accounts are immediately active after signup.

- **Zip progress bar is misleading** — the bar fills to 100% during the fetch phase; the actual zip generation step has no progress indicator.

- **`setAll() {}` is a no-op** in `createServerSupabaseClient` (`lib/supabase.ts`) — Supabase SSR cannot persist auth state, making the SSR client effectively read-only.

- **TOCTOU on signup** — username and email uniqueness are checked with two separate sequential queries before insert; not atomically enforced.

- **`MasonryGrid` internal lightbox state is unreachable in practice** — `lightboxIndex` state and the conditional `<Lightbox>` block are only reachable when `onTap` is not provided, but `GalleryClient` always provides `onTap`. The code is architecturally valid for standalone use but never exercised.

### Low

- No startup validation of required env vars — missing secrets silently become `"placeholder"` strings.
- No server-side file size or MIME type validation on upload — client sends whatever it wants.
- No pagination on home page or admin dashboard — all collections/photos load at once.
- `SearchBar` has no debounce — filters on every keystroke.
- Width/height/dominant_color features require a DB migration that may not have been run yet; the gallery page will return no photos if the columns don't exist (Supabase returns an error for unknown columns in SELECT).
