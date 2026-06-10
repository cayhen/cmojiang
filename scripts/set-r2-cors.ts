import 'dotenv/config';
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const origins = (
  process.env.CORS_ALLOWED_ORIGINS ??
  'https://www.cmojiang.com,https://cmojiang.com,http://localhost:3000'
)
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

async function main() {
  await r2.send(
    new PutBucketCorsCommand({
      Bucket: process.env.R2_BUCKET_NAME ?? 'cmojiang-photos',
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: ['GET', 'HEAD'],
            AllowedOrigins: origins,
            AllowedHeaders: ['*'],
            ExposeHeaders: ['Content-Length', 'Content-Type'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
  console.log('R2 CORS applied for origins:', origins);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
