# Mobile Responsive Pass + Slide-out Nav — Design Spec
**Date:** 2026-08-04

---

## Overview

The site was laid out for desktop and never adapted to phones. Only 3 files
use any responsive breakpoints (`GalleryClient`, `MasonryGrid`, `SearchBar`);
every page shell uses a fixed `p-10 max-w-4xl` desktop frame. The most visible
break: the home wordmark (`LogoTitle`, `text-[150px] whitespace-nowrap`)
overflows a 375px screen and shoves the nav off-frame.

Two coordinated pieces of work:

1. **Responsive pass** on the visitor-facing pages (home, gallery, profile,
   liked-photos), preserving the existing desktop design — just adding mobile
   breakpoints so it fits and reflows.
2. **Mobile slide-out nav**: a hamburger (mobile only) that opens a left drawer
   with Home / Profile / Liked photos / Sign in–out, replacing the inline nav on
   phones. This also fixes the broken mobile header.

Login, signup, and the unlock page are already responsive (centered
`max-w-xs`/`max-w-md` forms) and are **out of scope**. Admin pages are out of
scope (desktop-only, personal use).

---

## Non-Goals / Cost

- **No backend cost.** Pure client/layout changes. `MobileNav` reads the session
  via `getUserSession()` (cookie + JWT verify, no DB) — the same call these pages
  already make. No new routes or queries.
- Not a mobile redesign — the desktop look is preserved; we only add breakpoints.
- Desktop nav (inline `UserNav` / `SignOutButton` / `HomeLink`) is unchanged.

---

## Part 1 — Slide-out Mobile Nav

### `components/MobileNav.tsx` (server)
Self-contained: calls `getUserSession()` and renders
`<MobileNavClient username={session?.username ?? null} />`. Takes no props so it
can be dropped into any page.

### `components/MobileNavClient.tsx` (client)
A hamburger button + left drawer, wrapped so the whole thing is `md:hidden`
(desktop never sees it).

- **Hamburger**: a 3-line icon button, `aria-label="Menu"`, `aria-expanded`.
  Rendered in the normal flow (not fixed) so each page positions it in its header.
- **Open state** (`useState`): renders a backdrop (`fixed inset-0 bg-black/60
  z-40`) and a drawer (`fixed top-0 left-0 h-full w-64 bg-[#111] border-r
  border-[#222] z-50`) that transitions `translate-x-0` ⇄ `-translate-x-full`
  (300ms). Mounted-but-closed so the slide animates both ways.
- **Contents** (vertical list, generous tap targets ≥44px):
  - **Home** → `/`
  - Logged in: **Profile** → `/profile`, **Liked photos** → `/profile/likes`,
    **Sign out** (button → `POST /api/logout` → `window.location.href = '/'`,
    reusing `SignOutButton`'s logic).
  - Logged out: **Sign in** → `/login`, **Create account** → `/signup`.
- **Dismissal**: backdrop tap, an in-drawer ✕, tapping any link, and `Escape`.
  Uses `focus-trap-react` (already a dependency) while open, and locks body
  scroll (`document.body.style.overflow`) restored on close/unmount.
- Navigations use `next/link`; clicking a link closes the drawer.

### Page integration (mobile shows hamburger, desktop unchanged)
`MobileNav` is `md:hidden`; the existing top-left `HomeLink` / top-right nav get
`hidden md:block` so exactly one appears per breakpoint.

- **Home** (`app/page.tsx`): add a mobile hamburger row above the wordmark; wrap
  the existing `<UserNav />` in `hidden md:block`. Desktop header (`flex
  items-baseline justify-between`) is unchanged.
- **Gallery** (`app/c/[id]/gallery/page.tsx`): in the header's left cluster, add
  `<MobileNav />` (`md:hidden`) and wrap `<HomeLink />` in `hidden md:block`;
  wrap the right-side `<UserNav />` in `hidden md:block`. The collection
  title/count stays visible next to the hamburger.
- **Profile** (`app/profile/page.tsx`): same swap — hamburger replaces `HomeLink`
  on mobile; wrap `<SignOutButton />` in `hidden md:block` (sign-out lives in the
  drawer on mobile).
- **Liked photos** (`app/profile/likes/page.tsx` / `LikedPhotosClient`): same
  header swap as profile.

---

## Part 2 — Responsive Pass

### `components/LogoTitle.tsx` — the marquee fix
Replace the fixed `text-[150px]` with a fluid size that always fits:
`style={{ fontSize: 'clamp(3rem, 16vw, 150px)' }}` (keep `leading-none uppercase
tracking-[0.02em] whitespace-nowrap`). At ≥ ~940px this clamps to the current
150px, so **desktop is pixel-identical**; on a 375px phone it renders ~60px and
fits. The hover hit-testing (`inkBounds` measured at 150px) only matters on
desktop where the size is still 150px, so it's unaffected; touch has no hover.
Exact `vw` factor tuned against the live preview so the wordmark fills the width
without clipping.

### Page shells — reduce the desktop frame on mobile
- `app/page.tsx`: `p-10` → `px-5 py-8 sm:p-10`.
- `app/profile/page.tsx`: `p-10 max-w-4xl mx-auto` → `px-5 py-8 sm:p-10 max-w-4xl
  mx-auto`; the `mb-10` header gap → `mb-8 sm:mb-10`.
- `app/profile/likes/page.tsx`: same shell treatment (verify its wrapper).
- `app/c/[id]/gallery/page.tsx`: `p-6` → `p-4 sm:p-6`.

### Reflow checks (adjust only if needed, verified in preview)
- Gallery action row (`GalleryClient`) — kudos/comments/size-slider/select/
  download must not overflow at 320–375px; it already uses some `sm:` sizing.
- `SearchBar`, `CollectionCard`, `LikedPhotosClient` grids — confirm padding/gaps
  read well at mobile widths.

---

## Verification

Local preview has real data, so:
- **Home**: wordmark fits with no horizontal scroll; hamburger opens/closes the
  drawer; drawer shows the right items for logged-out vs logged-in; backdrop/
  ✕/link/Escape all dismiss; desktop (≥768px) is unchanged (inline nav, 150px
  wordmark). Screenshots at 375px and 1280px.
- **Unlock/login/signup**: unchanged (spot-check they still look right).
- **Gallery/profile/liked**: verified structurally + on the deploy — these need a
  `gallery_session`/`user_session` that isn't available in local preview. Their
  changes are the same header-swap + shell-padding pattern proven on home.
- `npm test`, `npx tsc --noEmit`, `npm run build` all green.

---

## Files Changed

| File | Change |
|---|---|
| `components/MobileNav.tsx` | **new** — server wrapper reading the session |
| `components/MobileNavClient.tsx` | **new** — hamburger + left drawer |
| `components/LogoTitle.tsx` | fluid `clamp()` font-size (desktop unchanged) |
| `app/page.tsx` | mobile hamburger row; `hidden md:block` on `UserNav`; responsive padding |
| `app/c/[id]/gallery/page.tsx` | hamburger in header; `hidden md:block` on `HomeLink`/`UserNav`; responsive padding |
| `app/profile/page.tsx` | hamburger swap; `hidden md:block` on `SignOutButton`; responsive padding |
| `app/profile/likes/page.tsx` / `LikedPhotosClient` | same header swap + padding |

No API, DB, or `MasonryGrid`/`Lightbox` changes.

---

## What's Not In Scope

- Login / signup / unlock (already responsive).
- Admin dashboard and manage-collection pages (desktop, personal).
- A desktop hamburger (mobile only, per decision).
- A separate settings page ("settings" = the sign-in/out actions in the drawer).
