---
version: 1
slug: "app-c-id-gallery-page-tsx"
primary_target: "app/c/[id]/gallery/page.tsx"
related_targets: ["app/page.tsx"]
---

# Surface brief: whole product revamp (gallery-led)

Scope: every route, visitor and admin. Visitor mode: Experience for the gallery and lightbox (the photos lead); Operate for home, unlock, auth, profile, and admin.

Audience and job: friends from the event, mostly on phones from a group-chat link, often at night; find their photos, like them, save them. Admin: Caden managing collections.

Constraints: no new server work per page view (free tiers); no new runtime dependencies; follow the system appearance (light/dark); the photo viewer is always black; respect reduced motion.

Craft bar: Apple Photos and Linear. Two themed rounds were rejected as "too themed"; the user chose the clean category standard.

Memorable moment: a photo grows out of its tile into the viewer and settles back into it on close.

Unresolved: whether home gets collection thumbnails (adds one signed URL per collection per load; flag before building).

## Direction contract

THESIS: A clean, unthemed gallery at Apple Photos and Linear polish. The interface is system chrome: neutral, quiet, exact; the photos are the only image. It refuses decoration: no grain, no display gimmicks, no themed metaphor.
OWN-WORLD: System font stack, iOS-style semantic neutrals in light and dark, one blue tint for tappable text, pink only for likes. Frosted translucent bars, continuous-corner radii (10 to 14px on controls, 6px on tiles), grouped inset lists for settings and admin, pill buttons, hairline separators. Depth by tonal steps plus one soft shadow for floating layers.
STORY: Arrive, see the collection name in a large title, scroll the night in capture order, open a photo, like or save it, leave with it.
FIRST VIEWPORT: Gallery on a phone: large bold title with date and count under it, a compact action row (Select, size, download), then the edge-to-edge grid with 2px gutters filling the rest. On scroll the title collapses into a frosted top bar. Home: large title "cmojiang", search field, grouped list of collections.
FORM: the category standard (standing exit), chosen by the user after two rounds; seed:bc1a9121db5fcfa3
SIGNATURE INTERACTION AND MOTION: tile-to-viewer zoom (FLIP from the tile rect, spring easing), drag down to dismiss with the backdrop fading, pinch or slider changes grid density in detents via view transitions. Springs with mass and damping, 200 to 450ms; reduced motion renders end states.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
