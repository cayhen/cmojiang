process.env.JWT_SECRET = 'test-secret-minimum-32-characters-long!!';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

const mockSingle = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
      upsert: jest.fn().mockResolvedValue({}),
    }),
  },
}));

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

let mockRatelimitInstance: { limit: jest.Mock } | null = { limit: jest.fn() };

jest.mock('@/lib/ratelimit', () => ({
  get ratelimit() {
    return mockRatelimitInstance;
  },
}));

import { POST } from '@/app/api/unlock/route';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

function makeRequest(body: object, extraHeaders: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/unlock', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

describe('POST /api/unlock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRatelimitInstance = { limit: jest.fn().mockResolvedValue({ success: true }) };
  });

  it('returns 400 when fields are missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 404 when collection not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const res = await POST(makeRequest({ collectionId: 'x', password: 'pw' }));
    expect(res.status).toBe(404);
  });

  it('returns 401 on wrong password', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'c1', password_hash: '$2b$hash' }, error: null });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const res = await POST(makeRequest({ collectionId: 'c1', password: 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('sets gallery_session cookie on correct password', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'c1', password_hash: '$2b$hash' }, error: null });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const res = await POST(makeRequest({ collectionId: 'c1', password: 'correct' }));
    expect(res.status).toBe(200);
    expect(res.cookies.get('gallery_session')?.value).toBeTruthy();
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockRatelimitInstance!.limit.mockResolvedValue({ success: false });
    const res = await POST(
      makeRequest({ collectionId: 'c1', password: 'pw' }, { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })
    );
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBe('Too many attempts. Try again in 15 minutes.');
  });

  it('includes Retry-After header on 429', async () => {
    mockRatelimitInstance!.limit.mockResolvedValue({ success: false });
    const res = await POST(
      makeRequest({ collectionId: 'c1', password: 'pw' }, { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })
    );
    expect(res.headers.get('Retry-After')).toBe('900');
  });

  it('extracts first IP from x-forwarded-for with multiple proxies', async () => {
    mockRatelimitInstance!.limit.mockResolvedValue({ success: false });
    await POST(
      makeRequest({ collectionId: 'c1', password: 'pw' }, { 'x-forwarded-for': '5.5.5.5, 10.0.0.1, 172.16.0.1' })
    );
    expect(mockRatelimitInstance!.limit).toHaveBeenCalledWith('5.5.5.5');
  });

  it('falls back to "unknown" when x-forwarded-for is absent', async () => {
    mockRatelimitInstance!.limit.mockResolvedValue({ success: false });
    await POST(makeRequest({ collectionId: 'c1', password: 'pw' }));
    expect(mockRatelimitInstance!.limit).toHaveBeenCalledWith('unknown');
  });

  it('skips rate limit check and proceeds when ratelimit is null (fail-open)', async () => {
    mockRatelimitInstance = null;
    // With no rate limiter, a missing-fields request should reach body validation (400), not short-circuit to 429
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
