process.env.JWT_SECRET = 'test-secret-minimum-32-characters-long!!';
process.env.ADMIN_USER_IDS = 'admin-id';

import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { signUserToken } from '@/lib/auth';

async function run(path: string, userId?: string) {
  const headers: Record<string, string> = {};
  if (userId) headers.cookie = `user_session=${await signUserToken(userId, 'name')}`;
  return middleware(new NextRequest(`http://localhost${path}`, { headers }));
}

describe('admin middleware', () => {
  it('lets an admin account through to pages and API routes', async () => {
    for (const path of ['/admin', '/admin/dashboard', '/api/admin/collections']) {
      const res = await run(path, 'admin-id');
      expect(res.headers.get('x-middleware-next')).toBe('1');
    }
  });

  it('sends a signed-out visitor to sign in', async () => {
    const res = await run('/admin/dashboard');
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
  });

  it('sends a signed-in non-admin home', async () => {
    const res = await run('/admin/collections/abc', 'someone-else');
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
  });

  it('answers API calls without admin rights with 401 JSON', async () => {
    expect((await run('/api/admin/collections')).status).toBe(401);
    expect((await run('/api/admin/collections', 'someone-else')).status).toBe(401);
  });

  it('ignores a forged admin_session cookie from the old password login', async () => {
    const res = await middleware(new NextRequest('http://localhost/api/admin/collections', {
      headers: { cookie: 'admin_session=anything' },
    }));
    expect(res.status).toBe(401);
  });
});
