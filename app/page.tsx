import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { SearchBar } from '@/components/SearchBar';
import { UserNav } from '@/components/UserNav';
import { LogoTitle } from '@/components/LogoTitle';

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
    <main className="p-10 max-w-4xl mx-auto">
        <header className="flex items-baseline justify-between">
          <LogoTitle />
          <UserNav />
        </header>
        <SearchBar collections={collections} />
        <footer className="mt-16 text-center">
          <Link href="/admin" className="text-[#2a2a2a] text-xs hover:text-[#555] transition-colors">admin</Link>
        </footer>
      </main>
  );
}
// hello from eric kim