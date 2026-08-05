import { fileFromPhoto, canShareFiles, sharePhotos } from '@/lib/share';

// jest-environment-node has no File/fetch/window and only a bare navigator, so
// we stub the browser globals these helpers touch and restore them each time.

const g = globalThis as unknown as Record<string, unknown>;

class FakeFile {
  name: string;
  type: string;
  constructor(_parts: unknown[], name: string, opts: { type?: string } = {}) {
    this.name = name;
    this.type = opts.type ?? '';
  }
}

const savedDescriptors: Record<string, PropertyDescriptor | undefined> = {};

function setGlobal(key: string, value: unknown) {
  if (!(key in savedDescriptors)) {
    savedDescriptors[key] = Object.getOwnPropertyDescriptor(g, key);
  }
  Object.defineProperty(g, key, { value, configurable: true, writable: true });
}

function restoreGlobals() {
  for (const key of Object.keys(savedDescriptors)) {
    const desc = savedDescriptors[key];
    if (desc) Object.defineProperty(g, key, desc);
    else delete g[key];
    delete savedDescriptors[key];
  }
}

afterEach(restoreGlobals);

describe('fileFromPhoto', () => {
  beforeEach(() => setGlobal('File', FakeFile));

  const cases: Array<[string, string]> = [
    ['a.jpg', 'image/jpeg'],
    ['a.jpeg', 'image/jpeg'],
    ['a.png', 'image/png'],
    ['a.webp', 'image/webp'],
    ['a.heic', 'image/heic'],
    ['a.gif', 'image/jpeg'],  // unknown → default
    ['noext', 'image/jpeg'],  // no extension → default
    ['A.JPG', 'image/jpeg'],  // case-insensitive
    ['photo.HEIC', 'image/heic'],
  ];

  it.each(cases)('infers MIME for %s', (filename, expected) => {
    const file = fileFromPhoto({ filename, downloadUrl: 'x' }, {} as Blob);
    expect(file.type).toBe(expected);
  });

  it('keeps the original filename', () => {
    const file = fileFromPhoto({ filename: 'beach day.jpg', downloadUrl: 'x' }, {} as Blob);
    expect(file.name).toBe('beach day.jpg');
  });
});

describe('canShareFiles', () => {
  beforeEach(() => setGlobal('File', FakeFile));

  it('is true on a touch device whose browser can share files', () => {
    setGlobal('window', { matchMedia: () => ({ matches: true }) });
    setGlobal('navigator', { canShare: () => true });
    expect(canShareFiles()).toBe(true);
  });

  it('is false on a non-touch (pointer:fine) device', () => {
    setGlobal('window', { matchMedia: () => ({ matches: false }) });
    setGlobal('navigator', { canShare: () => true });
    expect(canShareFiles()).toBe(false);
  });

  it('is false when canShare({files}) reports unsupported', () => {
    setGlobal('window', { matchMedia: () => ({ matches: true }) });
    setGlobal('navigator', { canShare: () => false });
    expect(canShareFiles()).toBe(false);
  });

  it('is false when navigator.canShare is absent', () => {
    setGlobal('window', { matchMedia: () => ({ matches: true }) });
    setGlobal('navigator', {});
    expect(canShareFiles()).toBe(false);
  });

  it('is false when there is no window (SSR)', () => {
    setGlobal('navigator', { canShare: () => true });
    // window intentionally left undefined
    expect(canShareFiles()).toBe(false);
  });
});

describe('sharePhotos', () => {
  const photo = (n: string): { filename: string; downloadUrl: string } => ({
    filename: `${n}.jpg`,
    downloadUrl: `https://r2/${n}`,
  });

  function okFetch() {
    return jest.fn(async () => ({ ok: true, blob: async () => ({}) }));
  }

  beforeEach(() => setGlobal('File', FakeFile));

  it('fetches, wraps, and shares every photo', async () => {
    const share = jest.fn(async (_data: { files: File[] }) => undefined);
    const onProgress = jest.fn();
    setGlobal('fetch', okFetch());
    setGlobal('navigator', { canShare: () => true, share });

    const res = await sharePhotos([photo('a'), photo('b')], { onProgress });

    expect(res.outcome).toBe('shared');
    expect(res.failed).toBe(0);
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].files).toHaveLength(2);
    expect(onProgress).toHaveBeenLastCalledWith(1);
  });

  it('shares the successes and reports the failures on partial fetch failure', async () => {
    const share = jest.fn(async (_data: { files: File[] }) => undefined);
    setGlobal('fetch', jest.fn(async (url: string) =>
      url.endsWith('/b') ? { ok: false } : { ok: true, blob: async () => ({}) }
    ));
    setGlobal('navigator', { canShare: () => true, share });

    const res = await sharePhotos([photo('a'), photo('b')]);

    expect(res.outcome).toBe('shared');
    expect(res.failed).toBe(1);
    expect(share.mock.calls[0][0].files).toHaveLength(1);
  });

  it('errors and does not share when every fetch fails', async () => {
    const share = jest.fn();
    setGlobal('fetch', jest.fn(async () => ({ ok: false })));
    setGlobal('navigator', { canShare: () => true, share });

    const res = await sharePhotos([photo('a'), photo('b')]);

    expect(res.outcome).toBe('error');
    expect(res.failed).toBe(2);
    expect(share).not.toHaveBeenCalled();
  });

  it('reports canceled when the user dismisses the sheet (AbortError)', async () => {
    const share = jest.fn(async () => { throw Object.assign(new Error('dismissed'), { name: 'AbortError' }); });
    setGlobal('fetch', okFetch());
    setGlobal('navigator', { canShare: () => true, share });

    const res = await sharePhotos([photo('a')]);
    expect(res.outcome).toBe('canceled');
  });

  it('reports no_activation with files intact when iOS drops activation (NotAllowedError)', async () => {
    const share = jest.fn(async () => { throw Object.assign(new Error('gesture'), { name: 'NotAllowedError' }); });
    setGlobal('fetch', okFetch());
    setGlobal('navigator', { canShare: () => true, share });

    const res = await sharePhotos([photo('a')]);
    expect(res.outcome).toBe('no_activation');
    expect(res.files).toHaveLength(1);
  });

  it('shares preparedFiles directly without fetching', async () => {
    const share = jest.fn(async () => undefined);
    const fetchSpy = jest.fn();
    setGlobal('fetch', fetchSpy);
    setGlobal('navigator', { canShare: () => true, share });

    const files = [new FakeFile([], 'x.jpg', { type: 'image/jpeg' })] as unknown as File[];
    const res = await sharePhotos([], { preparedFiles: files });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(share).toHaveBeenCalledTimes(1);
    expect(res.outcome).toBe('shared');
  });

  it('reports canceled when the signal is already aborted', async () => {
    const share = jest.fn();
    setGlobal('fetch', okFetch());
    setGlobal('navigator', { canShare: () => true, share });

    const controller = new AbortController();
    controller.abort();
    const res = await sharePhotos([photo('a')], { signal: controller.signal });

    expect(res.outcome).toBe('canceled');
    expect(share).not.toHaveBeenCalled();
  });
});
