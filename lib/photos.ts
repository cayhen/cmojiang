import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';

export type PhotoRow = {
  id: string;
  filename: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  dominant_color: string | null;
  uploaded_at: string;
  taken_at: string | null;
};

const COLUMNS = 'id, filename, storage_path, width, height, dominant_color, uploaded_at, taken_at';
// Selecting a column Supabase doesn't know errors the whole query, so galleries
// keep working if the taken_at migration hasn't been run yet.
const LEGACY_COLUMNS = 'id, filename, storage_path, width, height, dominant_color, uploaded_at';

/**
 * All photos in a collection, ordered by when they were shot (EXIF capture
 * time, falling back to upload time for photos without it) — earliest first,
 * so a gallery reads chronologically top to bottom.
 */
export async function fetchPhotosChronological(collectionId: string): Promise<PhotoRow[]> {
  const first = await supabaseAdmin
    .from('photos')
    .select(COLUMNS)
    .eq('collection_id', collectionId)
    .order('uploaded_at', { ascending: true });

  let data: unknown[] = first.data ?? [];
  if (first.error) {
    const legacy = await supabaseAdmin
      .from('photos')
      .select(LEGACY_COLUMNS)
      .eq('collection_id', collectionId)
      .order('uploaded_at', { ascending: true });
    data = legacy.data ?? [];
  }

  const rows = data as PhotoRow[];
  // Tiebreak on id: bulk uploads share identical uploaded_at timestamps, and a
  // non-deterministic order re-shuffles the gallery on every render (which also
  // breaks React hydration).
  return rows.sort((a, b) => {
    const diff =
      new Date(a.taken_at ?? a.uploaded_at).getTime() -
      new Date(b.taken_at ?? b.uploaded_at).getTime();
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}
