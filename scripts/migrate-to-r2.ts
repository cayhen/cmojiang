/**
 * One-time migration: copy all photos from Supabase Storage → Cloudflare R2.
 * DB records are unchanged (storage_path keys are the same format in both).
 *
 * Run from the project root:
 *   npx ts-node -r dotenv/config --project tsconfig.json scripts/migrate-to-r2.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

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

async function existsInR2(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('Fetching all photos from DB...');
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, filename, storage_path');

  if (error) throw new Error(`DB error: ${error.message}`);
  if (!photos?.length) { console.log('No photos found.'); return; }

  console.log(`Found ${photos.length} photos. Starting migration...\n`);

  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (const photo of photos) {
    const key = photo.storage_path;
    process.stdout.write(`  ${key} ... `);

    // Skip if already in R2
    if (await existsInR2(key)) {
      console.log('already in R2, skipping');
      skipped++;
      continue;
    }

    // Download from Supabase Storage
    const { data, error: dlError } = await supabase.storage
      .from('photos')
      .download(key);

    if (dlError || !data) {
      console.log(`FAILED (download: ${dlError?.message ?? 'no data'})`);
      failed++;
      continue;
    }

    // Upload to R2
    const buffer = Buffer.from(await data.arrayBuffer());
    const ext = key.split('.').pop()?.toLowerCase() ?? 'jpg';
    const contentType =
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      'image/jpeg';

    try {
      await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));
      console.log(`✓ copied (${(buffer.length / 1024).toFixed(0)} KB)`);
      copied++;
    } catch (err) {
      console.log(`FAILED (upload: ${err instanceof Error ? err.message : String(err)})`);
      failed++;
    }
  }

  console.log(`\nDone. Copied: ${copied}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
