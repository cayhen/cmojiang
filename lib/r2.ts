import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? 'placeholder';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? 'placeholder';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? 'placeholder';
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? 'cmojiang-photos';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? '';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/** Generate a presigned URL for a direct browser PUT upload (expires 1 hour) */
export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, command, { expiresIn: 3600 });
}

/**
 * Return a stable public URL for a photo stored in R2.
 * Requires the bucket to have public access enabled and R2_PUBLIC_URL set.
 */
export function publicPhotoUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

/** Generate a presigned URL for viewing/downloading a photo (expires given seconds) */
export async function getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(r2, command, { expiresIn });
}

/** Delete a single object from R2 */
export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

/**
 * Derive the thumbnail storage path from an original storage path.
 * Original:  "{collectionId}/{photoId}.jpg"
 * Thumbnail: "{collectionId}/t/{photoId}.jpg"
 */
export function thumbPath(storagePath: string): string {
  const slash = storagePath.indexOf('/');
  if (slash === -1) return storagePath;
  return `${storagePath.slice(0, slash)}/t/${storagePath.slice(slash + 1)}`;
}

/** Delete multiple objects from R2 in one request */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (!keys.length) return;
  await r2.send(
    new DeleteObjectsCommand({
      Bucket: R2_BUCKET_NAME,
      Delete: { Objects: keys.map(Key => ({ Key })) },
    })
  );
}
