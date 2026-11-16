import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { CollectionList } from '@/components/CollectionList';
import { AccountMenu } from '@/components/AccountMenu';
import { PageHeader } from '@/components/PageHeader';
import { CONTAINER } from '@/components/container';
import { glowPalette } from '@/lib/glow';

export const revalidate = 0;

export default async function HomePage() {
  const { data } = await supabaseAdmin
    .from('collections')
    // swatches: a couple dozen stored photo colors per collection for the ambient
    // glow (same single query; reduced to 4 hex values each before rendering).
    .select('id, name, event_date, photos(count), swatches:photos(dominant_color)')
    .eq('is_private', false)
    .not('swatches.dominant_color', 'is', null)
    .limit(24, { referencedTable: 'swatches' })
    .order('event_date', { ascending: false, nullsFirst: false });

  const collections = (data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    event_date: (c as unknown as { event_date?: string | null }).event_date ?? null,
    photo_count: Array.isArray(c.photos) && typeof (c.photos[0] as { count?: number })?.count === 'number'
      ? (c.photos[0] as { count: number }).count
      : 0,
    glow: glowPalette(
      ((c as unknown as { swatches?: { dominant_color: string | null }[] }).swatches ?? []).map(s => s.dominant_color)
    ),
  }));

  return (
    <main className="relative isolate min-h-screen bg-grouped lg:bg-bg">
      <PageHeader width="index" title="cmojiang" actions={<AccountMenu />} />
      <div className={CONTAINER.index}>
        <CollectionList collections={collections} />
      </div>
      <footer
        className={`${CONTAINER.index} pb-[max(32px,env(safe-area-inset-bottom))] pt-16 text-center text-footnote text-label2 lg:flex lg:items-baseline lg:justify-between lg:pt-20 lg:text-left`}
      >
        <p>Human Biology at Stanford, Class of 2028</p>
        <p className="mt-1 flex items-center justify-center gap-3 lg:mt-0">
          <a href="https://instagram.com/caden.jiang" target="_blank" rel="noopener noreferrer" className="text-tint hover:opacity-70">
            Instagram
          </a>
          <span aria-hidden>·</span>
          <a href="mailto:cadenjiang777@gmail.com" className="text-tint hover:opacity-70">Email</a>
          <span aria-hidden className="hidden lg:inline">·</span>
          <Link href="/admin" className="hidden opacity-40 transition-opacity hover:opacity-100 lg:inline">Admin</Link>
        </p>
        <Link href="/admin" className="mt-6 inline-block opacity-40 transition-opacity hover:opacity-100 lg:hidden">Admin</Link>
      </footer>
    </main>
  );
}
