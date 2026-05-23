import { supabaseAdmin } from '@/lib/supabase';
import { SearchBar } from '@/components/SearchBar';

export const revalidate = 0;

export default async function HomePage() {
  const { data } = await supabaseAdmin
    .from('collections')
    .select('id, name, photos(count)')
    .order('created_at', { ascending: false });

  const collections = (data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    photo_count: (c.photos as { count: number }[])[0]?.count ?? 0,
  }));

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <header className="mb-8">
        <p className="text-[#3a3a3a] text-xs tracking-widest uppercase font-light">
          Caden Jiang — Photos
        </p>
      </header>
      <SearchBar collections={collections} />
    </main>
  );
}
