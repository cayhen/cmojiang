import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

export const redis = url && token
  ? new Redis({ url, token })
  : null;

/**
 * Canonical Redis key for a collection's cached photo rows.
 * Single source of truth — the gallery page reads it, photo mutations bust it.
 * Versioned (`v2`) so a payload-shape change doesn't read stale entries.
 */
export const galleryPhotosKey = (collectionId: string) => `gallery:v2:${collectionId}:photos`;

export async function cachedFetch<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!redis) return fetcher();

  const cached = await redis.get<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  await redis.set(key, data, { ex: ttlSeconds });
  return data;
}

export async function invalidate(key: string): Promise<void> {
  if (!redis) return;
  await redis.del(key);
}
