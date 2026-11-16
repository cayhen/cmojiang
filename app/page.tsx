import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { CollectionList } from '@/components/CollectionList';
import { AccountMenu } from '@/components/AccountMenu';
import { PageHeader } from '@/components/PageHeader';
import { CONTAINER } from '@/components/container';

export const revalidate = 0;

export default async function HomePage() {
  const { data } = await supabaseAdmin
    .from('collections')
    .select('id, name, event_date, photos(count)')
    .eq('is_private', false)
    .order('event_date', { ascending: false, nullsFirst: false });

  const collections = (data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    event_date: (c as unknown as { event_date?: string | null }).event_date ?? null,
    photo_count: Array.isArray(c.photos) && typeof (c.photos[0] as { count?: number })?.count === 'number'
      ? (c.photos[0] as { count: number }).count
      : 0,
  }));

  return (
    <main className="min-h-screen bg-grouped">
      <PageHeader title="cmojiang" subtitle="Photos by Caden Jiang" actions={<AccountMenu />} />
      <div className={CONTAINER.narrow}>
        <CollectionList collections={collections} />
      </div>
      <footer className={`${CONTAINER.narrow} pb-[max(32px,env(safe-area-inset-bottom))] pt-16 text-center text-footnote text-label2`}>
        <p>Human Biology at Stanford, Class of 2028</p>
        <p className="mt-1 flex items-center justify-center gap-3">
          <a href="https://instagram.com/caden.jiang" target="_blank" rel="noopener noreferrer" className="text-tint hover:opacity-70">
            Instagram
          </a>
          <span aria-hidden>·</span>
          <a href="mailto:cadenjiang777@gmail.com" className="text-tint hover:opacity-70">Email</a>
        </p>
        <Link href="/admin" className="mt-6 inline-block opacity-40 transition-opacity hover:opacity-100">Admin</Link>
      </footer>
    </main>
  );
}
