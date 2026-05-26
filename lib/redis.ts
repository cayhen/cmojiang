import { Redis } from '@upstash/redis';

const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

export const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

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
