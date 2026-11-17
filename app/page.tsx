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
      {/* No footer: the collections are the whole page. */}
      <div className={`${CONTAINER.index} pb-[max(64px,env(safe-area-inset-bottom))]`}>
        <CollectionList collections={collections} />
      </div>
    </main>
  );
}
