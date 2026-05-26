import { redirect } from 'next/navigation';
import { getUserSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';
import { publicPhotoUrl, thumbPath } from '@/lib/r2';
import { UserNav } from '@/components/UserNav';
import { MasonryGrid } from '@/components/MasonryGrid';
import Link from 'next/link';

export const revalidate = 0;

export default async function LikedPhotosPage() {
  const session = await getUserSession();
  if (!session) redirect('/login');

  const { data: likes } = await supabaseAdmin
    .from('photo_likes')
    .select('photos(id, filename, storage_path, width, height, dominant_color)')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false });

  const photos = (likes ?? [])
    .map(l => {
      const p = l.photos as unknown as {
        id: string; filename: string; storage_path: string;
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
      };
    })
    .filter(Boolean) as {
      id: string; filename: string; url: string; originalUrl: string;
      width?: number; height?: number; dominantColor?: string;
    }[];

  return (
    <main className="min-h-screen p-6">
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="text-[#666] text-xs hover:text-[#777] transition-colors">← Back</Link>
          <span className="text-[#bbb] text-sm font-light">Liked photos</span>
        </div>
        <UserNav />
      </div>

      {photos.length === 0 ? (
        <p className="text-[#444] text-sm font-light">No liked photos yet. Double-tap any photo to like it.</p>
      ) : (
        <MasonryGrid photos={photos} />
      )}
    </main>
  );
}
