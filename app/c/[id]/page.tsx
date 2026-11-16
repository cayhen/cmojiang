import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { UnlockForm } from '@/components/UnlockForm';
import { verifyUserToken } from '@/lib/auth';
import { USER_COOKIE_NAME } from '@/lib/session';
import { TopBar } from '@/components/PageHeader';

export const revalidate = 0;

export default async function UnlockPage({ params }: { params: { id: string } }) {
  const { data: collection } = await supabaseAdmin
    .from('collections')
    .select('id, name')
    .eq('id', params.id)
    .single();

  if (!collection) notFound();

  // Check if logged-in user already has access
  const cookieStore = cookies();
  const userToken = cookieStore.get(USER_COOKIE_NAME)?.value;
  if (userToken) {
    const userSession = await verifyUserToken(userToken);
    if (userSession) {
      const { data: access } = await supabaseAdmin
        .from('user_collection_access')
        .select('user_id')
        .eq('user_id', userSession.userId)
        .eq('collection_id', params.id)
        .single();
      if (access) redirect(`/api/gallery-access?id=${params.id}`);
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-grouped">
      <TopBar back={{ href: '/', label: 'Collections' }} />
      <div className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="animate-rise w-full max-w-sm">
          <UnlockForm collectionId={collection.id} name={collection.name} />
        </div>
      </div>
    </main>
  );
}
