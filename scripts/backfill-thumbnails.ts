/**
 * Backfill thumbnails for photos that were uploaded or migrated without one.
 * Fetches originals from R2, generates a 600px-wide JPEG thumbnail, uploads
 * it to the /t/ prefix, then updates width/height/dominant_color in the DB.
 *
 * Run from the project root:
 *   npx ts-node --project tsconfig.json scripts/backfill-thumbnails.ts
 *
 * Re-process all photos (e.g. to fix EXIF rotation):
 *   npx ts-node --project tsconfig.json scripts/backfill-thumbnails.ts --all
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? 'cmojiang-photos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? 'https://photos.cmojiang.com';
const forceAll = process.argv.includes('--all');

function thumbPath(storagePath: string): string {
  const slash = storagePath.indexOf('/');
  if (slash === -1) return storagePath;
  return `${storagePath.slice(0, slash)}/t/${storagePath.slice(slash + 1)}`;
}

async function downloadFromR2(key: string): Promise<Buffer> {
  const res = await fetch(`${R2_PUBLIC_URL}/${key}`);
  if (!res.ok) throw new Error(`R2 download failed (${res.status}): ${key}`);
  return Buffer.from(await res.arrayBuffer());
}

async function dominantColor(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer)
    .resize(5, 5, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 3) {
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  const n = data.length / 3;
  return `#${Math.round(r / n).toString(16).padStart(2, '0')}${Math.round(g / n).toString(16).padStart(2, '0')}${Math.round(b / n).toString(16).padStart(2, '0')}`;
}

async function main() {
  let query = supabase.from('photos').select('id, storage_path');
  if (!forceAll) query = query.is('width', null);

  const { data: photos, error } = await query;

  if (error) throw new Error(`DB error: ${error.message}`);
  if (!photos?.length) { console.log('No photos to process.'); return; }

  console.log(`Found ${photos.length} photos to process${forceAll ? ' (--all mode)' : ''}.\n`);

  let done = 0, failed = 0;

  for (const photo of photos) {
    process.stdout.write(`  ${photo.storage_path} ... `);

    try {
      const original = await downloadFromR2(photo.storage_path);

      // Rotate based on EXIF orientation before measuring or resizing
      const rotated = await sharp(original).rotate().toBuffer();

      const meta = await sharp(rotated).metadata();
      const scale = Math.min(1, 600 / meta.width!);
      const thumbW = Math.round(meta.width! * scale);
      const thumbH = Math.round(meta.height! * scale);

      const [thumbBuffer, color] = await Promise.all([
        sharp(rotated).resize(thumbW, thumbH).jpeg({ quality: 80 }).toBuffer(),
        dominantColor(rotated),
      ]);

      await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: thumbPath(photo.storage_path),
        Body: thumbBuffer,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      }));

      const { error: updateErr } = await supabase
        .from('photos')
        .update({ width: thumbW, height: thumbH, dominant_color: color })
        .eq('id', photo.id);

      if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

      console.log(`✓  ${thumbW}×${thumbH}  ${(thumbBuffer.length / 1024).toFixed(0)}KB  ${color}`);
      done++;
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log(`\nDone. Generated: ${done}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
