process.env.JWT_SECRET = 'test-secret-minimum-32-characters-long!!';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

const mockSingle = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ single: mockSingle }) }),
    }),
  },
}));

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

import { POST } from '@/app/api/unlock/route';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/unlock', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/unlock', () => {
  beforeEach(() => jest.clearAllMocks());

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
});
