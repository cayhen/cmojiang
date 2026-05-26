import { redirect } from 'next/navigation';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { UserNav } from '@/components/UserNav';
import Link from 'next/link';

export const revalidate = 0;

export default async function ProfilePage() {
  const session = await getUserSession();
  if (!session) redirect('/login');

  const { data: rows } = await supabaseAdmin
    .from('user_collection_access')
    .select('accessed_at, collections(id, name, photos(count))')
    .eq('user_id', session.userId)
    .order('accessed_at', { ascending: false });

  const collections = (rows ?? []).map(r => {
    const c = r.collections as unknown as { id: string; name: string; photos: { count: number }[] } | null;
    return {
      id: c?.id ?? '',
      name: c?.name ?? '',
      photoCount: c?.photos?.[0]?.count ?? 0,
      accessedAt: r.accessed_at as string,
    };
  }).filter(c => c.id);

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
