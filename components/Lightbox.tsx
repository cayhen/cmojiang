'use client';

import { useEffect, useState } from 'react';
import FocusTrap from 'focus-trap-react';

interface Photo { id: string; filename: string; url: string; originalUrl?: string; collectionId?: string; }

interface Props {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
}

export function Lightbox({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const photo = photos[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, photos.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length, onClose]);

  return (
    <FocusTrap focusTrapOptions={{ onDeactivate: onClose, clickOutsideDeactivates: true }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={photo.filename}
        className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative flex flex-col items-center max-w-5xl w-full"
          onClick={e => e.stopPropagation()}
        >
          <img
            src={photo.originalUrl ?? photo.url}
            alt={photo.filename}
            className="max-h-[80vh] max-w-full object-contain"
          />
          <div className="flex justify-between items-center w-full mt-4 px-2">
            <div className="flex gap-4">
              <button
                onClick={() => setIndex(i => Math.max(i - 1, 0))}
                disabled={index === 0}
                aria-label="Previous photo"
                className="text-[#777] hover:text-[#bbb] disabled:opacity-30 text-sm transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setIndex(i => Math.min(i + 1, photos.length - 1))}
                disabled={index === photos.length - 1}
                aria-label="Next photo"
                className="text-[#777] hover:text-[#bbb] disabled:opacity-30 text-sm transition-colors"
              >
                Next →
              </button>
            </div>
            <a
              href={`/api/photo/${photo.id}`}
              download={photo.filename}
              className="text-[#777] hover:text-[#bbb] text-sm transition-colors"
            >
              Download
            </a>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Back to gallery"
          className="absolute top-4 left-4 text-[#777] hover:text-[#bbb] text-sm transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onClose}
          aria-label="Close lightbox"
          className="absolute top-4 right-4 text-[#777] hover:text-[#bbb] text-2xl leading-none transition-colors"
        >
          ×
        </button>
      </div>
    </FocusTrap>
  );
}
