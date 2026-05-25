// One-time migration: copy all photos from Supabase Storage → Cloudflare R2
// Run from project root: node scripts/migrate-to-r2.js

const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  if (!process.env[key]) process.env[key] = val;
}

const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME ?? 'cmojiang-photos';

async function existsInR2(key) {
  try { await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true; }
  catch { return false; }
}

async function main() {
  console.log('Fetching photos from DB...');
  const { data: photos, error } = await supabase.from('photos').select('id, filename, storage_path');
  if (error) throw new Error('DB error: ' + error.message);
  if (!photos?.length) { console.log('No photos found.'); return; }
  console.log(`Found ${photos.length} photo(s). Starting migration...\n`);

  let copied = 0, skipped = 0, failed = 0;

  for (const photo of photos) {
    const key = photo.storage_path;
    process.stdout.write(`  ${key} ... `);

    if (await existsInR2(key)) {
      console.log('already in R2, skipping');
      skipped++;
      continue;
    }

    const { data, error: dlError } = await supabase.storage.from('photos').download(key);
    if (dlError || !data) {
      console.log(`FAILED (download: ${dlError?.message ?? 'no data'})`);
      failed++;
      continue;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const ext = key.split('.').pop()?.toLowerCase() ?? 'jpg';
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    try {
      await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
      console.log(`✓ copied (${(buffer.length / 1024).toFixed(0)} KB)`);
      copied++;
    } catch (err) {
      console.log(`FAILED (upload: ${err.message})`);
      failed++;
    }
  }

  console.log(`\nDone. Copied: ${copied}  Skipped: ${skipped}  Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
