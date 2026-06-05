import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('collections')
    .select('id, name, photos(count)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }

  const collections = (data ?? []).map(c => ({
    id: c.id,
    name: c.name,
    photo_count: (c.photos as { count: number }[])[0]?.count ?? 0,
  }));

  return NextResponse.json(collections);
}
