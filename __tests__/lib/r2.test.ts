process.env.R2_ACCOUNT_ID = 'acct';
process.env.R2_ACCESS_KEY_ID = 'akid';
process.env.R2_SECRET_ACCESS_KEY = 'secret';
process.env.R2_BUCKET_NAME = 'test-bucket';

import { signViewUrl, signDownloadUrl, PHOTO_URL_TTL } from '@/lib/r2';

describe('r2 presigning', () => {
  it('exposes a 24h default TTL', () => {
    expect(PHOTO_URL_TTL).toBe(86400);
  });

  it('signViewUrl returns a signed URL for the key with no content-disposition', async () => {
    const url = await signViewUrl('col1/photo1.jpg');
    // SDK uses virtual-hosted style: bucket in the host, key in the path.
    expect(url).toContain('test-bucket'); // bucket appears in the hostname
    expect(url).toContain('/col1/photo1.jpg'); // key path (style-agnostic)
    expect(url).toContain('X-Amz-Signature=');
    expect(url).not.toContain('response-content-disposition');
  });

  it('signDownloadUrl forces attachment with the filename', async () => {
    const url = await signDownloadUrl('col1/photo1.jpg', 'beach day.jpg');
    expect(url).toContain('X-Amz-Signature=');
    expect(decodeURIComponent(url)).toContain('attachment; filename="beach day.jpg"');
  });

  it('signDownloadUrl strips quotes/newlines from the filename', async () => {
    const url = await signDownloadUrl('col1/p.jpg', 'a"b\nc.jpg');
    expect(decodeURIComponent(url)).toContain('attachment; filename="a_b_c.jpg"');
  });
});
