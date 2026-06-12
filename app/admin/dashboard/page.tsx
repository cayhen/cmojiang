import Link from 'next/link';
import { HomeLink } from '@/components/HomeLink';
import { supabaseAdmin } from '@/lib/supabase';

export const revalidate = 0;

export default async function AdminDashboard() {
  const { data: collections } = await supabaseAdmin
    .from('collections')
    .select('id, name, password_plain, is_private, created_at, photos(count)')
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen p-10 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <HomeLink />
          <p className="text-[#666] text-xs tracking-widest uppercase font-light">Collections</p>
        </div>
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
              <div className="flex items-center gap-2">
                <p className="text-[#bbb] text-sm font-light">{c.name}</p>
                {(c as { is_private?: boolean }).is_private && (
                  <span className="text-[10px] text-[#555] border border-[#2a2a2a] rounded px-1 py-px leading-none tracking-wide uppercase">private</span>
                )}
              </div>
              <p className="text-[#666] text-xs">
                {(c.photos as { count: number }[])[0]?.count ?? 0} photos
                {(c as { password_plain?: string }).password_plain && (
                  <span className="ml-2 text-[#555]">· {(c as { password_plain: string }).password_plain}</span>
                )}
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
