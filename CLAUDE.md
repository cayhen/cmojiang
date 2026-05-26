# cmojiang — Photo Gallery

Personal password-protected photo gallery for Caden Jiang. Built with Next.js 14 App Router, Cloudflare R2 for object storage, and Supabase (Postgres) for metadata.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14.2 (App Router) |
| Database | Supabase (Postgres via `supabaseAdmin`) |
| Object Storage | Cloudflare R2 (S3-compatible) |
| Auth tokens | `jose` HS256 JWTs |
| Password hashing | `bcryptjs` (12 rounds) |
| Client zip | `jszip` |
| Server zip | `archiver` |
| HEIC conversion | `heic2any` (client-side) |

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

All env vars fall back to `"placeholder"` strings if missing — no startup validation.

---

## Database Schema

```
users               id, username, email, password_hash, created_at
collections         id, name, password_hash, password_plain*, created_at
photos              id, collection_id, filename, storage_path, uploaded_at
kudos               id, user_id, collection_id, created_at  [unique: user_id+collection_id]
comments            id, user_id, collection_id, content, created_at
user_collection_access  id, user_id, collection_id, accessed_at  [unique: user_id+collection_id]
```

`*` `password_plain` stores the raw collection password alongside the bcrypt hash — a critical security flaw (see Known Issues).

---

## R2 Storage Layout

```
{collectionId}/{photoId}.{ext}        ← original
{collectionId}/t/{photoId}.{ext}      ← thumbnail
```

The bucket has **public read access**. `publicPhotoUrl(key)` returns `${R2_PUBLIC_URL}/${key}` — no signing, no auth. Anyone with a key path can fetch the bytes directly.

`thumbPath(storagePath)` inserts `/t/` after the first path segment to derive the thumbnail path from the original path.

---

## Authentication: Three Independent Sessions

All three session types use the same `JWT_SECRET` with `jose` HS256.

| Session cookie | Duration | Subject |
|---|---|---|
| `admin_session` | 7 days | Admin — verified via `=== ADMIN_PASSWORD` |
| `user_session` | 30 days | Registered user — bcrypt against `users.password_hash` |
| `gallery_session` | 7 days | One collection — bcrypt against `collections.password_hash` |

When a logged-in user unlocks a collection, a `user_collection_access` row is upserted. On subsequent visits to `/c/[id]`, the server checks for that row and redirects straight to the gallery, skipping the password form.

Middleware (`middleware.ts`) protects `/admin/:path+` and `/api/admin/((?!login).+)` by verifying `admin_session`.

---

## Page & Data Flow

### Home (`/`)
- Server component queries all collections with photo counts from Supabase.
- Renders `SearchBar` (client-side, no debounce) and `CollectionCard` list.
- No error handling on the Supabase query.

### Unlock (`/c/[id]`)
- Checks `user_collection_access` for the current user → redirects to gallery if found.
- Otherwise renders `UnlockForm`.
- `UnlockForm` → `POST /api/unlock` → bcrypt compare → sets `gallery_session` cookie → runs a CSS animation (chained `setTimeout`) → navigates to gallery at 1250ms.

### Gallery (`/c/[id]/gallery`)
- Server component. Verifies `gallery_session` cookie (must match `collectionId`).
- Fetches all photos from Supabase.
- Generates **public R2 URLs** for both thumbnails and originals — no presigning, no session gate on the bytes:
  ```ts
  url:         publicPhotoUrl(thumbPath(photo.storage_path))  // thumbnail
  originalUrl: publicPhotoUrl(photo.storage_path)             // full-res
  ```
- Passes everything to `GalleryClient` as props — no client-side API calls on initial load.

### GalleryClient (`components/GalleryClient.tsx`)
- Manages selection mode, lightbox open/close, and download.
- "↓ All" button and selection download both call `downloadPhotos()`:
  1. Fetches all selected (or all) photos via `/api/photo/{id}` in parallel.
  2. Accumulates all blobs in browser memory.
  3. Generates a zip client-side with `jszip`.
- The server-side zip endpoint (`/api/collections/[id]/zip`) exists but **is never called** — dead code.

### Lightbox (`components/Lightbox.tsx`)
- Displays `photo.originalUrl ?? photo.url` — a direct public R2 URL, no API call.
- Download button points to `/api/photo/{id}` (presigned, proxied, forces download).

### Kudos (`components/KudosButton.tsx`)
- Optimistic update with revert on failure.
- `loading` guard prevents double-submission.
- Server uses check-then-insert/delete pattern — race condition possible under concurrent requests.

### Comments (`app/api/collections/[id]/comments`)
- GET requires `gallery_session`.
- POST requires both `user_session` + `gallery_session`.
- DELETE (`/api/comments/[id]`) verifies `user_id` ownership before deleting.
- No server-side comment length limit. No deletion confirmation in UI.

---

## Admin Upload Flow

Three steps, all in `ManageCollectionClient.tsx`:

1. **Get presigned URLs** — `POST /api/admin/collections/[id]/photos/upload-url`
   - Server assigns a UUID photo ID, returns presigned PUT URLs for original + thumbnail (1-hour expiry).

2. **Upload directly to R2** — browser PUTs to the presigned URLs
   - HEIC files are converted to JPEG client-side via `heic2any` (sequential, blocks main thread).
   - Thumbnail is generated client-side via Canvas (max 1200px wide, JPEG quality 0.8) before upload.
   - Bypasses Vercel's request size limits entirely.

3. **Register in DB** — `POST /api/admin/collections/[id]/photos`
   - Server inserts photo metadata into Supabase.
   - If DB insert fails, server calls `deleteObject` on R2 to clean up the orphaned upload.

---

## API Routes Summary

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/unlock` | none | Validate collection password, set `gallery_session` |
| `POST /api/login` | none | Validate user password, set `user_session` |
| `POST /api/signup` | none | Create user account |
| `GET /api/photo/[id]` | `gallery_session` | Presigned R2 download, proxied |
| `GET /api/collections/[id]/photos` | `gallery_session` | Returns photos with presigned URLs **(dead code)** |
| `GET /api/collections/[id]/zip` | `gallery_session` | Server-side zip **(dead code)** |
| `GET/POST /api/collections/[id]/kudos` | varies | Read/toggle kudos |
| `GET/POST /api/collections/[id]/comments` | `gallery_session` | Read/post comments |
| `DELETE /api/comments/[id]` | `user_session` | Delete own comment |
| `POST /api/admin/login` | none → sets `admin_session` | Admin login |
| `GET/POST /api/admin/collections` | `admin_session` | List/create collections |
| `PATCH/DELETE /api/admin/collections/[id]` | `admin_session` | Rename/change password/delete collection |
| `POST /api/admin/collections/[id]/photos/upload-url` | `admin_session` | Get presigned PUT URLs |
| `POST/DELETE /api/admin/collections/[id]/photos` | `admin_session` | Register/delete photos |

---

## Known Issues

### Critical

- **Plaintext password stored and displayed** — `collections.password_plain` stores the raw password alongside the bcrypt hash. Written on create (`app/api/admin/collections/route.ts:27`) and update (`app/api/admin/collections/[id]/route.ts:16`). Queried and rendered in the admin dashboard (`app/admin/dashboard/page.tsx:9,36-37`) and manage page (`app/admin/collections/[id]/ManageCollectionClient.tsx:195-197`). A DB leak exposes all collection passwords in plaintext.

- **Photos are publicly accessible without auth** — `originalUrl` and thumbnail `url` are direct public R2 URLs. `gallery_session` only controls which paths you learn on the gallery page; it does not gate access to the actual bytes. Anyone who knows (or guesses) a storage path can fetch a photo.

### High

- **Thumbnails never deleted** — DELETE photo (`/api/admin/collections/[id]/photos`) removes `storage_path` from R2 and the DB row but never calls `deleteObject(thumbPath(storage_path))`. DELETE collection removes originals but not thumbnails. Orphaned thumbnails accumulate indefinitely in R2.

- **No rate limiting** — `/api/admin/login`, `/api/unlock`, `/api/login`, and `/api/signup` have no rate limiting or account lockout.

- **Admin password uses non-timing-safe comparison** — `app/api/admin/login/route.ts:11` uses `password !== process.env.ADMIN_PASSWORD` (string `===`) instead of `crypto.timingSafeEqual()`, making it vulnerable to timing attacks.

- **Client-side zip loads entire collection into browser memory** — `GalleryClient.tsx:downloadPhotos` fetches all photo blobs in parallel and holds them all in memory before generating the zip. Large collections can crash or hang the browser tab.

- **Server-side zip buffers all photos in memory** — `app/api/collections/[id]/zip/route.ts` awaits `Promise.all(photos.map(...))` before piping to archiver, defeating streaming. Memory spikes with large collections.

### Medium

- **`middleware.ts` ends with `// hi`** (line 19) — leftover joke comment.

- **`GET /api/collections/[id]/photos` is dead code** — generates presigned download URLs on every request but is never called by any UI component.

- **Dead state in `MasonryGrid`** — `lightboxIndex` internal state (line 18) is unused when `onTap` prop is provided, which `GalleryClient` always does.

- **No comment deletion confirmation** — `CommentSection.handleDelete` fires immediately with no dialog.

- **No email verification on signup** — accounts are immediately active.

- **Zip progress bar is misleading** — the bar fills to 100% during the fetch phase; the actual zip generation phase has no progress indicator.

- **`setAll() {}` is a no-op** in `createServerSupabaseClient` (`lib/session.ts`) — Supabase SSR cannot persist auth state, making the SSR client effectively read-only.

- **TOCTOU on signup** — uniqueness of username and email is checked with two separate sequential queries before insert, not enforced atomically.

### Low

- No startup validation of required env vars — missing secrets silently become `"placeholder"` strings.
- No server-side file size or MIME type validation on upload — client sends whatever it wants.
- No pagination on home page or admin dashboard — all collections/photos load at once.
- `SearchBar` has no debounce — filters on every keystroke.
