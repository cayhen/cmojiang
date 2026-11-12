# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: friends who were at an event Caden photographed. They arrive from a shared password or invite link, usually soon after the event and often on their phone. They want to find photos of themselves and their friends, like the good ones, and save them to their camera roll or download them in bulk.

Secondary: Caden as the sole admin, who creates collections, uploads edited photos, and re-shares passwords and invite links.

## Product Purpose

cmojiang is a private delivery tool. It exists to get edited event photos to the people in them. Showing off Caden's photography is a side effect, not the goal.

It succeeds when a friend can open a link, get into the right collection without friction, find the photos they care about, and leave with them saved at full quality.

## Positioning

These are personal galleries from one photographer to the people who were there. They aren't a stock portfolio or a client-proofing service. Each collection is one event, ordered by capture time so it reads like the night happened. Access is shared person to person, by password or invite link.

## Operating Context

- Entry points: home page listing public collections, a direct `/c/[id]` link plus password, or a `/join/<token>` invite link that skips the password.
- Visitors can browse without an account. Signing in (email/password or Google) adds kudos, comments, photo likes, a liked-photos page, and remembered access to unlocked collections.
- Core visitor actions: browse the masonry grid, open the lightbox (swipe, pinch-zoom, share), like by double-tap or heart, select photos, save to Photos on mobile, and download originals singly or as a zip.
- Admin work happens at `/admin`: create a collection, set its password and event date, mark it private, upload batches (including HEIC), delete photos, mint invite links.
- Collections can be private, which hides them from the home page so they're reachable only by link.

## Capabilities and Constraints

- Next.js 14 App Router on Vercel, Supabase Postgres for metadata, Cloudflare R2 for images (served through presigned URLs). Personal project on free tiers: any change that raises Vercel or Supabase usage must be flagged before it's built (see CLAUDE.md).
- Photos are the content. Full-resolution originals plus 600px thumbnails, with stored width/height and dominant color when available.
- Terminology: "collection" (one event), "gallery" (the unlocked photo view), "kudos" (collection-level appreciation), "like" (per-photo).
- Plaintext collection passwords are stored and shown to the admin on purpose so they can be re-shared. Don't remove this.
- No email verification on signup, by design.

## Brand Commitments

- Name and wordmark: "cmojiang", set in the self-hosted Rogeta face. The wordmark doubles as the contact card: hovering certain letters reveals email, Instagram, and school affiliation.
- Voice: polished studio. Copy is clean, precise, and professional, never cute or chatty. It should sound like a capable photographer's service, even though the audience is friends.
- Photography-first: the interface steps back so the photos lead (carried from the original 2026-05-23 spec).

## Evidence on Hand

- Real collections and photos live in production. Nothing ships in the repo, so design work needs stand-in imagery or local uploads.
- Design history: `docs/superpowers/specs/` (original gallery spec, lightbox like, save to Photos, mobile responsive nav).
- No testimonials, client list, pricing, or booking flow exist. Don't invent them. This isn't a commercial portfolio.

## Product Principles

1. **Photos first, interface second.** Every screen exists to get a visitor to the right photos and out with them. Chrome that competes with the images is a cost.
2. **Zero-friction access.** Passwords, invite links, and remembered access exist to remove steps. Never add a step between a friend and their photos.
3. **Phone is the primary device.** Visitors usually arrive from a text or group chat link. Saving to the camera roll matters as much as desktop zip download.
4. **Quietly professional.** Polished, precise, restrained, the way a studio delivers work. Not a social app, not a showcase.
5. **Light on resources.** Free-tier hosting and visitors' mobile data both argue for less: fewer requests, smaller payloads, no unnecessary server work.
