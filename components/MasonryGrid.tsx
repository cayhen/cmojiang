'use client';

import { useState } from 'react';
import { Lightbox } from './Lightbox';

interface Photo { id: string; filename: string; url: string; }

export function MasonryGrid({ photos }: { photos: Photo[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-1.5">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            className="break-inside-avoid mb-1.5 w-full block focus:outline-none focus:ring-1 focus:ring-[#333] rounded-sm"
            onClick={() => setLightboxIndex(i)}
            aria-label={`Open ${photo.filename}`}
          >
            <img
              src={photo.url}
              alt={photo.filename}
              loading="lazy"
              className="w-full block rounded-sm"
            />
          </button>
        ))}
      </div>
      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
