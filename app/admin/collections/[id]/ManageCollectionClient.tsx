'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Photo { id: string; filename: string; url: string; }
interface Collection { id: string; name: string; password_plain?: string; }

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
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadErrors([]);

    try {
      const rawFiles = Array.from(files);

      // Convert any HEIC files to JPEG before uploading
      const fileList: File[] = [];
      for (const file of rawFiles) {
        const isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic';
        if (isHeic) {
          const heic2any = (await import('heic2any')).default;
          const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 }) as Blob;
          fileList.push(new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' }));
        } else {
          fileList.push(file);
        }
      }

      // Step 1: get signed upload URLs from the server
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
        setUploadErrors([`Failed to get upload URLs (${urlRes.status}): ${text.slice(0, 200)}`]);
        return;
      }

      const urlResults: { filename: string; storagePath?: string; signedUrl?: string; error?: string }[] =
        await urlRes.json();

      const urlErrors = urlResults.filter(r => r.error).map(r => `${r.filename}: ${r.error}`);
      if (urlErrors.length) { setUploadErrors(urlErrors); return; }

      // Step 2: upload each file directly to Supabase (bypasses Vercel size limit)
      const uploadErrors: string[] = [];
      const confirmed: { storagePath: string; filename: string }[] = [];

      await Promise.all(
        urlResults.map(async ({ filename, storagePath, signedUrl }) => {
          const file = fileList.find(f => f.name === filename)!;
          const res = await fetch(signedUrl!, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
          if (!res.ok) {
            uploadErrors.push(`${filename}: storage upload failed (${res.status})`);
          } else {
            confirmed.push({ storagePath: storagePath!, filename });
          }
        })
      );

      if (uploadErrors.length) { setUploadErrors(uploadErrors); return; }

      // Step 3: save metadata to database
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

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/admin/collections/${collection.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    });
    setPasswordMsg(res.ok ? 'Password updated.' : 'Failed.');
    setNewPassword('');
  }

  async function handleDeleteCollection() {
    if (!confirm(`Delete "${collection.name}" and all its photos? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/collections/${collection.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Failed to delete collection.');
      return;
    }
    router.push('/admin/dashboard');
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/dashboard" className="text-[#666] text-xs hover:text-[#777]">← Back</Link>
        <div>
          <p className="text-[#bbb] text-sm font-light">{collection.name}</p>
          {collection.password_plain && (
            <p className="text-[#555] text-xs mt-0.5">password: {collection.password_plain}</p>
          )}
        </div>
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
            {uploading ? 'Uploading...' : 'Drag photos here or click to select'}
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
        {uploadErrors.map((err, i) => (
          <p key={i} className="text-red-500/70 text-xs mt-1">{err}</p>
        ))}
      </section>

      {/* Photos */}
      <section className="mb-8">
        <p className="text-[#666] text-xs uppercase tracking-widest mb-3">
          Photos ({photos.length})
        </p>
        <div className="grid grid-cols-3 gap-2">
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
        </div>
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
