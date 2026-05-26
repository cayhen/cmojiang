import { redirect } from 'next/navigation';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { UserNav } from '@/components/UserNav';
import Link from 'next/link';

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
    <main className="min-h-screen p-6 max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[#666] text-xs hover:text-[#777] transition-colors">← All</Link>
          <span className="text-[#bbb] text-sm font-light">{session.username}</span>
        </div>
        <UserNav />
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-[#555] text-xs uppercase tracking-widest">Unlocked Collections</p>
        <Link href="/profile/likes" className="text-[#555] text-xs hover:text-[#777] transition-colors">
          ♥ Liked photos
        </Link>
      </div>

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
