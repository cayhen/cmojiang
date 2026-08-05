import { getUserSession } from '@/lib/session';
import { MobileNavClient } from './MobileNavClient';

// Mobile-only hamburger + slide-out drawer. Self-contained: reads the session
// (cookie + JWT, no DB) so it can be dropped into any visitor-facing page.
export async function MobileNav() {
  const session = await getUserSession();
  return <MobileNavClient username={session?.username ?? null} />;
}
