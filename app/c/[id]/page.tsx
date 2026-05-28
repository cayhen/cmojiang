import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { UnlockForm } from '@/components/UnlockForm';
import { verifyUserToken } from '@/lib/auth';
import { USER_COOKIE_NAME } from '@/lib/session';
import { HomeLink } from '@/components/HomeLink';
import { AnimatedText } from '@/components/ui/animated-underline-text';

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
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <div className="mb-8"><HomeLink /></div>
        <AnimatedText
          text={collection.name}
          textClassName="text-lg"
          underlineClassName="text-[#3a3a3a]"
          className="mb-8"
        />
        <UnlockForm collectionId={collection.id} />
      </div>
    </main>
  );
}
