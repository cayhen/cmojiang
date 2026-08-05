# Like from the Lightbox — Design Spec
**Date:** 2026-08-04

---

## Overview

There is currently no way to like a photo while it is open in the lightbox — liking only works from the grid (`MasonryGrid`: double-tap heart-burst + a corner heart button). This adds liking to the lightbox via **double-tap/double-click** on the photo, plus a **heart button** in the action row.

The lightbox already binds double-tap/double-click to **zoom** (`Lightbox.tsx` `onPointerUp`, `DOUBLE_TAP_SCALE = 2.5`, zoom-to-tap-point). This spec resolves that collision: **when liking is enabled, double-tap likes; otherwise double-tap keeps zooming.** So logged-out viewers and the `/profile/likes` internal lightbox lose nothing.

This is gallery-only and requires no new API — `POST /api/photos/[id]/like` already exists and `GalleryClient` already owns `likedIds` state and an optimistic `handleToggleLike`.

---

## Non-Goals / Cost

- **No new backend cost.** No new routes or queries; the existing like endpoint is reused. Nothing to flag under the cost policy.
- The `/profile/likes` internal lightbox (opened by `MasonryGrid` when no `onTap` is passed) is **out of scope**: it passes no like handler, so it keeps today's double-tap-zoom behavior. Wiring unlike-from-lightbox there could desync that page's own unlike/select state.
- Pinch-to-zoom on mobile is unchanged. Only *double-tap*-zoom is superseded, and only in like-enabled contexts.

---

## New Lightbox Props

```ts
interface Props {
  // ...existing: photos, initialIndex, onClose, onIndexChange, showShare
  likedIds?: Set<string>;                 // liked state for all photos, so it stays correct as you navigate
  onToggleLike?: (photoId: string) => void; // presence enables liking; absence = zoom-only (today's behavior)
}
```

Derived inside the component:
- `const canLike = !!onToggleLike;`
- `const liked = likedIds?.has(photo.id) ?? false;`

Because `likedIds` is a `GalleryClient` state value, toggling updates it and re-renders the lightbox, so the heart button reflects the new state immediately (optimistic; reverts on API failure via the existing handler).

---

## Behavior

### Double-tap / double-click on the photo
In `onPointerUp`, the existing "not moved + within `DOUBLE_TAP_MS`" branch changes to:

```
if (double-tap detected) {
  reset lastTapTime
  if (canLike) {
    triggerHeartBurst(liked ? 'unlike' : 'like')  // read `liked` BEFORE toggling
    onToggleLike(photo.id)
  } else {
    // unchanged: DOUBLE_TAP_SCALE zoom-to-tap-point / reset-if-zoomed
  }
}
```

- The burst kind is read *before* the optimistic toggle flips state — identical to `MasonryGrid.handleClick`.
- When `canLike`, double-tap always likes (even while pinch-zoomed); the user pinches out to un-zoom. When `!canLike`, the current zoom toggle (and reset-if-zoomed) is preserved verbatim, so `DOUBLE_TAP_SCALE` stays.
- Single-tap behavior is unchanged (does not close or navigate; only swipes/arrows/buttons do).

### Heart-burst overlay
Reuse the global `animate-heart-burst` keyframe (`app/globals.css:60`) and the grid's heart SVG. New local state:
```ts
const [heart, setHeart] = useState<'like' | 'unlike' | null>(null);
```
`triggerHeartBurst(kind)` sets it and clears it after ~700ms via a ref'd timeout that is cleared on unmount (avoids setstate-after-unmount). Rendered as an absolutely-centered, `pointer-events-none`, `aria-hidden` overlay on the image box — pink `#ff4d6d` for like, gray `#8f8f8f` with a crossed-out line for unlike. Sized larger than the grid's 56px to suit the lightbox (≈72–88px).

### Heart button (action row)
Shown only when `canLike`. Placed in the right-hand action group, before **Share**/**Download**:
- Outline white heart when not liked; filled `#ff4d6d` when liked.
- `onClick` → `onToggleLike(photo.id)` (no burst — matches the grid's corner button, where only the double-tap gesture bursts).
- `aria-label` = `liked ? 'Unlike photo' : 'Like photo'`. Styled to sit with the existing `text-[#777] hover:text-[#bbb]` action links.

---

## GalleryClient Wiring

The single lightbox render gains two props:

```tsx
<Lightbox
  photos={photos}
  initialIndex={lightboxIndex}
  onClose={...}
  onIndexChange={...}
  showShare
  likedIds={likedIds}
  onToggleLike={loggedIn ? handleToggleLike : undefined}
/>
```

`handleToggleLike` already exists (optimistic set update + revert on non-ok response). No new state, no new handler.

---

## Error Handling

- Not logged in (`onToggleLike` undefined) → no heart button, double-tap keeps zoom. No like calls.
- Like API failure → the existing `handleToggleLike` reverts `likedIds`; the heart button and any subsequent state reflect the revert. (The burst already played; that's acceptable and matches the grid, which also bursts optimistically.)
- Rapid double-taps → each toggles once; `lastTapTime` reset prevents a single triple-tap from double-firing, same as today.

---

## Testing

`Lightbox` is a gesture-heavy client component exercised through pointer events; the repo has **no component/DOM test setup** (`jest-environment-node`, Supabase/bcrypt mocked, lib-level tests only). Adding jsdom + RTL purely for this is out of scope and out of house style. Verification is via the browser preview instead:

- Logged-in gallery lightbox: double-tap likes (pink burst) and un-likes (gray crossed burst); heart button fills/empties and stays in sync when navigating Prev/Next; state persists back on the grid after closing.
- Logged-out: no heart button; double-tap still zooms.
- `/profile/likes` lightbox: double-tap still zooms (unchanged).
- Mobile: pinch-to-zoom still works; double-tap likes.

Pure-logic helpers, if any are extracted, may get a small unit test, but the feature is primarily UI/gesture and is verified in-browser.

---

## Files Changed

| File | Change |
|---|---|
| `components/Lightbox.tsx` | new `likedIds`/`onToggleLike` props; `canLike`/`liked` derivations; double-tap → like-or-zoom branch; heart-burst overlay + timeout cleanup; heart button in the action row |
| `components/GalleryClient.tsx` | pass `likedIds` and `loggedIn ? handleToggleLike : undefined` to `<Lightbox>` |

No API, DB, or `MasonryGrid` changes. `MasonryGrid`'s internal `<Lightbox>` render is left as-is (no like props → zoom preserved).

---

## What's Not In Scope

- Liking from the `/profile/likes` internal lightbox.
- Any change to pinch-to-zoom or to the grid's existing like affordances.
- A component-test harness (jsdom/RTL) — verified in-browser per house style.
