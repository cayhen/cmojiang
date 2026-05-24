import { supabaseAdmin } from '@/lib/supabase';
import { SearchBar } from '@/components/SearchBar';
import { UserNav } from '@/components/UserNav';

export const revalidate = 0;

export default async function HomePage() {
  const { data } = await supabaseAdmin
    .from('collections')
    .select('id, name, photos(count)')
    .order('created_at', { ascending: false });

  const collections = (data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    photo_count: Array.isArray(c.photos) && typeof (c.photos[0] as { count?: number })?.count === 'number'
      ? (c.photos[0] as { count: number }).count
      : 0,
  }));

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <header className="mb-8">
        <div className="flex justify-between items-center">
          <p className="text-[#3a3a3a] text-xs tracking-widest uppercase font-light">Caden Jiang — Photos</p>
          <UserNav />
        </div>
      </header>
      <SearchBar collections={collections} />
    </main>
  );
}
