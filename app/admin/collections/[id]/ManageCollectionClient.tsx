'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { CONTAINER } from '@/components/container';
import { ProgressTrack } from '@/components/FloatingBar';
import { CheckIcon, ChevronRightIcon, CloseIcon, PhotoStackIcon, Spinner } from '@/components/icons';

interface Photo { id: string; filename: string; url: string; }
interface Collection { id: string; name: string; password_plain?: string; event_date?: string | null; is_private?: boolean; }

/** Inline result under a section: quiet for confirmations, destructive for failures. */
function StatusLine({ msg }: { msg: string }) {
  if (!msg) return null;
  const failed = msg.startsWith('Failed');
  return (
    <p
      key={msg}
      role={failed ? 'alert' : 'status'}
      className={`list-footer animate-rise ${failed ? 'text-destructive' : ''}`}
    >
      {msg}
    </p>
  );
}

export function ManageCollectionClient({
  collection,
  initialPhotos,
}: {
  collection: Collection;
  initialPhotos: Photo[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  useEffect(() => { setPhotos(initialPhotos); }, [initialPhotos]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0–1
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameMsg, setNameMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [eventDate, setEventDate] = useState(collection.event_date ?? new Date().toISOString().slice(0, 10));
  const [dateMsg, setDateMsg] = useState('');
  const [isPrivate, setIsPrivate] = useState(collection.is_private ?? false);
  const [privacyMsg, setPrivacyMsg] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleCopyInvite() {
    try {
      const res = await fetch(`/api/admin/collections/${collection.id}/invite`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      await navigator.clipboard.writeText(url);
      setInviteMsg('Invite link copied — unlocks without a password, valid 30 days');
    } catch {
      setInviteMsg('Failed to create invite link');
    }
    setTimeout(() => setInviteMsg(''), 4000);
  }

  interface ThumbnailResult {
    blob: Blob;
    width: number;
    height: number;
    dominantColor: string;
  }

  async function compressThumbnail(file: File): Promise<ThumbnailResult> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, 600 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Sample a 5×5 grid to compute an average representative color
        let r = 0, g = 0, b = 0;
        for (let sy = 0; sy < 5; sy++) {
          for (let sx = 0; sx < 5; sx++) {
            const x = Math.round((sx / 4) * (canvas.width - 1));
            const y = Math.round((sy / 4) * (canvas.height - 1));
            const px = ctx.getImageData(x, y, 1, 1).data;
            r += px[0]; g += px[1]; b += px[2];
          }
        }
        r = Math.round(r / 25); g = Math.round(g / 25); b = Math.round(b / 25);
        const dominantColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

        const { width, height } = canvas;
        canvas.toBlob(
          blob => blob ? resolve({ blob, width, height, dominantColor }) : reject(new Error('toBlob failed')),
          'image/jpeg',
          0.8
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
      img.src = objectUrl;
    });
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('');
    setUploadErrors([]);

    try {
      const rawFiles = Array.from(files);

      // Capture time from EXIF — read from the original files, since HEIC
      // conversion strips metadata. Best-effort: missing EXIF is fine.
      let takenAts: (string | undefined)[] = [];
      try {
        const exifr = (await import('exifr')).default;
        takenAts = await Promise.all(rawFiles.map(async file => {
          try {
            const tags = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate']);
            const taken = tags?.DateTimeOriginal ?? tags?.CreateDate;
            return taken instanceof Date ? taken.toISOString() : undefined;
          } catch { return undefined; }
        }));
      } catch { /* exifr failed to load — uploads proceed without taken_at */ }

      // Convert any HEIC files to JPEG before uploading
      const fileList: File[] = [];
      for (let i = 0; i < rawFiles.length; i++) {
        const file = rawFiles[i];
        const isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic';
        if (isHeic) {
          setUploadStatus(`Converting ${i + 1}/${rawFiles.length}…`);
          const heic2any = (await import('heic2any')).default;
          const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 }) as Blob;
          fileList.push(new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' }));
        } else {
          fileList.push(file);
        }
      }

      // Step 1: get all presigned URLs in one request
      setUploadStatus('Preparing…');
      let urlResults: { filename: string; storagePath?: string; signedUrl?: string; thumbSignedUrl?: string; error?: string }[];
      try {
        const urlRes = await fetch(
          `/api/admin/collections/${collection.id}/photos/upload-url`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: fileList.map(f => ({ filename: f.name })) }),
          }
        );
        if (!urlRes.ok) {
          const text = await urlRes.text();
          setUploadErrors([`Failed to prepare upload (${urlRes.status}): ${text.slice(0, 200)}`]);
          return;
        }
        urlResults = await urlRes.json();
      } catch {
        setUploadErrors(['Could not reach the server. Check your connection and try again.']);
        return;
      }

      const urlErrors = urlResults.filter(r => r.error).map(r => `${r.filename}: ${r.error}`);
      if (urlErrors.length) { setUploadErrors(urlErrors); return; }

      // Step 2: upload to R2 with capped concurrency (20 at a time)
      const CONCURRENCY = 20;
      const uploadErrors: string[] = [];
      const confirmed: { storagePath: string; filename: string; width?: number; height?: number; dominantColor?: string; takenAt?: string }[] = [];
      let completedUploads = 0;
      const totalFiles = fileList.length;

      const uploadTasks = urlResults.map((urlResult, idx) => async () => {
        const file = fileList[idx];
        let thumbBlob: Blob, width: number | undefined, height: number | undefined, dominantColor: string | undefined;
        try {
          ({ blob: thumbBlob, width, height, dominantColor } = await compressThumbnail(file));
        } catch {
          uploadErrors.push(`${file.name}: not a valid image — check it isn't a sidecar/metadata file (.xmp, .aae) or an unfinished cloud download`);
          completedUploads++;
          setUploadProgress(completedUploads / totalFiles);
          return;
        }
        let res: Response, thumbRes: Response;
        try {
          [res, thumbRes] = await Promise.all([
            fetch(urlResult.signedUrl!, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'image/jpeg' } }),
            fetch(urlResult.thumbSignedUrl!, { method: 'PUT', body: thumbBlob, headers: { 'Content-Type': 'image/jpeg' } }),
          ]);
        } catch {
          uploadErrors.push(`${file.name}: network error — check R2 CORS allows PUT from this origin`);
          completedUploads++;
          setUploadProgress(completedUploads / totalFiles);
          return;
        }
        if (!res.ok) {
          uploadErrors.push(`${file.name}: R2 rejected upload (${res.status})`);
        } else if (thumbRes.ok) {
          confirmed.push({ storagePath: urlResult.storagePath!, filename: file.name, width, height, dominantColor, takenAt: takenAts[idx] });
        } else {
          confirmed.push({ storagePath: urlResult.storagePath!, filename: file.name, takenAt: takenAts[idx] });
        }
        completedUploads++;
        setUploadProgress(completedUploads / totalFiles);
        setUploadStatus(`Uploading ${completedUploads}/${totalFiles}`);
      });

      // Run with concurrency limit
      const queue = [...uploadTasks];
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length) await queue.shift()!();
      });
      await Promise.all(workers);

      if (!confirmed.length) { setUploadErrors(uploadErrors); return; }

      // Step 3: save all successfully-uploaded photos' metadata to database
      // (even if some files in the batch failed above)
      let confirmResults: { filename: string; error?: string }[];
      try {
        const confirmRes = await fetch(`/api/admin/collections/${collection.id}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploads: confirmed }),
        });
        if (!confirmRes.ok) {
          const text = await confirmRes.text();
          setUploadErrors([...uploadErrors, `Failed to save photos (${confirmRes.status}): ${text.slice(0, 200)}`]);
          return;
        }
        confirmResults = await confirmRes.json();
      } catch {
        setUploadErrors([...uploadErrors, 'Could not save photo metadata. Photos may have uploaded to storage but won\'t appear in the gallery.']);
        return;
      }

      const confirmErrors = confirmResults
        .filter(r => r.error)
        .map(r => `${r.filename}: ${r.error}`);
      setUploadErrors([...uploadErrors, ...confirmErrors]);
      router.refresh();
    } catch (err) {
      setUploadErrors([`Unexpected error: ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  }

  function togglePhotoSelect(id: string) {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedPhotoIds(new Set());
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedPhotoIds);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} photo${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    const res = await fetch(`/api/admin/collections/${collection.id}/photos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: ids }),
    });
    setBulkDeleting(false);
    if (!res.ok) {
      alert('Failed to delete photos.');
      return;
    }
    setPhotos(ps => ps.filter(p => !selectedPhotoIds.has(p.id)));
    exitSelectMode();
  }

  async function handleDelete(photoId: string) {
    if (!confirm('Delete this photo?')) return;
    const res = await fetch(`/api/admin/collections/${collection.id}/photos`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId }),
    });
    if (!res.ok) {
      alert('Failed to delete photo.');
      return;
    }
    setPhotos(ps => ps.filter(p => p.id !== photoId));
  }

  async function handleNameUpdate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/collections/${collection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) { setNameMsg('Name updated.'); setNewName(''); router.refresh(); }
    else setNameMsg('Failed.');
  }

  async function handleDateUpdate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/collections/${collection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_date: eventDate }),
    });
    if (res.ok) { setDateMsg('Date updated.'); router.refresh(); }
    else setDateMsg('Failed.');
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/collections/${collection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    if (res.ok) { setPasswordMsg('Password updated.'); setNewPassword(''); router.refresh(); }
    else setPasswordMsg('Failed.');
  }

  async function handlePrivacyToggle() {
    const next = !isPrivate;
    const res = await fetch(`/api/admin/collections/${collection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_private: next }),
    });
    if (res.ok) {
      setIsPrivate(next);
      setPrivacyMsg(next ? 'Collection hidden from home.' : 'Collection visible on home.');
    } else {
      setPrivacyMsg('Failed to update.');
    }
  }

  async function handleDeleteCollection() {
    if (!confirm(`Delete "${collection.name}" and all its photos? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/collections/${collection.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Failed to delete collection.');
      return;
    }
    window.location.href = '/admin/dashboard';
  }

  const photoCount = `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
  const inviteFailed = inviteMsg.startsWith('Failed');

  return (
    <main className="min-h-screen bg-grouped pb-16">
      <PageHeader
        title={collection.name}
        subtitle={
          <>
            {photoCount}
            {collection.password_plain && <> · password: {collection.password_plain}</>}
          </>
        }
        back={{ href: '/admin/dashboard', label: 'Collections' }}
        actions={
          <Link href={`/c/${collection.id}/gallery`} className="btn btn-sm btn-tinted">
            View Gallery
          </Link>
        }
      />

      <div className={`${CONTAINER.narrow} space-y-8`}>
        {/* Upload */}
        <section>
          <h2 className="list-header">Upload</h2>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
              }}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed bg-surface px-6 py-10 text-center transition-colors duration-150 ${
                dragOver ? 'border-label' : 'border-separator hover:border-label2'
              }`}
            >
              {uploading
                ? <Spinner size={24} className="text-label2" />
                : <PhotoStackIcon size={28} className="text-label2" />}
              <span className="text-body text-label">
                {uploading ? (uploadStatus || 'Uploading…') : 'Drag photos here or click to select'}
              </span>
              {!uploading && <span className="text-footnote text-label2">JPEG, PNG, WebP or HEIC</span>}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,.heic"
              multiple
              className="hidden"
              onChange={e => handleUpload(e.target.files)}
            />
            {uploading && (
              <div className="flex items-center gap-3 px-4 pt-3">
                <div className="flex-1">
                  <ProgressTrack value={uploadProgress} />
                </div>
                <span className="text-footnote tabular-nums text-label2">{Math.round(uploadProgress * 100)}%</span>
              </div>
            )}
          </div>
          {uploadErrors.length > 0 && (
            <ul role="alert" className="space-y-1 px-4 pt-2">
              {uploadErrors.map((err, i) => (
                <li key={i} className="break-words text-footnote text-destructive">{err}</li>
              ))}
            </ul>
          )}
        </section>

        {/* Photos */}
        <section>
          <div className="list-header flex min-h-[26px] items-end justify-between gap-4">
            <h2>Photos</h2>
            {photosOpen && photos.length > 0 && (
              <div className="flex items-center gap-4">
                {selectMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedPhotoIds(new Set(photos.map(p => p.id)))}
                      className="btn-plain text-subhead"
                    >
                      Select All
                    </button>
                    {selectedPhotoIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                        className="btn-plain text-subhead text-destructive"
                      >
                        {bulkDeleting ? 'Deleting…' : `Delete ${selectedPhotoIds.size}`}
                      </button>
                    )}
                    <button type="button" onClick={exitSelectMode} className="btn-plain text-subhead font-semibold">
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setSelectMode(true)} className="btn-plain text-subhead">
                    Select
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="list">
            <button
              type="button"
              onClick={() => setPhotosOpen(o => !o)}
              aria-expanded={photosOpen}
              className="list-row"
            >
              <span className="flex-1">{photoCount}</span>
              <span className="text-label2">{photosOpen ? 'Hide' : 'Show'}</span>
              <ChevronRightIcon size={18} className={`-mr-1 shrink-0 text-label2 ${photosOpen ? 'rotate-90' : ''}`} />
            </button>
            {photosOpen && (photos.length > 0 ? (
              <div className="hairline-t grid grid-cols-4 gap-1 p-1 sm:grid-cols-5">
                {photos.map(photo => {
                  const selected = selectedPhotoIds.has(photo.id);
                  return (
                    <div key={photo.id} className="group relative aspect-square">
                      <img
                        src={photo.url}
                        alt={photo.filename}
                        loading="lazy"
                        decoding="async"
                        className={`absolute inset-0 h-full w-full rounded-tile bg-fill object-cover transition-opacity duration-150 ${
                          selectMode && selected ? 'opacity-70' : ''
                        }`}
                      />
                      {selectMode ? (
                        <button
                          type="button"
                          onClick={() => togglePhotoSelect(photo.id)}
                          aria-pressed={selected}
                          aria-label={`Select ${photo.filename}`}
                          className="absolute inset-0 flex items-end justify-end rounded-tile p-1.5"
                        >
                          <span
                            className={`flex h-[22px] w-[22px] items-center justify-center rounded-full ${
                              selected
                                ? 'bg-white text-black ring-2 ring-white shadow-[0_1px_4px_rgba(0,0,0,0.35)]'
                                : 'bg-black/10 ring-[1.5px] ring-inset ring-white/90'
                            }`}
                          >
                            {selected && <CheckIcon size={14} />}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDelete(photo.id)}
                          aria-label={`Delete ${photo.filename}`}
                          className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                        >
                          <CloseIcon size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="hairline-t px-4 py-3 text-footnote text-label2">No photos yet.</p>
            ))}
          </div>
        </section>

        {/* Details: inline rows in one grouped list */}
        <section>
          <h2 className="list-header">Details</h2>
          <div className="list">
            <form onSubmit={handleNameUpdate} className="list-row py-0">
              <label htmlFor="collection-name" className="w-24 shrink-0">Name</label>
              <input
                id="collection-name"
                type="text"
                placeholder={collection.name}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                required
                className="h-12 min-w-0 flex-1 bg-transparent text-body text-label outline-none placeholder:text-label2"
              />
              {newName.trim() && <button type="submit" className="btn-plain animate-pop font-semibold">Save</button>}
            </form>
            <form onSubmit={handleDateUpdate} className="list-row py-0">
              <label htmlFor="collection-date" className="w-24 shrink-0">Event date</label>
              <input
                id="collection-date"
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                required
                className="h-12 min-w-0 flex-1 bg-transparent text-body text-label outline-none [&::-webkit-date-and-time-value]:text-left"
              />
              {eventDate !== (collection.event_date ?? '') && <button type="submit" className="btn-plain animate-pop font-semibold">Save</button>}
            </form>
            <form onSubmit={handlePasswordUpdate} className="list-row py-0">
              <label htmlFor="collection-password" className="w-24 shrink-0">Password</label>
              <input
                id="collection-password"
                type="password"
                placeholder="New password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                className="h-12 min-w-0 flex-1 bg-transparent text-body text-label outline-none placeholder:text-label2"
              />
              {newPassword && <button type="submit" className="btn-plain animate-pop font-semibold">Save</button>}
            </form>
          </div>
          <p className="list-footer">
            Collections are ordered by event date on the home page. People who already unlocked this collection keep access after a password change.
          </p>
          <StatusLine msg={nameMsg} />
          <StatusLine msg={dateMsg} />
          <StatusLine msg={passwordMsg} />
        </section>

        {/* Visibility */}
        <section>
          <h2 className="list-header">Visibility</h2>
          <div className="list">
            <div className="list-row">
              <span id="private-label" className="flex-1">Private</span>
              <button
                type="button"
                role="switch"
                aria-checked={isPrivate}
                aria-labelledby="private-label"
                onClick={handlePrivacyToggle}
                className={`relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 ease-out ${
                  isPrivate ? 'bg-[#34c759]' : 'bg-fill2'
                }`}
              >
                <span
                  aria-hidden
                  className={`h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
                    isPrivate ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
          <p className="list-footer">
            Private collections are hidden from the home page. Anyone with the password or an invite link can still open them.
          </p>
          <StatusLine msg={privacyMsg} />
        </section>

        {/* Invite link */}
        <section>
          <h2 className="list-header">Invite link</h2>
          <div className="list">
            <button type="button" onClick={handleCopyInvite} className="list-row font-medium">
              Copy Invite Link
            </button>
          </div>
          {inviteMsg ? (
            <p
              key={inviteMsg}
              role={inviteFailed ? 'alert' : 'status'}
              className={`list-footer animate-rise ${inviteFailed ? 'text-destructive' : ''}`}
            >
              {inviteMsg}
            </p>
          ) : (
            <p className="list-footer">Opens the collection without the password. Links expire after 30 days.</p>
          )}
        </section>

        {/* Delete collection */}
        <section>
          <div className="list">
            <button
              type="button"
              onClick={handleDeleteCollection}
              className="list-row justify-center text-destructive"
            >
              Delete Collection
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
