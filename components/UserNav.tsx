import { getUserSession } from '@/lib/session';
import { UserNavClient } from './UserNavClient';

export async function UserNav() {
  const session = await getUserSession();
  return <UserNavClient username={session?.username ?? null} />;
}
