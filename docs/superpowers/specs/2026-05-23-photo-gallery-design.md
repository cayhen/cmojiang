# Photo Gallery — Design Spec
**Date:** 2026-05-23
**Phase:** 1 (core gallery — viewing, downloading, admin management)
**Phase 2** (comments, kudos, remembered sessions via Google sign-in) is scoped separately.

---

## Overview

A private photo gallery website where Caden organizes edited photos into event-based collections. Visitors browse the homepage, find their collection, enter a password to unlock it, then browse and download photos. No visitor accounts in Phase 1.

Hosted on Vercel at `cadenjiang-photos.vercel.app`. Standalone Next.js app — no relation to other projects in the workspace.

---

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Font | DM Sans (Google Fonts via `next/font/google`) |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage (private bucket) |
| Admin Auth | Supabase Auth — Google OAuth only |
| Visitor Auth | Custom JWT cookies (`jose`) + bcrypt password verification |
| Zip Generation | `archiver` npm package |
| Deployment | Vercel |

---

## Visual Design

- **Background:** `#0f0f0f` (near black)
- **Primary text:** `#888` (mid grey)
- **Borders/dividers:** `#1a1a1a`
- **Font:** DM Sans, weights 300 and 400
- **Homepage layout:** 2-column card grid on desktop, 1-column on mobile — each card shows collection name + photo count
- **Gallery layout:** CSS masonry columns (native CSS `columns` property, no JS library)
- **Lightbox:** Built in-house with React state + `focus-trap-react`

Photography-first. The UI steps back entirely — no thumbnails on the homepage, no decoration, no gratuitous animation.

---

## Database Schema

```sql
-- collections
id            uuid primary key default gen_random_uuid()
name          text not null
password_hash text not null       -- bcrypt hash of collection password
created_at    timestamptz default now()

-- photos
id            uuid primary key default gen_random_uuid()
collection_id uuid references collections(id) on delete cascade
storage_path  text not null       -- path in Supabase Storage: {collection_id}/{photo_id}.ext
filename      text not null
uploaded_at   timestamptz default now()
```

Photo counts are computed via `COUNT(*)` JOIN on the photos table — no redundant column needed.

**Homepage query:**
```sql
SELECT c.id, c.name, COUNT(p.id) AS photo_count
FROM collections c
LEFT JOIN photos p ON p.collection_id = c.id
GROUP BY c.id, c.name
ORDER BY c.created_at DESC
```

**RLS:** Public can `SELECT id, name` from `collections` only. All other operations require the service role key (server-side only). `password_hash` is never returned from any public API route.

**Storage:** Bucket `photos` (private). Paths: `{collection_id}/{photo_id}.{ext}`.

---

## Auth & Security

### Visitor session (collection unlock)
1. Visitor POSTs `{ collectionId, password }` to `/api/unlock`
2. Server fetches `password_hash` using service role key, runs `bcryptjs.compare()`
3. On match: `jose` signs a JWT `{ collectionId }` with 7-day expiry
4. JWT set as `HttpOnly; Secure; SameSite=Lax` cookie named `gallery_session`
5. Gallery Server Component reads and verifies the cookie before rendering; mismatched or missing → redirect to `/c/[id]`
6. All photo API routes verify the cookie and check `collectionId` matches the route param
7. Supabase signed URLs have 1-hour expiry, generated fresh on each page load

### Admin auth (Caden only)
- Supabase Auth Google OAuth at `/admin`
- Only `cadenjiang777@gmail.com` is accepted — middleware rejects any other Google account
- Next.js middleware protects all `/admin/*` routes, redirects unauthenticated requests to `/admin`
- All admin routes use `SUPABASE_SERVICE_ROLE_KEY`

### Never exposed to client
- `password_hash` — never in any API response
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only
- Raw Supabase storage paths — only signed URLs, short-lived
- Signed URLs are generated server-side only; no Supabase service role calls in client components

---

## Pages & Routes

### Public
| Route | Description |
|---|---|
| `/` | Homepage — 2-col card grid with search bar |
| `/c/[id]` | Unlock page — collection name + password input |
| `/c/[id]/gallery` | Gallery — masonry grid, lightbox, download all |

### Admin
| Route | Description |
|---|---|
| `/admin` | Google sign-in |
| `/admin/dashboard` | Collection list with edit/delete |
| `/admin/collections/new` | Create collection (name + password) |
| `/admin/collections/[id]` | Manage collection — drag-and-drop photo upload, change password, delete photos |

---

## File Structure

```
photo-gallery/
  app/
    page.tsx                          # Homepage
    c/[id]/
      page.tsx                        # Unlock page
      gallery/page.tsx                # Gallery view
    admin/
      page.tsx                        # Google sign-in
      dashboard/page.tsx
      collections/
        new/page.tsx
        [id]/page.tsx
  api/
    collections/route.ts
    collections/[id]/route.ts
    unlock/route.ts
    collections/[id]/photos/route.ts
    collections/[id]/zip/route.ts
    admin/collections/route.ts
    admin/collections/[id]/route.ts
    admin/collections/[id]/photos/route.ts
  components/
    MasonryGrid.tsx                   # CSS columns masonry wrapper
    Lightbox.tsx                      # Focus-trapped full-screen viewer
    SearchBar.tsx                     # Client-side collection filter
    CollectionCard.tsx                # Homepage card
  lib/
    supabase.ts                       # Client + server Supabase instances
    auth.ts                           # JWT sign/verify helpers
    session.ts                        # Cookie read/write helpers
  middleware.ts                       # Protects /admin/* routes
```

**Component notes:**
- `MasonryGrid` receives signed URLs as props from Server Component parent — no Supabase calls client-side
- `Lightbox` uses `focus-trap-react`; restores focus to triggering element on close; keyboard nav: arrow keys + Escape. Download button is an `<a download>` link using the signed URL already loaded with the gallery — no separate API roundtrip needed
- `SearchBar` is a client component on an otherwise server-rendered homepage
- Server Components are the default; client components are limited to `SearchBar`, `Lightbox`, and interactive admin upload UI

---

## API Routes

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/api/collections` | GET | None | Returns `{id, name, photo_count}[]` |
| `/api/collections/[id]` | GET | None | Returns `{id, name}` only |
| `/api/unlock` | POST | None | bcrypt compare → JWT cookie. 401 on wrong password, 404 if not found |
| `/api/collections/[id]/photos` | GET | Session JWT | Returns `{id, filename, url}[]` with fresh 1hr signed URLs |
| `/api/collections/[id]/zip` | GET | Session JWT | Streams zip via `archiver`, named `{slug}.zip` |
| `/api/admin/collections` | GET/POST | Supabase session | List or create. POST hashes password before storing |
| `/api/admin/collections/[id]` | PATCH/DELETE | Supabase session | PATCH: name/password. DELETE: cascades DB + removes all files from storage |
| `/api/admin/collections/[id]/photos` | POST/DELETE | Supabase session | POST: upload to storage + insert row. DELETE: remove from storage + DB |

---

## Error Handling

- Wrong collection password → 401, generic "Incorrect password" (no timing info leaked)
- Expired/invalid JWT cookie → redirect to `/c/[id]`
- Admin route without valid session → redirect to `/admin`
- Zip failure → 500, partial zip discarded, connection closed cleanly
- Admin upload failures → per-file error shown inline; successful uploads in the same batch are kept

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only
JWT_SECRET=                        # for signing gallery session tokens
```

---

## Dependencies

```
@supabase/supabase-js
@supabase/auth-helpers-nextjs
bcryptjs + @types/bcryptjs
jose
archiver + @types/archiver
focus-trap-react
```

---

## Out of Scope (Phase 1)

- Google sign-in for visitors
- Comments, kudos, or saved collection access (Phase 2)
- Raw file support
- Cover photos or thumbnails on homepage
- Per-person access control
- Mobile upload
- Integration with other projects in workspace
