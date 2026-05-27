/**
 * For photos that still have no thumbnail after backfill-thumbnails.ts —
 * i.e. they exist in DB but are missing from R2. Tries Supabase Storage as
 * a fallback, re-uploads the original to R2, generates a thumbnail, and
 * updates the DB record.
 *
 * Run after backfill-thumbnails.ts:
 *   npx ts-node --project tsconfig.json scripts/rescue-missing-photos.ts
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

function thumbPath(storagePath: string): string {
  const slash = storagePath.indexOf('/');
  if (slash === -1) return storagePath;
  return `${storagePath.slice(0, slash)}/t/${storagePath.slice(slash + 1)}`;
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

async function uploadToR2(key: string, body: Buffer, contentType: string) {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

async function main() {
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, storage_path')
    .is('width', null);

  if (error) throw new Error(`DB error: ${error.message}`);
  if (!photos?.length) { console.log('No missing photos — all thumbnails present.'); return; }

  console.log(`Found ${photos.length} photos still missing thumbnails.\n`);

  let rescued = 0, missing = 0;

  for (const photo of photos) {
    process.stdout.write(`  ${photo.storage_path} ... `);

    const { data: blob, error: dlError } = await supabase.storage
      .from('photos')
      .download(photo.storage_path);

    if (dlError || !blob) {
      console.log(`NOT FOUND in Supabase Storage — truly missing`);
      missing++;
      continue;
    }

    try {
      const original = Buffer.from(await blob.arrayBuffer());

      const ext = photo.storage_path.split('.').pop()?.toLowerCase() ?? 'jpg';
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      const rotated = await sharp(original).rotate().toBuffer();

      const meta = await sharp(rotated).metadata();
      const scale = Math.min(1, 600 / meta.width!);
      const thumbW = Math.round(meta.width! * scale);
      const thumbH = Math.round(meta.height! * scale);

      const [thumbBuffer, color] = await Promise.all([
        sharp(rotated).resize(thumbW, thumbH).jpeg({ quality: 80 }).toBuffer(),
        dominantColor(rotated),
      ]);

      await Promise.all([
        uploadToR2(photo.storage_path, original, contentType),
        uploadToR2(thumbPath(photo.storage_path), thumbBuffer, 'image/jpeg'),
      ]);

      const { error: updateErr } = await supabase
        .from('photos')
        .update({ width: thumbW, height: thumbH, dominant_color: color })
        .eq('id', photo.id);

      if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

      console.log(`✓ rescued  ${thumbW}×${thumbH}  ${color}`);
      rescued++;
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
      missing++;
    }
  }

  console.log(`\nDone. Rescued: ${rescued}  Truly missing: ${missing}`);
}

main().catch(err => { console.error(err); process.exit(1); });
