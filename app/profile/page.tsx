import { redirect } from 'next/navigation';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { SignOutButton } from '@/components/SignOutButton';
import Link from 'next/link';
import { HomeLink } from '@/components/HomeLink';
import { MobileNav } from '@/components/MobileNav';

export const revalidate = 0;

export default async function ProfilePage() {
  const session = await getUserSession();
  if (!session) redirect('/login');

  // Step 1: get which collections the user has unlocked + when
  const { data: accessRows } = await supabaseAdmin
    .from('user_collection_access')
    .select('collection_id, accessed_at')
    .eq('user_id', session.userId)
    .order('accessed_at', { ascending: false });

  const collectionIds = (accessRows ?? []).map(r => r.collection_id as string);

  // Step 2: get collection names + photo counts (same pattern as home page)
  const { data: collectionsData } = collectionIds.length > 0
    ? await supabaseAdmin
        .from('collections')
        .select('id, name, photos(count)')
        .in('id', collectionIds)
    : { data: [] };

  // Merge and preserve the accessed_at sort order
  const collectionMap = new Map((collectionsData ?? []).map(c => [
    c.id,
    {
      name: c.name,
      photoCount: Array.isArray(c.photos) && typeof (c.photos[0] as { count?: number })?.count === 'number'
        ? (c.photos[0] as { count: number }).count
        : 0,
    },
  ]));

  const collections = collectionIds
    .map(id => ({ id, ...collectionMap.get(id) }))
    .filter(c => c.name) as { id: string; name: string; photoCount: number }[];

  return (
    <main className="min-h-screen px-5 py-8 sm:p-10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8 sm:mb-10">
        <div className="flex items-center gap-4">
          <div className="md:hidden"><MobileNav /></div>
          <div className="hidden md:block"><HomeLink /></div>
          <span className="text-[#bbb] text-sm font-light">{session.username}</span>
        </div>
        <div className="hidden md:block"><SignOutButton /></div>
      </div>

      <Link
        href="/profile/likes"
        className="flex items-center justify-between py-3 mb-8 border border-[#1e1e1e] hover:border-[#2a2a2a] rounded px-4 transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff4d6d" aria-hidden>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span className="text-[#bbb] text-sm font-light group-hover:text-white transition-colors">Liked Photos</span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#444] group-hover:text-[#777] transition-colors" aria-hidden>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>

      <p className="text-[#555] text-xs uppercase tracking-widest mb-4">Unlocked Collections</p>

      {collections.length === 0 ? (
        <p className="text-[#444] text-sm font-light">No collections unlocked yet.</p>
      ) : (
        <div className="space-y-px">
          {collections.map(c => (
            <Link
              key={c.id}
              href={`/c/${c.id}/gallery`}
              className="flex items-center justify-between py-3 border-b border-[#1a1a1a] hover:border-[#2a2a2a] transition-colors group"
            >
              <span className="text-[#bbb] text-sm font-light group-hover:text-white transition-colors">
                {c.name}
              </span>
              <span className="text-[#444] text-xs">
                {c.photoCount} {c.photoCount === 1 ? 'photo' : 'photos'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
