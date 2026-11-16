import { getUserSession } from '@/lib/session';
import { AccountMenuClient } from './AccountMenuClient';

// Reads the session cookie (JWT only, no DB) so any page can drop it in.
export async function AccountMenu() {
  const session = await getUserSession();
  return <AccountMenuClient username={session?.username ?? null} />;
}
