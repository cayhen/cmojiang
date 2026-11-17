import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { CONTAINER } from '@/components/container';
import { ChevronRightIcon, PhotoStackIcon, PlusIcon } from '@/components/icons';
import { supabaseAdmin } from '@/lib/supabase';
import { AmbientGlow } from '@/components/AmbientGlow';
import { glowPalette } from '@/lib/glow';

export const revalidate = 0;


export default async function AdminDashboard() {
  const { data: collections } = await supabaseAdmin
    .from('collections')
    // swatches: a dozen stored photo colors per collection for the page glow
    // (same single query; reduced to 4 hex values before rendering).
    .select('id, name, password_plain, is_private, created_at, photos(count), swatches:photos(dominant_color)')
    .not('swatches.dominant_color', 'is', null)
    .limit(12, { referencedTable: 'swatches' })
    .order('created_at', { ascending: false });

  const list = collections ?? [];
  const glow = glowPalette(
    list.flatMap(c => ((c as { swatches?: { dominant_color: string | null }[] }).swatches ?? []).map(s => s.dominant_color))
  );

  return (
    <main className="relative isolate min-h-screen bg-grouped pb-16">
      <AmbientGlow colors={glow} />
      <PageHeader
        title="Collections"
        subtitle={list.length ? `${list.length} collection${list.length === 1 ? '' : 's'}` : undefined}
        back={{ href: '/', label: 'Site' }}
        actions={
          <Link href="/admin/collections/new" className="btn btn-sm btn-filled">
            <PlusIcon size={16} />
            New
          </Link>
        }
      />

      <div className={CONTAINER.narrow}>
        {list.length > 0 ? (
          <div className="list">
            {list.map(c => {
              const count = (c.photos as { count: number }[])[0]?.count ?? 0;
              const isPrivate = (c as { is_private?: boolean }).is_private;
              const password = (c as { password_plain?: string }).password_plain;
              return (
                <Link key={c.id} href={`/admin/collections/${c.id}`} className="list-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-body text-label">{c.name}</span>
                      {isPrivate && (
                        <span className="shrink-0 rounded-full bg-fill px-2 py-0.5 text-caption text-label2">
                          Private
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-footnote text-label2">
                      {count} photo{count === 1 ? '' : 's'}
                      {password && ` · password: ${password}`}
                    </p>
                  </div>
                  <ChevronRightIcon size={18} className="shrink-0 text-label2" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-24 text-center">
            <PhotoStackIcon size={40} className="text-label2" />
            <p className="mt-3 text-headline text-label">No collections yet.</p>
            <p className="mt-1 text-footnote text-label2">Create one with New to start uploading photos.</p>
          </div>
        )}
      </div>
    </main>
  );
}
