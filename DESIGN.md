---
name: cmojiang
description: Private event photo galleries, delivered with quiet precision.
colors:
  ink: "#080808"
  ink-raised: "#0f0f0f"
  surface: "#111111"
  surface-field: "#161616"
  line: "#1a1a1a"
  line-active: "#2a2a2a"
  wordmark: "#d8d8d6"
  text-primary: "#bbbbbb"
  text-secondary: "#999999"
  text-tertiary: "#888888"
  icon-muted: "#666666"
  decor-faint: "#444444"
  heart: "#ff4d6d"
  error: "#ef4444"
  white: "#ffffff"
typography:
  display:
    fontFamily: "Rogeta, system-ui, sans-serif"
    fontSize: "clamp(3rem, 16vw, 150px)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.02em"
  headline:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 300
    lineHeight: 1.55
  title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 300
    lineHeight: 1.25
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 300
    lineHeight: 1.43
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 300
    lineHeight: 1.33
    letterSpacing: "0.1em"
  caption:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 300
    lineHeight: 1.33
  button-strong:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  tile: "2px"
  md: "4px"
  full: "9999px"
spacing:
  tile-gap: "6px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  page-mobile: "20px"
  page: "40px"
components:
  button-secondary:
    backgroundColor: "{colors.surface-field}"
    textColor: "{colors.text-tertiary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-field}"
    textColor: "{colors.text-primary}"
  button-primary:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.ink-raised}"
    typography: "{typography.button-strong}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink-raised}"
  input:
    backgroundColor: "{colors.surface-field}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card-collection:
    backgroundColor: "{colors.surface-field}"
    textColor: "{colors.text-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "16px"
  text-action:
    textColor: "{colors.text-tertiary}"
    typography: "{typography.caption}"
  text-action-hover:
    textColor: "{colors.text-primary}"
  photo-tile:
    backgroundColor: "{colors.surface-field}"
    rounded: "{rounded.tile}"
---

# Design System: cmojiang

## Overview

**Creative North Star: "The Fine Instrument"**

cmojiang should feel like a well-made instrument: sleek and high quality, with few controls, each built very well. The photographs supply all the color and all the life. The interface is a near-black field of greys that holds them and then gets out of the way. Its quality shows in precision rather than ornament: aligned edges, controls whose purpose is obvious, states that answer immediately, and nothing on screen that isn't needed.

Density is low and controls are deliberate. A gallery page shows the collection name, a short row of text actions, and photos. The home page shows the wordmark, a search field, and a list of collections. New capability earns its place by making the core job (find your photos, keep them) faster or clearer. It never gets a new surface just because it exists. When adding a feature would complicate navigation, the answer is to fold it into an existing control or leave it out.

Components should be **precise and tactile**: still dark and restrained, but with crisp edges, clear affordances, and visible feedback on hover, focus, and press. The incumbent code leans recessed and barely there. The direction from here is clearer interactive states, not louder surfaces.

**Key Characteristics:**
- Near-black neutral field. The photos are the only color, apart from the like heart.
- One light-weight sans (DM Sans 300) for all interface text. The Rogeta wordmark is the only display type.
- Flat, tonal layering. No card shadows and no gradients.
- Small radii (2–4px). Shapes read as cut and precise, not soft.
- Few controls, mostly text actions. Each has an obvious, readable state.

## Colors

A strict grey ramp on near-black, with one reserved accent.

### Primary
- **Heart Pink** (`heart`): the fill for liked photos and given kudos, and the burst of a double-tap like. It is the only saturated UI color in the system.

### Neutral
- **Ink** (`ink`): the page background on every route.
- **Raised Ink** (`ink-raised`): full-screen overlays such as the unlock transition, and the text color on the solid primary button.
- **Surface** (`surface`): the mobile nav drawer and the selection-mode bottom bar (the bar at 95% opacity with backdrop blur).
- **Field** (`surface-field`): cards, inputs, secondary buttons, and photo tiles before load. It's one step above the page, so layering reads as tone, not shadow.
- **Hairline** (`line`): borders on fields and cards, divider rules, and drawer list separators. The code also uses `#1e1e1e` and `#222` interchangeably for this role; consolidate them to `line`.
- **Active Hairline** (`line-active`): border on hover and focus for fields, cards, and buttons.
- **Wordmark Bone** (`wordmark`): the cmojiang wordmark only. It's a slightly warm off-white, the brightest neutral in the system.
- **Primary Text** (`text-primary`): collection names, body copy, input values, hover state of text actions, and the solid primary button fill.
- **Secondary Text** (`text-secondary`): supporting links and meta that must stay readable.
- **Tertiary Text** (`text-tertiary`): the dimmest grey allowed for readable text (resting text actions, counts, dates, placeholders, timestamps). It passes 4.5:1 on Ink, Field, and Surface.
- **Muted Icon** (`icon-muted`): resting icon strokes and other non-text control graphics (3:1 minimum). Not for text.
- **Faint** (`decor-faint`): decorative strokes and the hidden admin footer link only.
- **Error** (`error`): inline error text, solid at full opacity. The incumbent `red-500/70` falls below the contrast floor.

Per-photo **dominant color** (sampled at upload) fills each tile before its image loads. It's content-derived, not a token.

### Named Rules
**The Hearts Only Rule.** Heart Pink appears only on like and kudos state. Never use it on buttons, links, text, focus rings, or decoration. A pink pixel always means "someone loved this".

**The Readable Floor Rule.** Any text a visitor needs to read is Tertiary Text or brighter. Muted Icon is for icons and control strokes; Faint is for decoration. Many incumbent labels use `#444`–`#666` for text and must be raised to the floor when touched.

**The Photos Carry Color Rule.** The interface stays neutral so it never competes with the images. No tinted surfaces, gradients, or brand colors beyond the wordmark and the heart.

## Typography

**Display Font:** Rogeta (self-hosted, with system-ui fallback)
**Body Font:** DM Sans (via `next/font`, weights 300 and 400, with system-ui fallback)

**Character:** A heavy, condensed uppercase wordmark over a whisper-light geometric sans. The contrast between the one loud word and the quiet interface is the whole typographic identity.

### Hierarchy
- **Display** (Rogeta Black, `clamp(3rem, 16vw, 150px)`, line-height 1, uppercase, +0.02em): the cmojiang wordmark on the home page. Nowhere else.
- **Headline** (DM Sans 300, 1.125rem): the collection name on the unlock page.
- **Title** (DM Sans 300, 0.875rem, tight leading): collection names on cards and in the gallery header.
- **Body** (DM Sans 300, 0.875rem): comments, form fields, empty and error states, buttons.
- **Caption** (DM Sans 300, 0.75rem): photo counts, dates, comment usernames and times, and text actions in the gallery row.
- **Label** (DM Sans 300, 0.75rem, uppercase, +0.1em): small section labels such as "Sign in" and the drawer's username header.
- **Button Strong** (DM Sans 500, 0.75rem): the solid primary button only.

The header nav uses a one-off 13px with +0.04em tracking. Fold it into Caption or Body rather than adding a step.

### Named Rules
**The One Loud Word Rule.** Rogeta is reserved for the wordmark. Headings, numbers, and labels are DM Sans. Hierarchy comes from size, brightness, and case, not from a second display face.

**The Light Weight Rule.** Interface text is weight 300. Weight 500 marks the one solid primary action on a screen. Nothing is bold.

The Nevanta font files remain in `public/fonts/` but are not loaded. Don't introduce them without a decision.

## Layout

- **Home and lists** sit in a centered column, max 896px (`max-w-4xl`), with 20px padding on mobile and 40px from 640px up. The collection grid is one column on mobile and two from 640px, with a 12px gap.
- **Auth and unlock** pages center a single 320px (`max-w-xs`) column vertically in the viewport.
- **Galleries** run full-bleed with 16px/24px padding (mobile/desktop). The masonry grid is flex columns with a 6px gap. Column count comes from breakpoint × the visitor's size slider (default 2/3/4 columns on mobile/tablet/desktop).
- **Lightbox** is a fixed full-screen layer, with the image capped at 80vh and the content column at max 1024px (`max-w-5xl`). Controls sit in a single row beneath the image.
- **Breakpoints:** Tailwind defaults (640, 768, 1024px). Navigation switches at 768px: below it a hamburger opens a left slide-out drawer; above it the user nav sits inline in the header.
- **Rhythm:** spacing comes from Tailwind's 4px scale, mostly 6, 8, 12, 16, 24 and 40px. Vertical stacks in forms use 12–16px.

## Elevation & Depth

The system is flat. Depth comes from tonal steps (Ink → Raised Ink → Surface → Field) and from scrims, never from card shadows. Overlays dim what's behind them: a 60% black scrim behind the nav drawer, and 95% black behind the lightbox. Selection mode's bottom bar is Surface at 95% with a light backdrop blur.

### Shadow Vocabulary
- **Icon lift** (`drop-shadow(0 1px 2px rgba(0,0,0,0.8))` and `drop-shadow(0 1px 3px rgba(0,0,0,0.6))`): only on white or pink icons drawn over photographs, so they stay legible on bright images.

### Named Rules
**The No Floating Cards Rule.** Containers never cast shadows. If something needs to sit above the page, give it a lighter tonal step or a scrim behind it.

## Shapes

Corners are small and consistent: 4px on fields, buttons, cards, and the progress track, and 2px on photo tiles so images read almost square-cut. Fully round shapes are only for circular controls (selection checkmarks, progress track ends). Borders are 1px hairlines in `line` and step to `line-active` on interaction. Photos are never cropped by the grid. Tiles keep each image's native aspect ratio.

## Components

### Buttons
Precise, tactile, and rare.
- **Shape:** gently squared corners (4px).
- **Secondary (default):** Field background, 1px Hairline border, Tertiary Text, 10px vertical padding. Full-width in auth and unlock forms. Used for Unlock, Sign in, Continue with Google, and Post.
- **Secondary hover / focus:** border steps to Active Hairline and text brightens to Primary Text. Transitions are color-only, around 150ms.
- **Primary (solid):** Primary Text fill with Raised Ink text, Button Strong type, 8px × 16px padding. It brightens to white on hover. Reserved for the single most important action in context (the download prompt, "Download N" in selection mode).
- **Disabled:** 50% opacity, keeping the same shape.

### Text Actions
Most controls are plain text: Download all, Select, Comments, Share, Prev/Next, and Close in the lightbox. They rest at Tertiary Text, brighten to Primary Text on hover, and drop to 30–50% opacity when disabled. They need a visible focus ring (see Inputs) because they have no box.

### Cards / Containers
- **Collection card:** Field background, Hairline border, 4px corners, 16px padding. Name in Title on Primary Text; count and date in Caption beneath. Hover steps the border up. The incumbent also slides the content 6px right and grows a 2px accent bar from the bottom. That's an existing flourish, not an invariant.
- **Shadow strategy:** none (see Elevation & Depth).

### Inputs / Fields
- **Style:** Field background, 1px Hairline border, 4px corners, 10px × 12px padding, Body type in Primary Text. Placeholders use Tertiary Text.
- **Focus:** the border brightens from Hairline to Tertiary Text (`#888888`), with no outline. Every other control gets the global focus ring: a 1px Primary Text outline offset 2px, drawn only for keyboard focus (`:focus-visible`).
- **Error:** an inline message in Error at Caption size directly under the field or form.

### Navigation
- **Desktop:** the header has the wordmark (home) or a home-arrow link (other pages) on the left and the user nav on the right in small, tracked text.
- **Mobile:** a hamburger opens a 256px (max 80vw) drawer that slides in from the left over a 60% scrim. The drawer is Surface with a right Hairline. The username header is in Label, and links are Body type with Hairline separators and 12px vertical padding.

### Photo Tile (signature)
Images sit edge to edge in the masonry column with 2px corners and a 6px gap. Each tile shows its dominant color until it loads, then fades the image in over 300ms. On hover (desktop) a heart appears top-left and a download button bottom-right (black at 50% → 70%, 4px corners). Double-tap or the heart toggles a like with a Heart Pink burst (grey and crossed out for unlike). In selection mode a 20px circular check appears top-right. Liked hearts stay visible at rest.

### Lightbox
A 95% black full-screen layer with the image centered (max 80vh) and one control row beneath it: Prev/Next on the left; heart, Share, Download and Save to Photos on the right. Swipe, pinch-zoom, and double-tap zoom work on touch.

## Do's and Don'ts

### Do:
- **Do** keep every readable piece of text at Tertiary Text (`#888888`) or brighter. Raise incumbent `#444`–`#666` text to that floor whenever you touch it.
- **Do** reserve Heart Pink (`#ff4d6d`) for like and kudos state only.
- **Do** express layering with tonal steps (Ink → Surface → Field) and hairline borders, never shadows.
- **Do** give every interactive element a visible hover, focus, and disabled state. Focus must be visible on the dark field, not just a hairline shift.
- **Do** keep interface type in DM Sans 300, with 500 only for the single solid primary action.
- **Do** fold new capability into existing controls before adding a new screen, row, or menu.

### Don't:
- **Don't** use Rogeta or any second display face outside the wordmark.
- **Don't** add tinted surfaces, gradients, or accent colors. The photos carry the color.
- **Don't** add decorative motion or flourishes. The incumbent film grain, wordmark icon burst, "UNLOCKED" text scramble, and card hover slide are not commitments and may be removed in favor of plainer, faster interactions.
- **Don't** put Muted Icon (`#666666`) or Faint (`#444444`) on text a visitor needs to read.
- **Don't** crop photos into uniform tiles. Preserve each image's aspect ratio.
- **Don't** crowd a screen with controls. If navigation gets harder to understand, the feature isn't ready.
