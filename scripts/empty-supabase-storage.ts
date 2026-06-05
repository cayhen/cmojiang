/**
 * Empties the Supabase Storage 'photos' bucket after verifying every DB photo
 * exists in R2. Safe to run after migrate-to-r2.ts has completed successfully.
 *
 * Run from the project root:
 *   npx ts-node --project tsconfig.json scripts/empty-supabase-storage.ts
 *
 * Add --force to actually delete (default is dry-run).
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import { createClient } from '@supabase/supabase-js';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

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
const FORCE = process.argv.includes('--force');
const SUPABASE_BUCKET = 'photos';

function thumbPath(storagePath: string): string {
  const slash = storagePath.indexOf('/');
  if (slash === -1) return storagePath;
  return `${storagePath.slice(0, slash)}/t/${storagePath.slice(slash + 1)}`;
}

async function existsInR2(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function listAllSupabaseFiles(): Promise<string[]> {
  const paths: string[] = [];

  // List top-level folders (collection IDs)
  const { data: folders, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .list('', { limit: 1000 });

  if (error) throw new Error(`Failed to list storage root: ${error.message}`);
  if (!folders?.length) return paths;

  for (const folder of folders) {
    if (folder.id) {
      // It's a file at the root (unlikely but handle it)
      paths.push(folder.name);
      continue;
    }

    // List files inside each folder (originals)
    const { data: originals } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list(folder.name, { limit: 1000 });

    for (const f of originals ?? []) {
      if (f.id) paths.push(`${folder.name}/${f.name}`);
    }

    // List files inside /t/ subfolder (thumbnails)
    const { data: thumbs } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list(`${folder.name}/t`, { limit: 1000 });

    for (const f of thumbs ?? []) {
      if (f.id) paths.push(`${folder.name}/t/${f.name}`);
    }
  }

  return paths;
}

async function main() {
  if (!FORCE) {
    console.log('DRY RUN — pass --force to actually delete\n');
  }

  // Step 1: Verify all DB photos exist in R2
  console.log('Step 1: Verifying all DB photos exist in R2...');
  const { data: photos, error: dbErr } = await supabase
    .from('photos')
    .select('id, storage_path');

  if (dbErr) throw new Error(`DB error: ${dbErr.message}`);
  if (!photos?.length) { console.log('No photos in DB.'); return; }

  let missingFromR2 = 0;
  for (const photo of photos) {
    const [origOk, thumbOk] = await Promise.all([
      existsInR2(photo.storage_path),
      existsInR2(thumbPath(photo.storage_path)),
    ]);
    if (!origOk || !thumbOk) {
      console.error(`  MISSING in R2: ${photo.storage_path} (orig=${origOk} thumb=${thumbOk})`);
      missingFromR2++;
    }
  }

  if (missingFromR2 > 0) {
    console.error(`\nAborted: ${missingFromR2} photos not yet in R2. Run migrate-to-r2.ts first.`);
    process.exit(1);
  }
  console.log(`  All ${photos.length} photos confirmed in R2.\n`);

  // Step 2: List everything in Supabase Storage and delete in batches
  console.log('Step 2: Listing Supabase Storage files...');
  const allFiles = await listAllSupabaseFiles();
  console.log(`  Found ${allFiles.length} files in Supabase Storage.\n`);

  if (!allFiles.length) {
    console.log('Supabase Storage is already empty.');
    return;
  }

  if (!FORCE) {
    console.log('Would delete:');
    allFiles.slice(0, 20).forEach(f => console.log(`  ${f}`));
    if (allFiles.length > 20) console.log(`  ... and ${allFiles.length - 20} more`);
    console.log('\nRe-run with --force to delete.');
    return;
  }

  // Delete in batches of 100 (Supabase limit)
  let deleted = 0;
  const BATCH = 100;
  for (let i = 0; i < allFiles.length; i += BATCH) {
    const batch = allFiles.slice(i, i + BATCH);
    const { error: delErr } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .remove(batch);

    if (delErr) {
      console.error(`  Batch ${i / BATCH + 1} failed: ${delErr.message}`);
    } else {
      deleted += batch.length;
      console.log(`  Deleted batch ${i / BATCH + 1} (${deleted}/${allFiles.length})`);
    }
  }

  console.log(`\nDone. Deleted ${deleted} files from Supabase Storage.`);
}

main().catch(err => { console.error(err); process.exit(1); });
