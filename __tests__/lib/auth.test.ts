process.env.JWT_SECRET = 'test-secret-minimum-32-characters-long!!';

import { signToken, verifyToken } from '@/lib/auth';

describe('signToken / verifyToken', () => {
  it('round-trips a collectionId', async () => {
    const token = await signToken('abc-123');
    const payload = await verifyToken(token);
    expect(payload?.collectionId).toBe('abc-123');
  });

  it('returns null for a tampered token', async () => {
    const token = await signToken('abc-123');
    const tampered = token.slice(0, -4) + 'xxxx';
    expect(await verifyToken(tampered)).toBeNull();
  });

  it('returns null for an empty string', async () => {
    expect(await verifyToken('')).toBeNull();
  });
});
