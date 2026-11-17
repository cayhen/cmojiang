process.env.JWT_SECRET = 'test-secret-minimum-32-characters-long!!';

import {
  signToken, verifyToken, signInviteToken, verifyInviteToken, signUserToken, isAdminUserId, verifyAdminUser,
} from '@/lib/auth';

describe('signInviteToken / verifyInviteToken', () => {
  it('round-trips a collectionId', async () => {
    const token = await signInviteToken('col-9');
    const payload = await verifyInviteToken(token);
    expect(payload?.collectionId).toBe('col-9');
  });

  it('rejects a gallery session token (missing invite claim)', async () => {
    const token = await signToken('col-9');
    expect(await verifyInviteToken(token)).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const token = await signInviteToken('col-9');
    expect(await verifyInviteToken(token.slice(0, -4) + 'xxxx')).toBeNull();
  });
});

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

describe('isAdminUserId / verifyAdminUser', () => {
  const saved = process.env.ADMIN_USER_IDS;
  afterEach(() => { process.env.ADMIN_USER_IDS = saved; });

  it('grants admin only to listed account IDs', () => {
    process.env.ADMIN_USER_IDS = ' user-1 , user-2 ';
    expect(isAdminUserId('user-1')).toBe(true);
    expect(isAdminUserId('user-2')).toBe(true);
    expect(isAdminUserId('user-3')).toBe(false);
  });

  it('grants admin to no one when the variable is unset or empty', () => {
    delete process.env.ADMIN_USER_IDS;
    expect(isAdminUserId('user-1')).toBe(false);
    process.env.ADMIN_USER_IDS = ' , ';
    expect(isAdminUserId('')).toBe(false);
  });

  it('returns the account for an admin session and null otherwise', async () => {
    process.env.ADMIN_USER_IDS = 'user-1';
    const admin = await signUserToken('user-1', 'caden');
    const visitor = await signUserToken('user-9', 'someone');
    expect(await verifyAdminUser(admin)).toEqual({ userId: 'user-1', username: 'caden' });
    expect(await verifyAdminUser(visitor)).toBeNull();
    expect(await verifyAdminUser(undefined)).toBeNull();
    expect(await verifyAdminUser(admin.slice(0, -4) + 'xxxx')).toBeNull();
  });

  it('does not accept a gallery or invite token as an admin session', async () => {
    process.env.ADMIN_USER_IDS = 'col-1';
    expect(await verifyAdminUser(await signToken('col-1'))).toBeNull();
    expect(await verifyAdminUser(await signInviteToken('col-1'))).toBeNull();
  });
});
