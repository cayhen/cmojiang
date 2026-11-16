---
name: cmojiang
description: Private event galleries in neutral system chrome, so the photos are the only image.
colors:
  label: "#1d1d1f"
  label-dark: "#f5f5f7"
  label-2: "#6e6e73"
  label-2-dark: "#98989d"
  on-label: "#ffffff"
  on-label-dark: "#000000"
  tint: "#0066cc"
  tint-dark: "#2997ff"
  tint-ring: "rgba(0, 102, 204, 0.32)"
  tint-ring-dark: "rgba(41, 151, 255, 0.4)"
  heart: "#ff2d55"
  heart-dark: "#ff375f"
  destructive: "#d70015"
  destructive-dark: "#ff453a"
  bg: "#ffffff"
  bg-dark: "#000000"
  bg-grouped: "#f2f2f7"
  bg-grouped-dark: "#000000"
  surface: "#ffffff"
  surface-dark: "#1c1c1e"
  fill: "rgba(118, 118, 128, 0.12)"
  fill-dark: "rgba(118, 118, 128, 0.24)"
  fill-2: "rgba(118, 118, 128, 0.2)"
  fill-2-dark: "rgba(118, 118, 128, 0.36)"
  separator: "rgba(60, 60, 67, 0.18)"
  separator-dark: "rgba(84, 84, 88, 0.65)"
  material: "rgba(255, 255, 255, 0.74)"
  material-dark: "rgba(22, 22, 23, 0.74)"
  material-thick: "rgba(250, 250, 252, 0.88)"
  material-thick-dark: "rgba(36, 36, 38, 0.9)"
  viewer-backdrop: "#000000"
  viewer-label: "#ffffff"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "41px"
    letterSpacing: "-0.022em"
  large-title-wide:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: "46px"
    letterSpacing: "-0.022em"
  title1:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "34px"
    letterSpacing: "-0.02em"
  title3:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "25px"
    letterSpacing: "-0.016em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
    letterSpacing: "-0.022em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "-0.022em"
  subhead:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.012em"
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "-0.006em"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0"
rounded:
  tile-phone: "2px"
  tile: "6px"
  control: "12px"
  card: "14px"
  sheet: "18px"
  bar: "20px"
  full: "9999px"
spacing:
  gutter-phone: "2px"
  gutter: "6px"
  page-x: "16px"
  page-x-sm: "24px"
  page-x-lg: "32px"
  row-x: "16px"
  bar-height: "52px"
  row-min: "48px"
  control-height: "44px"
  control-height-sm: "32px"
components:
  button-filled:
    backgroundColor: "{colors.label}"
    textColor: "{colors.on-label}"
    typography: "{typography.headline}"
    rounded: "{rounded.full}"
    padding: "0 20px"
    height: "{spacing.control-height}"
  button-filled-sm:
    backgroundColor: "{colors.label}"
    textColor: "{colors.on-label}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "{spacing.control-height-sm}"
  button-tinted:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.label}"
    rounded: "{rounded.full}"
    padding: "0 14px"
    height: "{spacing.control-height-sm}"
  button-tinted-hover:
    backgroundColor: "{colors.fill-2}"
  button-plain:
    textColor: "{colors.tint}"
    typography: "{typography.body}"
  button-icon:
    textColor: "{colors.label}"
    rounded: "{rounded.full}"
    size: "36px"
  button-icon-hover:
    backgroundColor: "{colors.fill}"
  field:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.label}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "{spacing.control-height}"
  list:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  list-row:
    textColor: "{colors.label}"
    typography: "{typography.body}"
    padding: "10px 16px"
    height: "{spacing.row-min}"
  list-row-hover:
    backgroundColor: "{colors.fill}"
  list-header:
    textColor: "{colors.label-2}"
    typography: "{typography.footnote}"
    padding: "0 16px 6px"
  nav-bar-collapsed:
    backgroundColor: "{colors.material}"
    textColor: "{colors.label}"
    typography: "{typography.headline}"
    height: "{spacing.bar-height}"
  floating-bar:
    backgroundColor: "{colors.material-thick}"
    rounded: "{rounded.bar}"
    padding: "8px 16px"
    height: "56px"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
  photo-tile:
    backgroundColor: "{colors.fill}"
    rounded: "{rounded.tile}"
  viewer:
    backgroundColor: "{colors.viewer-backdrop}"
    textColor: "{colors.viewer-label}"
---

# Design System: cmojiang

## Overview

**Creative North Star: "Quiet System Chrome"**

The interface is the platform's own chrome, rendered with care: neutral, exact, and out of the way, so the only images on any screen are the photographs. It takes its vocabulary straight from Apple's system UI (semantic neutrals, the system font, frosted bars, grouped inset lists, pill buttons, hairline separators) and holds it to the finish of Apple Photos and Linear. It is deliberately unthemed. Two themed directions were rejected as too themed, and nothing here carries a metaphor, a texture, or a display gimmick.

Polish lives in behavior rather than ornament. Things are smooth and animated but never showy: controls press by scaling down slightly, layers arrive on a long soft settle, a photo grows out of its grid tile into a black viewer and springs back on close, and grid density changes glide tiles to their new places. Every motion has a purpose and a reduced-motion end state.

Appearance follows the visitor's system light or dark setting through one set of semantic tokens with a light and a dark value each. The photo viewer is the single exception: it is always black, in both appearances.

**Key Characteristics:**
- One neutral palette in two appearances, plus a single blue tint and a pink reserved for likes.
- The system font stack, with hierarchy carried by size and weight on an eight-step ramp.
- Depth by tonal steps and translucent material; one soft shadow for floating layers only.
- Continuous rounded corners nested by scale, pill shapes for every action.
- Spring and long-settle motion, press feedback by scale, never by color jumps.
- Photos edge to edge on phones with 2px gutters; chrome steps back.

## Colors

A neutral system with one blue for interaction and one pink for affection; every value is a semantic role with a light and a dark pair.

The frontmatter records each role twice: the bare key is the light appearance, the `-dark` key is the value it switches to under `prefers-color-scheme: dark`. Both come straight from the `:root` custom properties in `app/globals.css`. Build with the role, never with one appearance's literal.

### Primary
- **System Blue** (`tint` / `tint-dark`): tappable text and links (back links, Select, Sign In, Copy Invite Link, footer links), the caret, the selection highlight's base, the selected-photo badge, and the comment send button. Its translucent companion **Tint Ring** (`tint-ring` / `tint-ring-dark`) is the soft focus glow on fields and the text-selection color.

### Secondary
- **Like Pink** (`heart` / `heart-dark`): photo likes, the double-tap heart burst, kudos when given, and the Liked Photos entry points. Nothing else.

### Tertiary
- **Destructive Red** (`destructive` / `destructive-dark`): Sign Out, inline error messages, and comment delete on hover.

### Neutral
- **Label** (`label` / `label-dark`): primary text and icons; also the fill of the filled pill button, which inverts with appearance.
- **Secondary Label** (`label-2` / `label-2-dark`): subtitles, counts, dates, list headers and footers, placeholder text, chevrons.
- **On Label** (`on-label` / `on-label-dark`): text on a Label-filled surface (filled buttons, the unlocked badge).
- **Page** (`bg` / `bg-dark`): the plain page behind photo grids and liked photos.
- **Grouped Page** (`bg-grouped` / `bg-grouped-dark`): the page behind grouped inset lists (home, unlock, auth, profile, admin). In dark it is pure black, so lists separate by their surface tone.
- **Surface** (`surface` / `surface-dark`): grouped list cards, sheets, the comment composer.
- **Fill** (`fill` / `fill-dark`) and **Fill 2** (`fill-2` / `fill-2-dark`): translucent gray for tinted buttons, fields, hover and pressed states, the photo placeholder before load, and empty-state icon discs. Fill 2 is the stronger step (hover on tinted buttons, pressed rows, the off switch track, the sheet grabber).
- **Separator** (`separator` / `separator-dark`): half-pixel hairlines between list rows, under the collapsed bar, and above menu groups.
- **Material** (`material` / `material-dark`) and **Thick Material** (`material-thick` / `material-thick-dark`): translucent backgrounds for frosted layers, always paired with a saturate-and-blur backdrop filter (Elevation & Depth).
- **Viewer Black** (`viewer-backdrop`) and **Viewer White** (`viewer-label`): the fixed photo viewer, independent of appearance. Its chrome uses white at reduced opacity (10% button wash, 80% counter text) over black gradients at 50%.

### Named Rules
**The One Tint Rule.** Blue means "you can tap this" or "this is selected". It never decorates, never fills a large area, and never labels static text.

**The Heart Is Only For Likes Rule.** Pink appears only where a person has expressed affection: photo likes, kudos, and the Liked Photos entries. Not for brand, emphasis, or alerts.

**The Black Viewer Rule.** The photo viewer is black with white chrome in both appearances. Do not route it through the semantic tokens.

## Typography

**Display Font:** the system UI stack (`-apple-system`, `SF Pro Text`, `SF Pro Display`, `system-ui`, then Segoe UI, Roboto, Helvetica Neue, Arial)
**Body Font:** the same stack
**Label/Mono Font:** none; counts use tabular numerals from the same family

**Character:** One family, the platform's own, so text reads as native chrome on every device. Hierarchy comes from size and weight alone, with letter-spacing tightening as size grows, exactly as the system ramp does.

### Hierarchy
- **Large Title** (700, 34px / 41px, -0.022em; 40px / 46px from md up): the page title under the transparent bar; collection names, "cmojiang".
- **Title 1** (700, 28px / 34px, -0.02em): titles on single-task pages (unlock, sign in, sign up).
- **Title 3** (600, 20px / 25px, -0.016em): sheet titles.
- **Headline** (600, 17px / 22px, -0.022em): the collapsed bar title, empty-state headings, emphasized row text, button labels.
- **Body** (400, 17px / 22px, -0.022em): list rows, fields, comments, the default for everything.
- **Subhead** (400, 15px / 20px, -0.012em): subtitles (date and count), small button labels, secondary row lines, commenter names (at 600).
- **Footnote** (400, 13px / 18px, -0.006em): list headers and footers, timestamps, errors, the home footer.
- **Caption** (400, 12px / 16px, 0): the smallest annotations.

### Named Rules
**The System Voice Rule.** Use the system stack and the eight named steps only. No webfont, no second family, no ad hoc sizes; the one exception is the large title's md-up step.

**The Sentence-Weight Rule.** Emphasis is weight (600 or 700), never uppercase or letter-spaced labels. No tracked small caps above titles.

## Layout

Two page widths. Reading pages (home, unlock, auth, profile, admin) sit in a centered narrow column (max 672px) with 16px side padding, 24px from sm up. Photo pages use the wide container: full width, 16 / 24 / 32px side padding at base / sm / lg for header content.

The photo grid is a column masonry. On phones it runs edge to edge with 2px gutters and near-square 2px tile corners; from sm up it gains 24px (sm) or 32px (lg) side padding, 6px gutters and 6px tile corners. Column count is breakpoint times a four-step size level: 4/3/2/1 below 640px, 5/4/3/2 to 1024px, 7/5/4/3 above, defaulting to the second step. Photos keep their stored aspect ratio and their column assignment, so appending never reshuffles.

The header is a 52px bar over a large title, then a subtitle and an optional toolbar row 16px below. Grouped lists stack as header (footnote, 16px inset), card, footer, with sections spaced generously. Rows are at least 48px tall with 16px horizontal padding; separators start 16px in from the leading edge and run to the trailing edge.

Every fixed layer respects safe-area insets (top bar, floating bar, sheet bottom, viewer chrome). Breakpoints are Tailwind's defaults (sm 640px, md 768px, lg 1024px); the sheet becomes a centered panel and viewer arrow buttons appear at md.

## Elevation & Depth

Depth is tonal and material first. Pages are flat; grouped lists lift off the grouped page by surface tone alone; hover and press darken with translucent fills. Layers that float over scrolling content become frosted material: translucent background plus `saturate(180%) blur(20px)` for bars, `saturate(180%) blur(28px)` for thick material (floating bar, account menu). Hairlines are half-pixel inset box-shadows in the separator color, never borders.

### Shadow Vocabulary
- **Float** (light `0 10px 34px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)`; dark `0 10px 34px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.08)`): the only elevation shadow, for the floating bar, sheets and the account menu. In dark it adds a faint white edge so the layer reads against black.
- **Focus Glow** (`0 0 0 3px` Tint Ring): fields and the grouped auth list on focus.
- **Icon Lift on Photos** (drop shadows from `0 1px 3px rgba(0,0,0,0.5)` to `0 4px 16px rgba(0,0,0,0.4)`): only for white or pink icons placed directly on photographs, for legibility.

### Named Rules
**The One Shadow Rule.** Only layers that float above content get the Float shadow. Cards, rows and buttons stay flat.

**The Material Earns Its Blur Rule.** Frosted material is for layers above moving content: the collapsed bar, the floating bar, menus. At rest the top bar is transparent and only turns frosted once the large title scrolls away.

## Shapes

Continuous, softly rounded corners nested by scale: photo tiles (6px; 2px on phones), fields (12px; the search field is 10px), list cards and menus (14px), sheets (18px; top corners only on phones), the floating bar (20px). Every action is a pill or a circle: buttons, segmented size controls, avatar, icon buttons, badges. Fields are filled, never outlined. The only visible border in the system is the admin upload drop zone's 2px dashed outline.

**The Nested Radius Rule.** Radius grows with the container: tile < control < card < sheet < bar. A child never has a larger radius than its parent.

**The Pill Action Rule.** Anything you press to act is fully rounded. Rectangles hold content; pills and circles do things.

## Components

### Buttons
Calm and tactile: they acknowledge a press by scaling, never by flashing color.
- **Shape:** fully rounded pill (`rounded.full`); 44px tall with 20px padding at default, 32px tall with 14px padding at small. Label is semibold (600).
- **Filled:** Label background with On Label text, so it inverts with appearance (near-black in light, near-white in dark). Primary actions: Unlock, Sign In, Save, Download N. Hover drops to 90% opacity.
- **Tinted:** Fill background with Label text; hover steps to Fill 2. Secondary actions: kudos, comments, download all, the size control.
- **Plain:** System Blue text with no container; hover 70% opacity, press 50%. Back links, Select, Cancel, Sign In in bars.
- **Icon:** 36px circle, Label icon, Fill on hover, scale 0.94 on press. The sheet close button is a 32px Fill circle with a Secondary Label glyph.
- **Press / Disabled:** press scales to 0.97 (icon buttons 0.94, small circular controls 0.90) over 150ms; disabled is 40% opacity with no pointer events. Focus is a 2px System Blue outline at 2px offset, globally.

### Inputs / Fields
- **Style:** filled with Fill, no border, 12px radius, 44px tall, 16px padding, Body text, Secondary Label placeholder, System Blue caret.
- **Focus:** a 3px Tint Ring glow fades in over 150ms; no outline change.
- **Variants:** search (40px, 10px radius, leading search glyph, circular clear button), comment composer (40px pill), unlock password (centered text).
- **Error:** the form shakes horizontally once (0.42s) and a footnote-size Destructive Red message appears below; fields themselves do not turn red.

### Grouped Inset Lists
The backbone of every non-photo page, in the manner of iOS Settings.
- **Corner Style:** 14px card on Surface, clipped.
- **Rows:** min 48px, 16px horizontal padding, Body text; tappable rows take Fill on hover and Fill 2 on press. Trailing chevrons are Secondary Label at 60%, nudging 2px right on hover.
- **Separators:** half-pixel Separator lines inset 16px from the leading edge.
- **Header / Footer:** footnote, Secondary Label, 16px inset, sitting just outside the card.
- **Auth forms:** fields are borderless rows inside one list card, and the whole card takes the Tint Ring glow when any field is focused.
- **Switch:** iOS proportions (51 x 31px track, 27px white knob with a small shadow), Fill 2 track when off, green when on, sliding in 200ms.

### Navigation
- **Large-title header:** a 52px three-column bar (back link, centered small title, actions) over a Large Title. While the title is visible the bar is transparent; once it scrolls under, the bar turns to Material with a bottom hairline and the small Headline title fades and rises in (300ms). Tapping the small title scrolls to top.
- **Top bar:** single-task pages use the same 52px bar with only a back link and actions.
- **Account menu:** a 32px Fill circle showing the user's initial opens a 240px Thick Material menu with Float shadow, scaling from 95% out of its top-right corner (200ms): a signed-in header, hairline-separated rows, Sign Out in Destructive Red.

### Photo Tile
- **Style:** the photo fills a 6px-radius tile (2px on phones) whose background is the photo's stored dominant color, or Fill, until the image loads and fades in over 500ms.
- **Hover (pointer devices):** a white like heart (bottom left) and a frosted black download circle (bottom right, `black/35` with blur) fade in; a liked heart stays visible in Like Pink.
- **Double tap:** a 60px heart bursts in place (Like Pink to like; translucent white with a strike to unlike).
- **Selection:** the photo insets to 94% scale and a 22px circular badge with a white ring fills System Blue with a check, popping in.

### Floating Bar
A Thick Material pill-rectangle (20px radius, min 56px tall, max 512px wide) with the Float shadow, floating 12px above the bottom safe area. It slides up 24px and fades in over 300ms on the long-settle curve. It carries selection counts and actions, and zip progress on a 4px Fill track with a Label fill.

### Sheet
A Surface bottom sheet on phones (18px top corners, max 86% height, 36 x 5px Fill 2 grabber), a centered 520px panel from md up. It rises on the long-settle curve over 320ms over a 40% black scrim, and can be dragged down to dismiss (past 110px or a fast flick). Title in Title 3 with a circular close button.

### Photo Viewer
Always black, with white chrome under black gradients at top and bottom: a close button, a "3 of 83" counter, and a bottom row of 44px circular icon buttons (share, like, save or download) that wash white at 10% on hover. Opening is a FLIP zoom from the grid tile on a spring; swiping pages with velocity carried into the settle; dragging down shrinks the photo and fades the backdrop, and release either springs back or returns the photo to its tile. Pinch and double tap zoom to 4x.

## Do's and Don'ts

### Do:
- **Do** use the semantic role (Label, Fill, Surface, System Blue) and let the light and dark pair resolve it; never hard-code one appearance's value in a component.
- **Do** keep System Blue to tappable text and selected state, and Like Pink to likes and kudos.
- **Do** put settings, forms, and admin content in grouped inset lists on the Grouped Page.
- **Do** acknowledge presses by scale (0.97 for buttons, 0.90 to 0.94 for circles) over 150ms.
- **Do** move layers on the long-settle curve (`cubic-bezier(0.32, 0.72, 0, 1)`) and direct manipulation on damped springs, between roughly 200 and 450ms.
- **Do** give every animation an end state that reads correctly when reduced motion collapses it to 1ms; entrance animations start already legible.
- **Do** keep the photo viewer black with white chrome in both appearances.

### Don't:
- **Don't** add grain, textures, gradients as decoration, themed metaphors, or display typefaces; the system is deliberately unthemed.
- **Don't** draw borders around fields, cards, or buttons; depth comes from tonal fill and the one Float shadow.
- **Don't** put a shadow on anything that does not float above content.
- **Don't** use uppercase, letter-spaced eyebrow labels or kickers above titles.
- **Don't** change a button's color on press; press feedback is scale.
- **Don't** let chrome compete with photos: no colored frames, overlays, or captions on tiles beyond the like, download, and selection affordances.
