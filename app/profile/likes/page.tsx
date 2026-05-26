import { redirect } from 'next/navigation';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { publicPhotoUrl, thumbPath } from '@/lib/r2';
import { UserNav } from '@/components/UserNav';
import { LikedPhotosClient, type LikedPhoto, type LikedSection } from '@/components/LikedPhotosClient';
import Link from 'next/link';

export const revalidate = 0;

export default async function LikedPhotosPage() {
  const session = await getUserSession();
  if (!session) redirect('/login');

  const { data: likes } = await supabaseAdmin
    .from('photo_likes')
    .select('created_at, photos(id, filename, storage_path, width, height, dominant_color, collection_id)')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false });

  // Build photo list with URLs
  const photos: LikedPhoto[] = (likes ?? [])
    .map(l => {
      const p = l.photos as unknown as {
        id: string; filename: string; storage_path: string; collection_id: string;
        width: number | null; height: number | null; dominant_color: string | null;
      } | null;
      if (!p) return null;
      const hasThumb = p.width != null;
      const originalUrl = publicPhotoUrl(p.storage_path);
      return {
        id: p.id,
        filename: p.filename,
        url: hasThumb ? publicPhotoUrl(thumbPath(p.storage_path)) : originalUrl,
        originalUrl,
        width: p.width ?? undefined,
        height: p.height ?? undefined,
        dominantColor: p.dominant_color ?? undefined,
        collectionId: p.collection_id,
      };
    })
    .filter(Boolean) as LikedPhoto[];

  // Get collection names for all referenced collections
  const collectionIds = Array.from(new Set(photos.map(p => p.collectionId)));
  const { data: collectionsData } = collectionIds.length > 0
    ? await supabaseAdmin.from('collections').select('id, name').in('id', collectionIds)
    : { data: [] };

  const collectionNames = new Map((collectionsData ?? []).map(c => [c.id, c.name]));

  // Group photos by collection, preserving the order collections first appear
  const sections: LikedSection[] = [];
  const seen = new Map<string, number>();

  for (const photo of photos) {
    if (!seen.has(photo.collectionId)) {
      seen.set(photo.collectionId, sections.length);
      sections.push({
        collectionId: photo.collectionId,
        name: collectionNames.get(photo.collectionId) ?? 'Unknown',
        photos: [],
      });
    }
    sections[seen.get(photo.collectionId)!].photos.push(photo);
  }

  return (
    <main className="min-h-screen p-6">
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="text-[#666] text-xs hover:text-[#777] transition-colors">← Back</Link>
          <span className="text-[#bbb] text-sm font-light">Liked photos</span>
        </div>
        <UserNav />
      </div>

      <LikedPhotosClient initialSections={sections} />
    </main>
  );
}
