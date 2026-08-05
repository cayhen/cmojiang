import { redirect } from 'next/navigation';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { signViewUrl, signDownloadUrl, thumbPath } from '@/lib/r2';
import { UserNav } from '@/components/UserNav';
import { LikedPhotosClient, type LikedPhoto, type LikedSection } from '@/components/LikedPhotosClient';
import { MobileNav } from '@/components/MobileNav';
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

  // Build photo list with presigned URLs
  const photoRows = (likes ?? [])
    .map(l => l.photos as unknown as {
      id: string; filename: string; storage_path: string; collection_id: string;
      width: number | null; height: number | null; dominant_color: string | null;
    } | null)
    .filter((p): p is NonNullable<typeof p> => p != null);

  let photos: LikedPhoto[] = [];
  let signingError = false;
  try {
    photos = await Promise.all(
      photoRows.map(async p => {
        const hasThumb = p.width != null;
        const [originalUrl, thumbUrl, downloadUrl] = await Promise.all([
          signViewUrl(p.storage_path),
          hasThumb ? signViewUrl(thumbPath(p.storage_path)) : Promise.resolve(null),
          signDownloadUrl(p.storage_path, p.filename),
        ]);
        return {
          id: p.id,
          filename: p.filename,
          url: thumbUrl ?? originalUrl,
          originalUrl,
          downloadUrl,
          width: p.width ?? undefined,
          height: p.height ?? undefined,
          dominantColor: p.dominant_color ?? undefined,
          collectionId: p.collection_id,
        };
      })
    );
  } catch {
    signingError = true;
  }

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
    <main className="min-h-screen p-4 sm:p-6">
      <div className="flex justify-between items-center mb-8 sm:mb-10">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="md:hidden"><MobileNav /></div>
          <Link href="/profile" className="hidden md:inline text-[#666] text-xs hover:text-[#777] transition-colors">← Back</Link>
          <span className="text-[#bbb] text-sm font-light">Liked photos</span>
        </div>
        <div className="hidden md:block"><UserNav /></div>
      </div>

      {signingError ? (
        <p className="text-[#666] text-sm">Photos are temporarily unavailable. Please try again in a moment.</p>
      ) : (
        <LikedPhotosClient initialSections={sections} />
      )}
    </main>
  );
}
