# cmojiang — Photo Gallery

Personal password-protected photo gallery for Caden Jiang. Built with Next.js 14 App Router, Cloudflare R2 for object storage, and Supabase (Postgres) for metadata.

Deployed at: **https://www.cmojiang.com**

---

## Cost Sensitivity — Flag Before Implementing

This is a personal project on free tiers. **Before making any change that could increase Vercel or Supabase usage, flag it explicitly and get confirmation.** Do not implement silently.

Changes that increase costs:
- Removing `revalidate = 0` guards or adding server-side data fetching to high-traffic pages (more Vercel function invocations + Supabase queries)
- Adding `revalidate = 0` to pages that were previously statically cached (forces dynamic rendering on every request)
- Server-side work proportional to collection/photo count (e.g. signing N presigned URLs per page load)
- New API routes called on every page view
- Polling, background jobs, or scheduled fetches
- Storing large data in Supabase (current free limit: 500MB storage, 2GB bandwidth/month)
- Increasing Vercel function execution time or memory (current free limit: 100GB-hrs/month)

Current known cost drivers:
- Gallery page generates presigned R2 URLs for every photo on each load (180 AWS SDK calls for a 60-photo gallery)
- `revalidate = 0` on home, admin dashboard, manage collection, and profile pages (dynamic render per request)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2 (App Router) |
| Database | Supabase (Postgres via `supabaseAdmin`) |
| Object Storage | Cloudflare R2 (S3-compatible, `@aws-sdk/client-s3`) |
| Auth tokens | `jose` HS256 JWTs |
| Password hashing | `bcryptjs` (12 rounds) |
| Cache + rate limiting | Upstash Redis (`@upstash/redis`, `@upstash/ratelimit`) — optional, fails open/uncached if env vars absent |
| Client zip | `jszip` (dynamic import, via `lib/zip.ts`) |
| HEIC conversion | `heic2any` (client-side, sequential) |
| EXIF capture time | `exifr` (client-side at upload, dynamic import) |
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
GOOGLE_CLIENT_ID        (Google OAuth 2.0 client ID)
GOOGLE_CLIENT_SECRET    (Google OAuth 2.0 client secret)
NEXT_PUBLIC_BASE_URL    (e.g. https://www.cmojiang.com — used for OAuth callback URL)
UPSTASH_REDIS_REST_URL   (or KV_REST_API_URL — optional; enables Redis cache + rate limiting)
UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN)
```

All env vars fall back to `"placeholder"` strings if missing — no startup crash or validation.

---

## Database Schema

```
users               id, username, email, password_hash, created_at
collections         id, name, password_hash, password_plain*, event_date, is_private, created_at
photos              id, collection_id, filename, storage_path, uploaded_at,
                    width INTEGER, height INTEGER, dominant_color TEXT,
                    taken_at TIMESTAMPTZ  (EXIF capture time, set at upload)
kudos               id, user_id, collection_id, created_at  [unique: user_id+collection_id]
comments            id, user_id, collection_id, content, created_at
user_collection_access  id, user_id, collection_id, accessed_at  [unique: user_id+collection_id]
photo_likes         id, user_id, photo_id, created_at  [unique: user_id+photo_id]
```

`*` `password_plain` stores the raw collection password alongside the bcrypt hash — **intentional**: Caden re-shares collection passwords from the admin dashboard. Do not remove.

Signup and OAuth handle Postgres unique violations (code `23505`) on insert, but `users.username` and `users.email` need actual UNIQUE constraints in the DB for that to be atomic:
```sql
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
```

**Required migration for capture-time ordering** (July 2026 — reads fall back gracefully if missing, but new uploads with EXIF dates will fail to register until this runs):
```sql
ALTER TABLE photos ADD COLUMN taken_at TIMESTAMPTZ;
```

**Required DB migrations** (run once in Supabase SQL editor — columns/tables may not exist yet):
```sql
ALTER TABLE photos ADD COLUMN width INTEGER;
ALTER TABLE photos ADD COLUMN height INTEGER;
ALTER TABLE photos ADD COLUMN dominant_color TEXT;

CREATE TABLE photo_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, photo_id)
);
```
Existing rows return null for optional columns, which the app handles gracefully.

---

## R2 Storage Layout

```
{collectionId}/{photoId}.{ext}        ← original full-resolution
{collectionId}/t/{photoId}.{ext}      ← thumbnail (max 600px wide, JPEG 0.8)
```

Photos are served via **presigned R2 URLs** (24-hour TTL). The bucket's public-read access can be disabled in the Cloudflare dashboard (Task 10 in the privatization plan) to make access genuinely private. Until public-read is disabled, a raw storage path is still accessible to anyone who knows it.

Key functions in `lib/r2.ts`:
- `getUploadUrl(key, contentType)` — presigned PUT URL (1-hour expiry, `Cache-Control: public, max-age=31536000, immutable`)
- `signViewUrl(key, expiresIn?)` — presigned GET URL for display (default 24-hour expiry)
- `signDownloadUrl(key, filename, expiresIn?)` — presigned GET URL with `Content-Disposition: attachment` for downloads (default 24-hour expiry)
- `thumbPath(storagePath)` — inserts `/t/` after the first path segment to derive thumbnail path
- `deleteObject(key)` — delete one R2 object
- `deleteObjects(keys)` — bulk delete via `DeleteObjectsCommand`

---

## Authentication: Three Independent Sessions

All three session types use the same `JWT_SECRET` with `jose` HS256.

| Cookie | Duration | JWT payload | Verified via |
|---|---|---|---|
| `admin_session` | 7 days | `{ admin: true }` | `crypto.timingSafeEqual` vs `ADMIN_PASSWORD` |
| `user_session` | 30 days | `{ userId, username }` | bcrypt vs `users.password_hash`, or Google OAuth |
| `gallery_session` | 30 days | `{ collectionId }` | bcrypt vs `collections.password_hash` |

All cookies: `httpOnly: true`, `sameSite: lax`, `secure` in production.

Google OAuth: `GET /api/auth/google` redirects to Google with a random `state` stored in an httpOnly cookie; `GET /api/auth/google/callback` verifies state, exchanges the code, then matches the user by email or creates an account with a derived username and random password hash.

**Invite links**: admin mints a 30-day invite token (`POST /api/admin/collections/[id]/invite` → `{ url }`, copied from the manage page). The link (`/join/<jwt>`) exchanges the token for a `gallery_session` and redirects into the gallery — no password typing. Token payload is `{ collectionId, invite: true }`, same `JWT_SECRET`.

When a logged-in user unlocks a collection, a `user_collection_access` row is upserted. On subsequent visits to `/c/[id]`, the server checks for that row and redirects straight to the gallery, skipping the password form. A valid `admin_session` can view any gallery without a `gallery_session`.

Middleware (`middleware.ts`) protects `/admin/:path+` and `/api/admin/((?!login).+)` by verifying `admin_session`.

**Rate limiting** (`lib/ratelimit.ts`, Upstash sliding window, keyed by client IP; fails open without Redis env vars): unlock 10/15m, login 10/15m, signup 5/60m, admin login 5/15m (failed attempts only).

---

## Page & Data Flow

### Home (`/`)
- Server component (`revalidate = 0`). Queries public collections (`is_private = false`) with photo counts, ordered by `event_date` descending.
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
- Server component. Verifies `gallery_session` cookie (must match `collectionId`) or a valid `admin_session`.
- Photo rows come from `fetchPhotosChronological` (`lib/photos.ts`) — ordered by EXIF capture time (`taken_at`), falling back to `uploaded_at`, earliest first so the gallery reads like the event. Sorting happens in JS so the fallback is a plain `COALESCE`-style coalesce; if the `taken_at` column doesn't exist yet the query retries without it.
- Rows are wrapped in a Redis cache (`lib/redis.ts` `cachedFetch`, key `gallery:v3:{id}:photos`, 5-min TTL) — photo mutations in the admin routes bust this key via `invalidate()`. Falls through to Supabase when Redis isn't configured.
- `?photo=<id>` deep-links open the lightbox on that photo; the lightbox keeps the param in sync via `history.replaceState`.
- Generates **presigned R2 URLs** (24h TTL) for thumbnails, originals, and downloads — URL generation happens outside the cache boundary so an expiring signature is never cached:
  ```ts
  url:         await signViewUrl(thumbPath(photo.storage_path))     // thumbnail
  originalUrl: await signViewUrl(photo.storage_path)                // full-res view
  downloadUrl: await signDownloadUrl(photo.storage_path, filename)  // forced download
  ```
- Injects `<link rel="preload" as="image">` for the first 8 thumbnails in the HTML head.
- Fetches kudos count, whether current user has given kudos, all comments, and the user's liked photo IDs server-side.
- Passes everything to `GalleryClient` as props — no client-side API calls on initial load.
- On signing errors, renders a "temporarily unavailable" message instead of the grid.

### Profile (`/profile`) and Liked Photos (`/profile/likes`)
- Require `user_session` (redirect to `/login`). `revalidate = 0`.
- Likes page fetches all of the user's `photo_likes` joined to photos, signs presigned URLs per photo, and groups them into per-collection sections (`LikedPhotosClient`) with unlike, select, and per-gallery zip download.

### Admin Login (`/admin`)
- Simple password form that POSTs to `/api/admin/login`.

### Admin Dashboard (`/admin/dashboard`)
- Lists all collections with photo count and plaintext password displayed inline.

### Admin Manage Collection (`/admin/collections/[id]`)
- Renders `ManageCollectionClient` with collection info and initial photo list.

---

## Components

### `MasonryGrid`
Flex-column masonry layout. Column count comes from breakpoint × `sizeLevel` prop (1 smallest – 4 largest, default 2 ⇒ 2/3/4 columns on mobile/tablet/desktop). Double-tap heart burst is pink for like, gray + crossed out for unlike (liked state read before the optimistic toggle). Per-image state:
- `loadedIds` — tracks which images have fired `onLoad` to drive opacity fade-in.
- First 8 images: `loading="eager"` + `fetchPriority="high"`. Rest: `loading="lazy"`.
- `width`/`height` attributes set when available to prevent CLS.
- Button background uses `dominantColor` placeholder while image loads.
- When `onTap` prop is provided (always from `GalleryClient`), clicks delegate to parent. Without `onTap`, uses internal lightbox state.

### `GalleryClient`
Manages selection mode, lightbox, likes, infinite scroll, and download:
- Renders photos in batches of 24 with an IntersectionObserver sentinel (600px rootMargin) for infinite scroll.
- Magnifier bar (range slider in the action row) scales photo size by driving `MasonryGrid`'s `sizeLevel`; persisted in `localStorage['gallery-size']`, restored after mount to avoid SSR mismatch.
- Double-tap (or heart button) toggles a photo like, optimistic with revert on failure.
- "Download all" and selection download call `downloadPhotosAsZip()` in `lib/zip.ts`: fetches originals via `photo.downloadUrl` (presigned R2 URL, direct — no Vercel proxy) with **bounded concurrency (6 at a time)**, accumulates blobs in memory, generates zip client-side with `jszip`. Failed fetches are counted and surfaced ("N of M photos couldn't be downloaded"); blobs still all sit in memory until zip generation, so very large collections remain memory-heavy.
- Zip progress bar fills to 100% during fetch phase; zip generation phase has no progress.
- Bottom bar appears in selection mode with "Download N" button.
- `LikedPhotosClient` shares the same zip helper and error surfacing.

### `Lightbox`
- Displays `photo.originalUrl ?? photo.url` (presigned R2 URL — no API call).
- Arrow key navigation, Escape to close, `focus-trap-react` for accessibility.
- Touch gestures via pointer events: swipe left/right to navigate, swipe down to close, pinch to zoom (1–4×) with pan, double-tap to zoom to the tap point.
- `onIndexChange` callback lets `GalleryClient` keep `?photo=` in the URL; `showShare` adds a Share button (native share sheet, clipboard fallback) — gallery pages only. Also used standalone by `MasonryGrid`'s internal lightbox on `/profile/likes` (so that "unreachable lightbox" note was wrong — it's exercised there).
- Download button is an `<a href={photo.downloadUrl}>` pointing to the presigned download URL (direct R2, no Vercel proxy).

### `KudosButton`
- Optimistic update with revert on failure. `loading` guard prevents double-submission.
- Requires `user_session` to toggle; display is visible to all.

### `CommentSection`
- Renders initial comments from props. POST/DELETE via fetch.
- Delete button visible only to comment owner (matched by `username`), behind a `window.confirm` dialog.
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

Steps in `ManageCollectionClient.tsx`:

0. **EXIF capture time** — `exifr` reads `DateTimeOriginal`/`CreateDate` from the original files (before HEIC conversion, which strips metadata). Best-effort; missing EXIF means `taken_at` stays null and the photo sorts by upload time.

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
| `POST /api/unlock` | none (rate limited) | Validate collection password, set `gallery_session` |
| `POST /api/login` | none (rate limited) | Validate user password, set `user_session` |
| `POST /api/signup` | none (rate limited) | Create user account |
| `POST /api/logout` | none | Clear `user_session` cookie |
| `GET /api/auth/google` | none | Start Google OAuth (sets `oauth_state` cookie) |
| `GET /api/auth/google/callback` | `oauth_state` | Finish OAuth, set `user_session` |
| `GET /api/gallery-access?id=` | `user_session` | If a `user_collection_access` row exists, mint a `gallery_session` and redirect to the gallery |
| `GET /join/[token]` | signed invite token | Exchange invite token for `gallery_session`, redirect to gallery |
| `GET/POST /api/collections/[id]/kudos` | GET: none, POST: `user_session` | Read kudos count + toggle |
| `GET/POST /api/collections/[id]/comments` | GET: `gallery_session` or admin, POST: `user_session` + gallery/admin | Read / post comments |
| `DELETE /api/comments/[id]` | `user_session` | Delete own comment (ownership verified) |
| `POST /api/photos/[id]/like` | `user_session` | Toggle a photo like |
| `POST /api/admin/login` | none (failed attempts rate limited) → sets `admin_session` | Admin login |
| `POST /api/admin/logout` | none | Clear `admin_session` |
| `GET/POST /api/admin/collections` | `admin_session` | List / create collections |
| `PATCH/DELETE /api/admin/collections/[id]` | `admin_session` | Rename, change password, or delete collection + R2 cleanup |
| `POST /api/admin/collections/[id]/photos/upload-url` | `admin_session` | Get presigned PUT URLs for direct R2 upload |
| `POST/DELETE /api/admin/collections/[id]/photos` | `admin_session` | Register photos in DB / delete photos (single `photoId` or bulk `photoIds`) from R2 + DB |
| `POST /api/admin/collections/[id]/invite` | `admin_session` | Mint a 30-day invite link |

---

## Testing

Jest with `ts-jest` and `jest-environment-node`. Run with `npm test` or `npm run test:watch`.

Tests live in `__tests__/`:
- `api/unlock.test.ts` — tests `POST /api/unlock` (missing fields, not found, wrong password, correct password sets cookie)
- `lib/auth.test.ts` — tests JWT sign/verify functions
- `lib/r2.test.ts` — tests R2 helpers (e.g. `thumbPath`)

Supabase and bcrypt are mocked in tests. No E2E or integration tests exist.

---

## Scripts

`scripts/migrate-to-r2.ts` — one-time migration that copies photos from Supabase Storage to Cloudflare R2. Checks if each key already exists in R2 (via `HeadObject`) before copying. Run with:
```
npx ts-node -r dotenv/config --project tsconfig.json scripts/migrate-to-r2.ts
```

`scripts/set-r2-cors.ts` — applies the R2 bucket CORS policy (allows GET/HEAD from production origins). Run once before deploying the presigned-URL feature:
```
npx ts-node -r dotenv/config --project tsconfig.json scripts/set-r2-cors.ts
```

---

## Known Issues

### Accepted by design (do not "fix" without asking)

- **Plaintext collection password stored and displayed** — `collections.password_plain` is intentional: Caden re-shares collection passwords from the admin dashboard. Mitigation if ever wanted: encrypt at rest instead of removing.
- **No email verification on signup** — accounts are active immediately.

### High

- **Photos still reachable if bucket stays public** — photos are served via 24h presigned R2 URLs, but until public-read access is disabled on the R2 bucket in Cloudflare (Task 10 in the privatization plan), a raw storage path is still accessible to anyone who knows or guesses it. This is a Cloudflare dashboard action, not a code change.

- **Rate limiting fails open without Redis** — if the Upstash env vars aren't set in production, all auth endpoints are unlimited. Verify `UPSTASH_REDIS_REST_URL`/`TOKEN` (or `KV_*`) exist in Vercel.

### Medium

- **Zip blobs still accumulate in memory** — fetches are now bounded to 6 concurrent, but all blobs are held until zip generation. Very large collections remain memory-heavy in the browser tab; a streaming zip writer would fix it.

- **Zip progress bar covers only the fetch phase** — zip generation has no progress indicator.

- **`users.username`/`users.email` unique constraints assumed** — the API maps `23505` to a 409, but the constraints must exist in the DB (SQL above) for signup races to be safe.

- **`setAll() {}` is a no-op** in `createServerSupabaseClient` (`lib/supabase.ts`) — Supabase SSR cannot persist auth state, making the SSR client effectively read-only.

- **`POST /api/photos/[id]/like` doesn't check gallery access** — any logged-in user who knows a photo UUID can like it. UUIDs are unguessable, so low practical risk.

### Low

- No startup validation of required env vars — missing secrets silently become `"placeholder"` strings.
- No server-side file size or MIME type validation on upload — client sends whatever it wants.
- No pagination on home page or admin dashboard — all collections load at once (photo grids use client-side batching).
- `SearchBar` has no debounce — filters on every keystroke (in-memory, so harmless at current scale).
- Width/height/dominant_color features require a DB migration that may not have been run yet; the gallery page will return no photos if the columns don't exist (Supabase returns an error for unknown columns in SELECT).

### Fixed (July 2026 audit)

- Rate limiting on unlock/login/signup/admin-login (Upstash sliding window).
- Timing-safe admin password comparison.
- Thumbnails deleted alongside originals on photo and collection delete.
- Dead-code routes removed, including unauthenticated `GET /api/collections` and `GET /api/collections/[id]`, which leaked private collection names/IDs.
- Zip downloads bounded to 6 concurrent fetches with failed-download reporting (`lib/zip.ts`).
- Comment deletion confirmation dialog.
- Signup and like-toggle handle `23505` unique-violation races.
- Stray comments (`// hi`, `// hello from eric kim`, `// hehe`) removed.
