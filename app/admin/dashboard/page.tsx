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
        <p className="text-[#666] text-xs tracking-widest uppercase font-light">Collections</p>
        <Link
          href="/admin/collections/new"
          className="text-[#888] text-xs hover:text-[#bbb] transition-colors"
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
              <p className="text-[#bbb] text-sm font-light">{c.name}</p>
              <p className="text-[#666] text-xs">
                {(c.photos as { count: number }[])[0]?.count ?? 0} photos
              </p>
            </div>
            <Link
              href={`/admin/collections/${c.id}`}
              className="text-[#666] text-xs hover:text-[#888] transition-colors"
            >
              Manage →
            </Link>
          </div>
        ))}
        {!collections?.length && (
          <p className="text-[#666] text-sm">No collections yet.</p>
        )}
      </div>
    </main>
  );
}
