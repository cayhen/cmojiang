import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import path from 'path';
import { getUploadUrl } from '@/lib/r2';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { files } = await req.json() as { files: { filename: string }[] };

  if (!files?.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const results = await Promise.all(
    files.map(async ({ filename }) => {
      try {
        const photoId = randomUUID();
        const ext = path.extname(filename).toLowerCase() || '.jpg';
        const storagePath = `${params.id}/${photoId}${ext}`;
        const contentType = CONTENT_TYPES[ext] ?? 'image/jpeg';
        const signedUrl = await getUploadUrl(storagePath, contentType);
        return { filename, storagePath, signedUrl };
      } catch (err) {
        return { filename, error: err instanceof Error ? err.message : String(err) };
      }
    })
  );

  return NextResponse.json(results);
}
