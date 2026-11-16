import { redirect } from 'next/navigation';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { SignOutButton } from '@/components/SignOutButton';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { CONTAINER } from '@/components/container';
import { ChevronRightIcon, HeartIcon } from '@/components/icons';

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
    <main className="min-h-screen bg-grouped pb-16">
      <PageHeader title={session.username} back={{ href: '/', label: 'Collections' }} />
      <div className={`${CONTAINER.narrow} space-y-8`}>
        <div className="list">
          <Link href="/profile/likes" className="list-row group">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-heart text-white">
              <HeartIcon size={17} filled />
            </span>
            <span className="flex-1">Liked Photos</span>
            <ChevronRightIcon size={15} className="text-label2 opacity-60" />
          </Link>
        </div>

        <section>
          <h2 className="list-header">Unlocked collections</h2>
          {collections.length === 0 ? (
            <div className="list px-4 py-8 text-center text-subhead text-label2">
              Collections you open while signed in appear here, so you can come back without the password.
            </div>
          ) : (
            <div className="list">
              {collections.map(c => (
                <Link key={c.id} href={`/c/${c.id}/gallery`} className="list-row">
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-subhead tabular-nums text-label2">
                    {c.photoCount} {c.photoCount === 1 ? 'photo' : 'photos'}
                  </span>
                  <ChevronRightIcon size={15} className="text-label2 opacity-60" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="list">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
