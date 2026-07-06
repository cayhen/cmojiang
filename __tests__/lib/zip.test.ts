import { downloadPhotosAsZip, type ZipPhoto } from '@/lib/zip';

// jszip is browser-oriented (Node's Blob isn't accepted); mock it so the tests
// exercise our orchestration — queueing, failure counting, abort, download.
const zippedFiles: string[] = [];
jest.mock('jszip', () => ({
  __esModule: true,
  default: class {
    file(name: string) { zippedFiles.push(name); }
    async generateAsync() { return 'zip-blob'; }
  },
}));

// lib/zip.ts runs in the browser; stub the DOM pieces it touches.
const clicks: string[] = [];

beforeAll(() => {
  (global as unknown as { document: unknown }).document = {
    createElement: () => ({
      href: '',
      download: '',
      click(this: { download: string }) { clicks.push(this.download); },
    }),
  };
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = jest.fn(() => 'blob:mock');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = jest.fn();
});

beforeEach(() => {
  clicks.length = 0;
  zippedFiles.length = 0;
});

function photos(n: number): ZipPhoto[] {
  return Array.from({ length: n }, (_, i) => ({
    filename: `photo-${i}.jpg`,
    downloadUrl: `https://r2.example/photo-${i}.jpg`,
  }));
}

function okResponse() {
  return { ok: true, blob: async () => 'blob-data' };
}

describe('downloadPhotosAsZip', () => {
  it('zips every photo, reports 0 failures, and triggers the download', async () => {
    global.fetch = jest.fn(async () => okResponse()) as unknown as typeof fetch;
    const progress: number[] = [];

    const failed = await downloadPhotosAsZip(
      photos(4), 'trip', new AbortController().signal, f => progress.push(f)
    );

    expect(failed).toBe(0);
    expect(clicks).toEqual(['trip.zip']);
    expect(zippedFiles.sort()).toEqual(['photo-0.jpg', 'photo-1.jpg', 'photo-2.jpg', 'photo-3.jpg']);
    expect(progress[progress.length - 1]).toBe(1);
  });

  it('counts failed fetches but still downloads a partial zip', async () => {
    let i = 0;
    global.fetch = jest.fn(async () => {
      // Fail every other photo: one HTTP error, one network error
      i++;
      if (i % 4 === 2) return { ok: false };
      if (i % 4 === 0) throw new Error('network');
      return okResponse();
    }) as unknown as typeof fetch;

    const failed = await downloadPhotosAsZip(
      photos(8), 'trip', new AbortController().signal, () => {}
    );

    expect(failed).toBe(4);
    expect(zippedFiles).toHaveLength(4);
    expect(clicks).toEqual(['trip.zip']);
  });

  it('skips the download entirely when every fetch fails', async () => {
    global.fetch = jest.fn(async () => ({ ok: false })) as unknown as typeof fetch;

    const failed = await downloadPhotosAsZip(
      photos(3), 'trip', new AbortController().signal, () => {}
    );

    expect(failed).toBe(3);
    expect(clicks).toEqual([]);
  });

  it('skips the download when aborted', async () => {
    const controller = new AbortController();
    global.fetch = jest.fn(async () => {
      controller.abort();
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }) as unknown as typeof fetch;

    const failed = await downloadPhotosAsZip(photos(10), 'trip', controller.signal, () => {});

    expect(failed).toBe(0);
    expect(clicks).toEqual([]);
  });

  it('never runs more than 6 fetches concurrently', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    global.fetch = jest.fn(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
      return okResponse();
    }) as unknown as typeof fetch;

    await downloadPhotosAsZip(photos(25), 'trip', new AbortController().signal, () => {});

    expect(maxInFlight).toBeLessThanOrEqual(6);
    expect(global.fetch).toHaveBeenCalledTimes(25);
  });
});
