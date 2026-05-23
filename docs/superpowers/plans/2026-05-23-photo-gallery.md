# Photo Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private photo gallery where visitors unlock collections with a password and browse/download photos, with a Google-authenticated admin interface for Caden to manage everything.

**Architecture:** Next.js 14 App Router with server components handling all Supabase service-role calls. Visitor auth uses custom JWT cookies (jose + bcryptjs). Admin auth uses Supabase Google OAuth protected by middleware. Signed URLs are generated server-side only — the service role key never reaches the client.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, DM Sans, Supabase (Postgres + Storage + Auth), jose, bcryptjs, archiver, focus-trap-react, @supabase/ssr

---

## File Map

```
photo-gallery/
  app/
    layout.tsx                          # Root layout, DM Sans font, global bg
    page.tsx                            # Homepage — fetches collections server-side, renders SearchBar
    c/[id]/
      page.tsx                          # Unlock page — shows collection name + UnlockForm
      gallery/
        page.tsx                        # Gallery — validates JWT, fetches signed URLs, renders MasonryGrid
    admin/
      page.tsx                          # Google sign-in (client component)
      dashboard/page.tsx                # Collection list with manage links
      collections/
        new/page.tsx                    # Create collection form
        [id]/page.tsx                   # Manage collection — upload photos, change password, delete
  api/
    collections/
      route.ts                          # GET: all collections with photo count
      [id]/
        route.ts                        # GET: single collection name
        photos/route.ts                 # GET: photos with signed URLs (session JWT required)
        zip/route.ts                    # GET: streaming zip (session JWT required)
    unlock/route.ts                     # POST: verify password, set JWT cookie
    admin/
      collections/
        route.ts                        # GET/POST admin collections
        [id]/
          route.ts                      # PATCH/DELETE collection
          photos/route.ts               # POST/DELETE photos
  components/
    CollectionCard.tsx                  # Homepage card (name + count)
    SearchBar.tsx                       # Client-side collection filter + card grid
    UnlockForm.tsx                      # Password input form (client)
    MasonryGrid.tsx                     # CSS columns masonry, opens Lightbox
    Lightbox.tsx                        # Focus-trapped full-screen viewer
  lib/
    supabase.ts                         # supabaseAdmin (service role) + createServerSupabaseClient
    auth.ts                             # signToken / verifyToken (jose)
    session.ts                          # Cookie name, read helper, cookie options
  middleware.ts                         # Protects /admin/:path+ routes
  __tests__/
    lib/auth.test.ts
    api/unlock.test.ts
```

---

## Task 1: Initialize project + install dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `app/globals.css`, `.env.local.example`

- [ ] **Step 1: Scaffold Next.js 14 project**

```bash
cd /Users/caden/projects
npx create-next-app@14 photo-gallery \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd photo-gallery
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr bcryptjs jose archiver focus-trap-react
npm install --save-dev @types/bcryptjs @types/archiver jest jest-environment-node ts-jest @types/jest
```

- [ ] **Step 3: Install DM Sans and configure Tailwind**

Replace `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Set up root layout with DM Sans**

Replace `app/layout.tsx`:

```typescript
import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-dm-sans',
});

export const metadata: Metadata = {
  title: 'Caden Jiang — Photos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="font-sans bg-[#0f0f0f] text-[#888] antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create .env.local.example**

```bash
cat > .env.local.example << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
EOF
```

- [ ] **Step 6: Add .superpowers to .gitignore**

```bash
echo '.superpowers/' >> .gitignore
echo '.env.local' >> .gitignore
```

- [ ] **Step 7: Configure next.config.ts**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 14 project with dependencies"
```

---

## Task 2: Supabase project setup (manual steps)

**No code — follow these steps in the Supabase dashboard.**

- [ ] **Step 1: Create new Supabase project**

Go to supabase.com → New project. Note the project URL and anon key.

- [ ] **Step 2: Run SQL schema**

In the SQL editor, run:

```sql
create table collections (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  password_hash text not null,
  created_at    timestamptz default now()
);

create table photos (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete cascade,
  storage_path  text not null,
  filename      text not null,
  uploaded_at   timestamptz default now()
);
```

- [ ] **Step 3: Set up Row Level Security**

```sql
alter table collections enable row level security;
alter table photos enable row level security;

-- Public can read collection id and name only
create policy "public read collections"
  on collections for select
  using (true);

-- No public access to photos
create policy "no public photos"
  on photos for select
  using (false);
```

- [ ] **Step 4: Create storage bucket**

Storage → New bucket → name: `photos` → toggle Private → Create.

- [ ] **Step 5: Enable Google OAuth**

Authentication → Providers → Google → Enable. Add your Google OAuth client ID and secret (from Google Cloud Console). Set redirect URL to `https://cmojiang.vercel.app/admin` and `http://localhost:3000/admin` for local dev.

- [ ] **Step 6: Copy credentials to .env.local**

```bash
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY (from Project Settings → API)
# JWT_SECRET: run `openssl rand -base64 32` and paste the output
```

---

## Task 3: Jest setup

**Files:**
- Create: `jest.config.ts`, `__tests__/lib/auth.test.ts` (placeholder)

- [ ] **Step 1: Create jest.config.ts**

```typescript
import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};

export default config;
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 3: Verify Jest runs**

```bash
npm test -- --passWithNoTests
```

Expected output: `Test Suites: 0 skipped, 0 total`

---

## Task 4: lib/supabase.ts

**Files:**
- Create: `lib/supabase.ts`

- [ ] **Step 1: Create the file**

```typescript
import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export function createServerSupabaseClient() {
  const cookieStore = cookies();
  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add Supabase client helpers"
```

---

## Task 5: lib/auth.ts + tests

**Files:**
- Create: `lib/auth.ts`, `__tests__/lib/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/auth.test.ts
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern=auth
```

Expected: `Cannot find module '@/lib/auth'`

- [ ] **Step 3: Implement lib/auth.ts**

```typescript
import { SignJWT, jwtVerify } from 'jose';

function secret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export async function signToken(collectionId: string): Promise<string> {
  return new SignJWT({ collectionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifyToken(token: string): Promise<{ collectionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { collectionId: payload.collectionId as string };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern=auth
```

Expected: `Tests: 3 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts __tests__/lib/auth.test.ts
git commit -m "feat: add JWT sign/verify helpers with tests"
```

---

## Task 6: lib/session.ts

**Files:**
- Create: `lib/session.ts`

- [ ] **Step 1: Create the file**

```typescript
import { cookies } from 'next/headers';
import { verifyToken } from './auth';

export const COOKIE_NAME = 'gallery_session';

export async function getSessionCollectionId(): Promise<string | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.collectionId ?? null;
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/session.ts
git commit -m "feat: add session cookie helpers"
```

---

## Task 7: Admin middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware.ts**

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== 'cadenjiang777@gmail.com') {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return res;
}

export const config = {
  // Matches /admin/anything but NOT /admin itself (login page)
  matcher: ['/admin/:path+'],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add admin middleware with Google account check"
```

---

## Task 8: Public collections API

**Files:**
- Create: `app/api/collections/route.ts`, `app/api/collections/[id]/route.ts`

- [ ] **Step 1: Create GET /api/collections**

```typescript
// app/api/collections/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('collections')
    .select('id, name, photos(count)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }

  const collections = (data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    photo_count: (c.photos as { count: number }[])[0]?.count ?? 0,
  }));

  return NextResponse.json(collections);
}
```

- [ ] **Step 2: Create GET /api/collections/[id]**

```typescript
// app/api/collections/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabaseAdmin
    .from('collections')
    .select('id, name')
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/collections/
git commit -m "feat: add public collections API routes"
```

---

## Task 9: Unlock API + tests

**Files:**
- Create: `app/api/unlock/route.ts`, `__tests__/api/unlock.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/api/unlock.test.ts
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
```

- [ ] **Step 2: Run — verify they fail**

```bash
npm test -- --testPathPattern=unlock
```

Expected: `Cannot find module '@/app/api/unlock/route'`

- [ ] **Step 3: Implement the route**

```typescript
// app/api/unlock/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { signToken } from '@/lib/auth';
import { sessionCookieOptions } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { collectionId, password } = await req.json();

  if (!collectionId || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const { data: collection, error } = await supabaseAdmin
    .from('collections')
    .select('id, password_hash')
    .eq('id', collectionId)
    .single();

  if (error || !collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  const valid = await bcrypt.compare(password, collection.password_hash);

  if (!valid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const token = await signToken(collectionId);
  const opts = sessionCookieOptions();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(opts.name, token, opts);
  return res;
}
```

- [ ] **Step 4: Run — verify tests pass**

```bash
npm test -- --testPathPattern=unlock
```

Expected: `Tests: 3 passed`

- [ ] **Step 5: Commit**

```bash
git add app/api/unlock/ __tests__/api/unlock.test.ts
git commit -m "feat: add unlock API with JWT cookie and tests"
```

---

## Task 10: CollectionCard + SearchBar components

**Files:**
- Create: `components/CollectionCard.tsx`, `components/SearchBar.tsx`

- [ ] **Step 1: Create CollectionCard**

```typescript
// components/CollectionCard.tsx
import Link from 'next/link';

interface Props {
  id: string;
  name: string;
  photo_count: number;
}

export function CollectionCard({ id, name, photo_count }: Props) {
  return (
    <Link
      href={`/c/${id}`}
      className="block bg-[#161616] border border-[#1a1a1a] rounded p-4 hover:border-[#2a2a2a] transition-colors"
    >
      <p className="text-[#888] text-sm font-light">{name}</p>
      <p className="text-[#3a3a3a] text-xs mt-1 font-light">
        {photo_count} {photo_count === 1 ? 'photo' : 'photos'}
      </p>
    </Link>
  );
}
```

- [ ] **Step 2: Create SearchBar**

```typescript
// components/SearchBar.tsx
'use client';

import { useState } from 'react';
import { CollectionCard } from './CollectionCard';

interface Collection {
  id: string;
  name: string;
  photo_count: number;
}

export function SearchBar({ collections }: { collections: Collection[] }) {
  const [query, setQuery] = useState('');

  const filtered = collections.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Search collections..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full bg-[#161616] border border-[#1e1e1e] rounded px-3 py-2 text-[#888] text-sm placeholder:text-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a] mb-5 font-light"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(c => (
          <CollectionCard key={c.id} {...c} />
        ))}
        {filtered.length === 0 && query && (
          <p className="text-[#3a3a3a] text-sm col-span-full">No collections found.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/
git commit -m "feat: add CollectionCard and SearchBar components"
```

---

## Task 11: Homepage

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace app/page.tsx**

```typescript
// app/page.tsx
import { supabaseAdmin } from '@/lib/supabase';
import { SearchBar } from '@/components/SearchBar';

export const revalidate = 0;

export default async function HomePage() {
  const { data } = await supabaseAdmin
    .from('collections')
    .select('id, name, photos(count)')
    .order('created_at', { ascending: false });

  const collections = (data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    photo_count: (c.photos as { count: number }[])[0]?.count ?? 0,
  }));

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <header className="mb-8">
        <p className="text-[#3a3a3a] text-xs tracking-widest uppercase font-light">
          Caden Jiang — Photos
        </p>
      </header>
      <SearchBar collections={collections} />
    </main>
  );
}
```

- [ ] **Step 2: Start dev server and verify homepage renders**

```bash
npm run dev
```

Open http://localhost:3000. Should show the header and empty search bar on a dark background.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add homepage with collection grid and search"
```

---

## Task 12: UnlockForm component + Unlock page

**Files:**
- Create: `components/UnlockForm.tsx`, `app/c/[id]/page.tsx`

- [ ] **Step 1: Create UnlockForm (client component)**

```typescript
// components/UnlockForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function UnlockForm({ collectionId }: { collectionId: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, password }),
    });

    if (res.ok) {
      router.push(`/c/${collectionId}/gallery`);
    } else {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        className="w-full bg-[#161616] border border-[#1e1e1e] rounded px-3 py-2.5 text-[#888] text-sm placeholder:text-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a] font-light"
      />
      {error && <p className="text-red-500/70 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#161616] border border-[#1e1e1e] text-[#666] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#888] transition-colors disabled:opacity-50"
      >
        {loading ? 'Checking...' : 'Unlock'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create unlock page**

```typescript
// app/c/[id]/page.tsx
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { UnlockForm } from '@/components/UnlockForm';

export default async function UnlockPage({ params }: { params: { id: string } }) {
  const { data: collection } = await supabaseAdmin
    .from('collections')
    .select('id, name')
    .eq('id', params.id)
    .single();

  if (!collection) notFound();

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <h1 className="text-[#888] font-light text-lg text-center mb-8">
          {collection.name}
        </h1>
        <UnlockForm collectionId={collection.id} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/UnlockForm.tsx app/c/
git commit -m "feat: add unlock page and password form"
```

---

## Task 13: Protected photos API

**Files:**
- Create: `app/api/collections/[id]/photos/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/collections/[id]/photos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload || payload.collectionId !== params.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: photos, error } = await supabaseAdmin
    .from('photos')
    .select('id, filename, storage_path')
    .eq('collection_id', params.id)
    .order('uploaded_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });

  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async photo => {
      const { data } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 3600);
      return { id: photo.id, filename: photo.filename, url: data?.signedUrl ?? '' };
    })
  );

  return NextResponse.json(photosWithUrls);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/collections/
git commit -m "feat: add protected photos API with signed URLs"
```

---

## Task 14: MasonryGrid + Lightbox components

**Files:**
- Create: `components/MasonryGrid.tsx`, `components/Lightbox.tsx`

- [ ] **Step 1: Create Lightbox**

```typescript
// components/Lightbox.tsx
'use client';

import { useEffect, useState } from 'react';
import FocusTrap from 'focus-trap-react';

interface Photo { id: string; filename: string; url: string; }

interface Props {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
}

export function Lightbox({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const photo = photos[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, photos.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length, onClose]);

  return (
    <FocusTrap focusTrapOptions={{ onDeactivate: onClose, clickOutsideDeactivates: true }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={photo.filename}
        className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative flex flex-col items-center max-w-5xl w-full"
          onClick={e => e.stopPropagation()}
        >
          <img
            src={photo.url}
            alt={photo.filename}
            className="max-h-[80vh] max-w-full object-contain"
          />
          <div className="flex justify-between items-center w-full mt-4 px-2">
            <div className="flex gap-4">
              <button
                onClick={() => setIndex(i => Math.max(i - 1, 0))}
                disabled={index === 0}
                aria-label="Previous photo"
                className="text-[#555] hover:text-[#888] disabled:opacity-30 text-sm transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setIndex(i => Math.min(i + 1, photos.length - 1))}
                disabled={index === photos.length - 1}
                aria-label="Next photo"
                className="text-[#555] hover:text-[#888] disabled:opacity-30 text-sm transition-colors"
              >
                Next →
              </button>
            </div>
            <a
              href={photo.url}
              download={photo.filename}
              className="text-[#555] hover:text-[#888] text-sm transition-colors"
            >
              Download
            </a>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close lightbox"
          className="absolute top-4 right-4 text-[#555] hover:text-[#888] text-2xl leading-none transition-colors"
        >
          ×
        </button>
      </div>
    </FocusTrap>
  );
}
```

- [ ] **Step 2: Create MasonryGrid**

```typescript
// components/MasonryGrid.tsx
'use client';

import { useState } from 'react';
import { Lightbox } from './Lightbox';

interface Photo { id: string; filename: string; url: string; }

export function MasonryGrid({ photos }: { photos: Photo[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-1.5">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            className="break-inside-avoid mb-1.5 w-full block focus:outline-none focus:ring-1 focus:ring-[#333] rounded-sm"
            onClick={() => setLightboxIndex(i)}
            aria-label={`Open ${photo.filename}`}
          >
            <img
              src={photo.url}
              alt={photo.filename}
              loading="lazy"
              className="w-full block rounded-sm"
            />
          </button>
        ))}
      </div>
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/Lightbox.tsx components/MasonryGrid.tsx
git commit -m "feat: add MasonryGrid and Lightbox with focus trap"
```

---

## Task 15: Gallery page

**Files:**
- Create: `app/c/[id]/gallery/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/c/[id]/gallery/page.tsx
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { MasonryGrid } from '@/components/MasonryGrid';
import Link from 'next/link';

export default async function GalleryPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) redirect(`/c/${params.id}`);

  const payload = await verifyToken(token);
  if (!payload || payload.collectionId !== params.id) {
    redirect(`/c/${params.id}`);
  }

  const { data: collection } = await supabaseAdmin
    .from('collections')
    .select('name')
    .eq('id', params.id)
    .single();

  if (!collection) notFound();

  const { data: photos } = await supabaseAdmin
    .from('photos')
    .select('id, filename, storage_path')
    .eq('collection_id', params.id)
    .order('uploaded_at', { ascending: true });

  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async photo => {
      const { data } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 3600);
      return { id: photo.id, filename: photo.filename, url: data?.signedUrl ?? '' };
    })
  );

  return (
    <main className="min-h-screen p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#3a3a3a] text-xs hover:text-[#555] transition-colors">
            ← All
          </Link>
          <h1 className="text-[#888] font-light text-sm">{collection.name}</h1>
        </div>
        <a
          href={`/api/collections/${params.id}/zip`}
          className="text-[#3a3a3a] text-xs hover:text-[#666] transition-colors"
        >
          Download all
        </a>
      </div>
      {photosWithUrls.length === 0 ? (
        <p className="text-[#3a3a3a] text-sm">No photos yet.</p>
      ) : (
        <MasonryGrid photos={photosWithUrls} />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/c/
git commit -m "feat: add gallery page with masonry grid"
```

---

## Task 16: Zip download API

**Files:**
- Create: `app/api/collections/[id]/zip/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/collections/[id]/zip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { COOKIE_NAME } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return new NextResponse('Unauthorized', { status: 401 });

  const payload = await verifyToken(token);
  if (!payload || payload.collectionId !== params.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const [{ data: collection }, { data: photos }] = await Promise.all([
    supabaseAdmin.from('collections').select('name').eq('id', params.id).single(),
    supabaseAdmin.from('photos').select('storage_path, filename').eq('collection_id', params.id),
  ]);

  if (!photos?.length) return new NextResponse('No photos', { status: 404 });

  const slug = (collection?.name ?? 'photos')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const signedPhotos = await Promise.all(
    photos.map(async p => {
      const { data } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrl(p.storage_path, 1800);
      return { url: data?.signedUrl ?? '', filename: p.filename };
    })
  );

  const passthrough = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(passthrough);

  (async () => {
    for (const { url, filename } of signedPhotos) {
      if (!url) continue;
      const res = await fetch(url);
      if (!res.body) continue;
      archive.append(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), { name: filename });
    }
    await archive.finalize();
  })();

  const stream = new ReadableStream({
    start(controller) {
      passthrough.on('data', chunk => controller.enqueue(chunk));
      passthrough.on('end', () => controller.close());
      passthrough.on('error', err => controller.error(err));
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${slug}.zip"`,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/collections/
git commit -m "feat: add streaming zip download API"
```

---

## Task 17: Admin sign-in page

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Create admin sign-in page**

```typescript
// app/admin/page.tsx
'use client';

import { createBrowserClient } from '@supabase/ssr';

export default function AdminSignIn() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/admin/dashboard` },
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xs text-center">
        <p className="text-[#3a3a3a] text-xs tracking-widest uppercase mb-8 font-light">Admin</p>
        <button
          onClick={signInWithGoogle}
          className="w-full bg-[#161616] border border-[#1a1a1a] text-[#666] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#888] transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: add admin Google sign-in page"
```

---

## Task 18: Admin collections API (CRUD)

**Files:**
- Create: `app/api/admin/collections/route.ts`, `app/api/admin/collections/[id]/route.ts`

- [ ] **Step 1: Create GET/POST /api/admin/collections**

```typescript
// app/api/admin/collections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('collections')
    .select('id, name, created_at, photos(count)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();

  if (!name?.trim() || !password) {
    return NextResponse.json({ error: 'Name and password required' }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabaseAdmin
    .from('collections')
    .insert({ name: name.trim(), password_hash })
    .select('id, name')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 2: Create PATCH/DELETE /api/admin/collections/[id]**

```typescript
// app/api/admin/collections/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { name, password } = await req.json();
  const updates: Record<string, string> = {};

  if (name?.trim()) updates.name = name.trim();
  if (password) updates.password_hash = await bcrypt.hash(password, 12);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('collections')
    .update(updates)
    .eq('id', params.id)
    .select('id, name')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // List and remove all files from storage first
  const { data: files } = await supabaseAdmin.storage
    .from('photos')
    .list(params.id);

  if (files?.length) {
    const paths = files.map(f => `${params.id}/${f.name}`);
    await supabaseAdmin.storage.from('photos').remove(paths);
  }

  const { error } = await supabaseAdmin
    .from('collections')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/
git commit -m "feat: add admin collections CRUD API"
```

---

## Task 19: Admin photos API (upload + delete)

**Files:**
- Create: `app/api/admin/collections/[id]/photos/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/admin/collections/[id]/photos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import path from 'path';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const formData = await req.formData();
  const files = formData.getAll('photos') as File[];

  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const results = await Promise.all(
    files.map(async file => {
      const photoId = randomUUID();
      const ext = path.extname(file.name).toLowerCase() || '.jpg';
      const storagePath = `${params.id}/${photoId}${ext}`;

      const buffer = await file.arrayBuffer();

      const { error: uploadError } = await supabaseAdmin.storage
        .from('photos')
        .upload(storagePath, buffer, { contentType: file.type });

      if (uploadError) return { filename: file.name, error: uploadError.message };

      const { error: dbError } = await supabaseAdmin
        .from('photos')
        .insert({ collection_id: params.id, storage_path: storagePath, filename: file.name });

      if (dbError) {
        await supabaseAdmin.storage.from('photos').remove([storagePath]);
        return { filename: file.name, error: dbError.message };
      }

      return { filename: file.name, ok: true };
    })
  );

  return NextResponse.json(results, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { photoId } = await req.json();

  const { data: photo } = await supabaseAdmin
    .from('photos')
    .select('storage_path')
    .eq('id', photoId)
    .eq('collection_id', params.id)
    .single();

  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await supabaseAdmin.storage.from('photos').remove([photo.storage_path]);

  await supabaseAdmin.from('photos').delete().eq('id', photoId);

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/
git commit -m "feat: add admin photo upload and delete API"
```

---

## Task 20: Admin dashboard

**Files:**
- Create: `app/admin/dashboard/page.tsx`

- [ ] **Step 1: Create dashboard page**

```typescript
// app/admin/dashboard/page.tsx
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';

export const revalidate = 0;

export default async function AdminDashboard() {
  const { data: collections } = await supabaseAdmin
    .from('collections')
    .select('id, name, created_at, photos(count)')
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <p className="text-[#3a3a3a] text-xs tracking-widest uppercase font-light">Collections</p>
        <Link
          href="/admin/collections/new"
          className="text-[#666] text-xs hover:text-[#888] transition-colors"
        >
          + New
        </Link>
      </div>
      <div className="space-y-0">
        {(collections ?? []).map(c => (
          <div
            key={c.id}
            className="flex justify-between items-center border-b border-[#1a1a1a] py-3"
          >
            <div>
              <p className="text-[#888] text-sm font-light">{c.name}</p>
              <p className="text-[#3a3a3a] text-xs">
                {(c.photos as { count: number }[])[0]?.count ?? 0} photos
              </p>
            </div>
            <Link
              href={`/admin/collections/${c.id}`}
              className="text-[#3a3a3a] text-xs hover:text-[#666] transition-colors"
            >
              Manage →
            </Link>
          </div>
        ))}
        {!collections?.length && (
          <p className="text-[#3a3a3a] text-sm">No collections yet.</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/dashboard/
git commit -m "feat: add admin dashboard"
```

---

## Task 21: Admin new collection page

**Files:**
- Create: `app/admin/collections/new/page.tsx`

- [ ] **Step 1: Create page**

```typescript
// app/admin/collections/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewCollectionPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/admin/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });

    if (res.ok) {
      router.push('/admin/dashboard');
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to create');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-md mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/dashboard" className="text-[#3a3a3a] text-xs hover:text-[#555]">
          ← Back
        </Link>
        <p className="text-[#3a3a3a] text-xs tracking-widest uppercase font-light">New Collection</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Collection name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#888] text-sm placeholder:text-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a] font-light"
        />
        <input
          type="password"
          placeholder="Collection password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2.5 text-[#888] text-sm placeholder:text-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a] font-light"
        />
        {error && <p className="text-red-500/70 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#161616] border border-[#1a1a1a] text-[#666] text-sm py-2.5 rounded hover:border-[#2a2a2a] hover:text-[#888] transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Collection'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/collections/new/
git commit -m "feat: add new collection admin page"
```

---

## Task 22: Admin manage collection page

**Files:**
- Create: `app/admin/collections/[id]/page.tsx`

- [ ] **Step 1: Create manage collection page**

```typescript
// app/admin/collections/[id]/page.tsx
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { ManageCollectionClient } from './ManageCollectionClient';

export default async function ManageCollectionPage({ params }: { params: { id: string } }) {
  const [{ data: collection }, { data: photos }] = await Promise.all([
    supabaseAdmin.from('collections').select('id, name').eq('id', params.id).single(),
    supabaseAdmin
      .from('photos')
      .select('id, filename, storage_path')
      .eq('collection_id', params.id)
      .order('uploaded_at', { ascending: true }),
  ]);

  if (!collection) notFound();

  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async photo => {
      const { data } = await supabaseAdmin.storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 3600);
      return { id: photo.id, filename: photo.filename, url: data?.signedUrl ?? '' };
    })
  );

  return (
    <ManageCollectionClient
      collection={collection}
      initialPhotos={photosWithUrls}
    />
  );
}
```

- [ ] **Step 2: Create ManageCollectionClient**

```typescript
// app/admin/collections/[id]/ManageCollectionClient.tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Photo { id: string; filename: string; url: string; }
interface Collection { id: string; name: string; }

export function ManageCollectionClient({
  collection,
  initialPhotos,
}: {
  collection: Collection;
  initialPhotos: Photo[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadErrors([]);

    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('photos', f));

    const res = await fetch(`/api/admin/collections/${collection.id}/photos`, {
      method: 'POST',
      body: formData,
    });

    const results = await res.json();
    const errors = results.filter((r: { error?: string }) => r.error).map((r: { filename: string; error: string }) => `${r.filename}: ${r.error}`);
    setUploadErrors(errors);
    setUploading(false);
    // Navigate to same page to force server component re-render and fresh initialPhotos
    router.push(`/admin/collections/${collection.id}`);
  }

  async function handleDelete(photoId: string) {
    if (!confirm('Delete this photo?')) return;
    await fetch(`/api/admin/collections/${collection.id}/photos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId }),
    });
    setPhotos(ps => ps.filter(p => p.id !== photoId));
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/collections/${collection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    setPasswordMsg(res.ok ? 'Password updated.' : 'Failed.');
    setNewPassword('');
  }

  async function handleDeleteCollection() {
    if (!confirm(`Delete "${collection.name}" and all its photos? This cannot be undone.`)) return;
    await fetch(`/api/admin/collections/${collection.id}`, { method: 'DELETE' });
    router.push('/admin/dashboard');
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/dashboard" className="text-[#3a3a3a] text-xs hover:text-[#555]">← Back</Link>
        <p className="text-[#888] text-sm font-light">{collection.name}</p>
      </div>

      {/* Upload */}
      <section className="mb-8">
        <p className="text-[#3a3a3a] text-xs uppercase tracking-widest mb-3">Upload Photos</p>
        <div
          className="border border-dashed border-[#2a2a2a] rounded p-8 text-center cursor-pointer hover:border-[#3a3a3a] transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
        >
          <p className="text-[#3a3a3a] text-sm font-light">
            {uploading ? 'Uploading...' : 'Drag photos here or click to select'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
        </div>
        {uploadErrors.map((err, i) => (
          <p key={i} className="text-red-500/70 text-xs mt-1">{err}</p>
        ))}
      </section>

      {/* Photos */}
      <section className="mb-8">
        <p className="text-[#3a3a3a] text-xs uppercase tracking-widest mb-3">
          Photos ({photos.length})
        </p>
        <div className="grid grid-cols-3 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative group">
              <img src={photo.url} alt={photo.filename} className="w-full rounded-sm" />
              <button
                onClick={() => handleDelete(photo.id)}
                className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Change password */}
      <section className="mb-8">
        <p className="text-[#3a3a3a] text-xs uppercase tracking-widest mb-3">Change Password</p>
        <form onSubmit={handlePasswordUpdate} className="flex gap-2">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            className="flex-1 bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2 text-[#888] text-sm placeholder:text-[#3a3a3a] focus:outline-none focus:border-[#2a2a2a] font-light"
          />
          <button
            type="submit"
            className="bg-[#161616] border border-[#1a1a1a] text-[#666] text-sm px-4 rounded hover:border-[#2a2a2a] hover:text-[#888] transition-colors"
          >
            Update
          </button>
        </form>
        {passwordMsg && <p className="text-[#555] text-xs mt-1">{passwordMsg}</p>}
      </section>

      {/* Delete collection */}
      <section>
        <button
          onClick={handleDeleteCollection}
          className="text-red-500/50 text-xs hover:text-red-500/70 transition-colors"
        >
          Delete collection
        </button>
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/collections/[id]/
git commit -m "feat: add admin manage collection page with upload and delete"
```

---

## Task 23: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

- [ ] **Step 2: Import project in Vercel**

Go to vercel.com → New Project → Import from GitHub → select `photo-gallery`.

- [ ] **Step 3: Set environment variables in Vercel**

In Vercel project settings → Environment Variables, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

- [ ] **Step 4: Set Vercel project name**

In Vercel project settings → General → Project Name: set to `cmojiang` so the URL becomes `cmojiang.vercel.app`.

- [ ] **Step 5: Update Supabase OAuth redirect URLs**

In Supabase → Authentication → URL Configuration, add:
- Site URL: `https://cmojiang.vercel.app`
- Redirect URL: `https://cmojiang.vercel.app/admin/dashboard`

- [ ] **Step 6: Trigger deploy and verify**

```bash
git push
```

Open https://cmojiang.vercel.app — verify homepage loads, admin sign-in works, and a test collection can be created and unlocked.
