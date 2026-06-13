'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Photo { id: string; filename: string; url: string; }
interface Collection { id: string; name: string; password_plain?: string; event_date?: string | null; is_private?: boolean; }

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

      // Process in chunks to avoid overwhelming the server and browser with parallel requests
      const CHUNK_SIZE = 10;
      const chunks: File[][] = [];
      for (let i = 0; i < fileList.length; i += CHUNK_SIZE) chunks.push(fileList.slice(i, i + CHUNK_SIZE));

      const uploadErrors: string[] = [];
      const confirmed: { storagePath: string; filename: string; width?: number; height?: number; dominantColor?: string }[] = [];
      let completedUploads = 0;
      const totalFiles = fileList.length;

      for (const chunk of chunks) {
        // Step 1: get signed upload URLs for this chunk
        setUploadStatus(`Preparing ${completedUploads + 1}–${Math.min(completedUploads + chunk.length, totalFiles)}/${totalFiles}…`);
        const urlRes = await fetch(
          `/api/admin/collections/${collection.id}/photos/upload-url`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: chunk.map(f => ({ filename: f.name })) }),
          }
        );

        if (!urlRes.ok) {
          const text = await urlRes.text();
          setUploadErrors([`Failed to get upload URLs (${urlRes.status}): ${text.slice(0, 200)}`]);
          return;
        }

        const urlResults: { filename: string; storagePath?: string; signedUrl?: string; thumbSignedUrl?: string; error?: string }[] =
          await urlRes.json();

        const urlErrors = urlResults.filter(r => r.error).map(r => `${r.filename}: ${r.error}`);
        if (urlErrors.length) { setUploadErrors(urlErrors); return; }

        // Step 2: upload this chunk to R2 in parallel
        await Promise.all(
          urlResults.map(async (urlResult, idx) => {
            const file = chunk[idx];
            const { blob: thumbBlob, width, height, dominantColor } = await compressThumbnail(file);
            const [res, thumbRes] = await Promise.all([
              fetch(urlResult.signedUrl!, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } }),
              fetch(urlResult.thumbSignedUrl!, { method: 'PUT', body: thumbBlob, headers: { 'Content-Type': 'image/jpeg' } }),
            ]);
            if (!res.ok) {
              uploadErrors.push(`${file.name}: storage upload failed (${res.status})`);
            } else if (thumbRes.ok) {
              confirmed.push({ storagePath: urlResult.storagePath!, filename: file.name, width, height, dominantColor });
            } else {
              confirmed.push({ storagePath: urlResult.storagePath!, filename: file.name });
            }
            completedUploads++;
            setUploadProgress(completedUploads / totalFiles);
            setUploadStatus(`Uploading ${completedUploads}/${totalFiles}`);
          })
        );

        if (uploadErrors.length) { setUploadErrors(uploadErrors); return; }
      }

      // Step 3: save all metadata to database in one call
      const confirmRes = await fetch(`/api/admin/collections/${collection.id}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploads: confirmed }),
      });

      if (!confirmRes.ok) {
        const text = await confirmRes.text();
        setUploadErrors([`Failed to save photos (${confirmRes.status}): ${text.slice(0, 200)}`]);
        return;
      }

      const confirmResults = await confirmRes.json();
      const confirmErrors = confirmResults
        .filter((r: { error?: string }) => r.error)
        .map((r: { filename: string; error: string }) => `${r.filename}: ${r.error}`);
      setUploadErrors(confirmErrors);
      if (!confirmErrors.length) router.refresh();
    } catch (err) {
      setUploadErrors([`Upload failed: ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
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

  return (
    <main className="min-h-screen p-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="text-[#666] text-xs hover:text-[#777]">← Back</Link>
          <div>
            <p className="text-[#bbb] text-sm font-light">{collection.name}</p>
            {collection.password_plain && (
              <p className="text-[#555] text-xs mt-0.5">password: {collection.password_plain}</p>
            )}
          </div>
        </div>
        <Link
          href={`/c/${collection.id}/gallery`}
          className="text-[#555] text-xs hover:text-[#888] transition-colors"
        >
          View gallery →
        </Link>
      </div>

      {/* Upload */}
      <section className="mb-8">
        <p className="text-[#666] text-xs uppercase tracking-widest mb-3">Upload Photos</p>
        <div
          className="border border-dashed border-[#2a2a2a] rounded p-8 text-center cursor-pointer hover:border-[#3a3a3a] transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
        >
          <p className="text-[#666] text-sm font-light">
            {uploading ? (uploadStatus || 'Uploading…') : 'Drag photos here or click to select'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,.heic"
            multiple
            className="hidden"
            onChange={e => handleUpload(e.target.files)}
          />
        </div>
        {uploading && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[#555] text-xs">
              <span>{uploadStatus || 'Uploading…'}</span>
              <span>{Math.round(uploadProgress * 100)}%</span>
            </div>
            <div className="h-px bg-[#1e1e1e] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#555] transition-all duration-200"
                style={{ width: `${uploadProgress * 100}%` }}
              />
            </div>
          </div>
        )}
        {uploadErrors.map((err, i) => (
          <p key={i} className="text-red-500/70 text-xs mt-1">{err}</p>
        ))}
      </section>

      {/* Photos */}
      <section className="mb-8">
        <button
          onClick={() => setPhotosOpen(o => !o)}
          className="flex items-center gap-2 mb-3 group"
        >
          <p className="text-[#666] text-xs uppercase tracking-widest">Photos ({photos.length})</p>
          <span className="text-[#444] text-xs group-hover:text-[#666] transition-colors">{photosOpen ? '▼' : '▶'}</span>
        </button>
        {photosOpen && <div className="grid grid-cols-3 gap-2">
          {photos.map(photo => (
            <div key={photo.id} className="relative group">
              <img src={photo.url} alt={photo.filename} className="w-full rounded-sm" />
              <button
                onClick={() => handleDelete(photo.id)}
                className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>}
      </section>

      {/* Rename */}
      <section className="mb-8">
        <p className="text-[#666] text-xs uppercase tracking-widest mb-3">Rename</p>
        <form onSubmit={handleNameUpdate} className="flex gap-2">
          <input
            type="text"
            placeholder={collection.name}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
            className="flex-1 bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2 text-[#bbb] text-sm placeholder:text-[#444] focus:outline-none focus:border-[#2a2a2a] font-light"
          />
          <button
            type="submit"
            className="bg-[#161616] border border-[#1a1a1a] text-[#888] text-sm px-4 rounded hover:border-[#2a2a2a] hover:text-[#bbb] transition-colors"
          >
            Update
          </button>
        </form>
        {nameMsg && <p className="text-[#777] text-xs mt-1">{nameMsg}</p>}
      </section>

      {/* Event date */}
      <section className="mb-8">
        <p className="text-[#666] text-xs uppercase tracking-widest mb-3">Event Date</p>
        <form onSubmit={handleDateUpdate} className="flex gap-2">
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            required
            className="flex-1 bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2 text-[#bbb] text-sm focus:outline-none focus:border-[#2a2a2a] font-light"
          />
          <button
            type="submit"
            className="bg-[#161616] border border-[#1a1a1a] text-[#888] text-sm px-4 rounded hover:border-[#2a2a2a] hover:text-[#bbb] transition-colors"
          >
            Update
          </button>
        </form>
        {dateMsg && <p className="text-[#777] text-xs mt-1">{dateMsg}</p>}
      </section>

      {/* Change password */}
      <section className="mb-8">
        <p className="text-[#666] text-xs uppercase tracking-widest mb-3">Change Password</p>
        <form onSubmit={handlePasswordUpdate} className="flex gap-2">
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
            className="flex-1 bg-[#161616] border border-[#1a1a1a] rounded px-3 py-2 text-[#bbb] text-sm placeholder:text-[#666] focus:outline-none focus:border-[#2a2a2a] font-light"
          />
          <button
            type="submit"
            className="bg-[#161616] border border-[#1a1a1a] text-[#888] text-sm px-4 rounded hover:border-[#2a2a2a] hover:text-[#bbb] transition-colors"
          >
            Update
          </button>
        </form>
        {passwordMsg && <p className="text-[#777] text-xs mt-1">{passwordMsg}</p>}
      </section>

      {/* Visibility */}
      <section className="mb-8">
        <p className="text-[#666] text-xs uppercase tracking-widest mb-3">Visibility</p>
        <div className="flex items-center justify-between">
          <p className="text-[#777] text-sm font-light">
            {isPrivate ? 'Hidden — not shown on home page' : 'Public — visible on home page'}
          </p>
          <button
            onClick={handlePrivacyToggle}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              isPrivate
                ? 'border-[#2a2a2a] text-[#888] hover:text-[#bbb] hover:border-[#3a3a3a]'
                : 'border-[#2a2a2a] text-[#888] hover:text-[#bbb] hover:border-[#3a3a3a]'
            }`}
          >
            {isPrivate ? 'Make public' : 'Make private'}
          </button>
        </div>
        {privacyMsg && <p className="text-[#777] text-xs mt-2">{privacyMsg}</p>}
      </section>

      {/* Delete collection */}
      <section>
        <button
          onClick={handleDeleteCollection}
          className="text-red-500/50 text-xs hover:text-red-500/70 transition-colors"
        >
          Delete collection
        </button>
      </section>
    </main>
  );
}
