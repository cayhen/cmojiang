'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Photo { id: string; filename: string; url: string; }
interface Collection { id: string; name: string; }

export function ManageCollectionClient({
  collection,
  initialPhotos,
}: {
  collection: Collection;
  initialPhotos: Photo[];
}) {
  const [photos, setPhotos] = useState(initialPhotos);
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
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append('photos', f));

      const res = await fetch(`/api/admin/collections/${collection.id}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        setUploadErrors([`Upload failed (${res.status}): ${text.slice(0, 200)}`]);
        return;
      }

      const results = await res.json();
      const errors = results
        .filter((r: { error?: string }) => r.error)
        .map((r: { filename: string; error: string }) => `${r.filename}: ${r.error}`);
      setUploadErrors(errors);
      if (!errors.length) router.refresh();
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
        <p className="text-[#bbb] text-sm font-light">{collection.name}</p>
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
            accept="image/jpeg,image/png"
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
