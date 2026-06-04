# Rate Limiting — Design Spec
**Date:** 2026-06-04

---

## Overview

Add IP-based rate limiting to the collection unlock endpoint (`POST /api/unlock`) to prevent brute-force password attacks. Without limiting, an attacker who knows a collection URL could script thousands of bcrypt comparisons, spiking Vercel function CPU and potentially draining free-tier quota.

Upstash Redis is already configured in `lib/redis.ts`, so no new infrastructure is needed.

---

## Approach

Use the `@upstash/ratelimit` package (Upstash's first-party library) for a sliding window rate limiter. This handles atomic Redis operations and edge-safe behavior without custom logic.

**Limit:** 10 attempts per 15-minute sliding window, keyed by client IP.

**Fail-open:** If Redis env vars are absent (local dev without Redis), the rate limiter is `null` and the check is skipped — requests proceed normally. This avoids dev friction and is acceptable for a photo gallery.

---

## Files Changed

### `lib/ratelimit.ts` (new)

Creates and exports a `Ratelimit` instance configured with:
- `Ratelimit.slidingWindow(10, '15 m')`
- The existing Upstash Redis client from `lib/redis.ts`

Exports `null` if Redis is not configured.

### `app/api/unlock/route.ts`

Three additions before the Supabase query:

1. **Extract client IP** from `x-forwarded-for` header (Vercel's reliable header), falling back to `"unknown"`
2. **Check rate limit** — if the limiter is configured and the IP is over the limit, return immediately
3. **429 response** with body `{ error: "Too many attempts. Try again in 15 minutes." }` and header `Retry-After: 900`

The check runs before `bcrypt.compare` to avoid wasting CPU on spam requests.

### `components/UnlockForm.tsx`

Handle `429` status explicitly. Currently all non-ok responses fall through to `data.error ?? 'Something went wrong'`. The API already returns a descriptive error string on 429, so no special-casing is needed — the existing error display path handles it correctly.

---

## Error Response

```json
HTTP 429 Too Many Requests
Retry-After: 900

{ "error": "Too many attempts. Try again in 15 minutes." }
```

---

## What's Not In Scope

- Rate limiting other endpoints (admin login, photo downloads, etc.) — can be added later using the same pattern
- Per-collection rate limiting (IP + collectionId) — unnecessary complexity; a single IP spamming any collection is still an attack worth blocking
- CAPTCHA or challenge flows — overkill for a private photo gallery
