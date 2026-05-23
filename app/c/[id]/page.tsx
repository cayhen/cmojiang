import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { UnlockForm } from '@/components/UnlockForm';

export const revalidate = 0;

export default async function UnlockPage({ params }: { params: { id: string } }) {
  const { data: collection } = await supabaseAdmin
    .from('collections')
    .select('id, name')
    .eq('id', params.id)
    .single();

  if (!collection) notFound();

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <h1 className="text-[#888] font-light text-lg text-center mb-8">
          {collection.name}
        </h1>
        <UnlockForm collectionId={collection.id} />
      </div>
    </main>
  );
}
