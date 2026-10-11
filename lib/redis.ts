import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

export const redis = url && token
  ? new Redis({ url, token })
  : null;

/**
 * Canonical Redis key for a collection's cached photo rows.
 * Single source of truth — the gallery page reads it, photo mutations bust it.
 * Versioned (`v3`) so a payload-shape change doesn't read stale entries.
 */
export const galleryPhotosKey = (collectionId: string) => `gallery:v3:${collectionId}:photos`;

// Redis is an optimization, never a dependency: every call fails open so an
// unreachable or deleted Upstash database degrades to uncached, not to a 500.
export async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!redis) return fetcher();

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) return cached;
  } catch (err) {
    console.error('Redis get failed:', err);
    return fetcher();
  }

  const data = await fetcher();
  await redis.set(key, data, { ex: ttlSeconds }).catch(err => console.error('Redis set failed:', err));
  return data;
}

export async function invalidate(key: string): Promise<void> {
  if (!redis) return;
  await redis.del(key).catch(err => console.error('Redis del failed:', err));
}
