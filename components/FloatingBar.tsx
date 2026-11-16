'use client';

import { usePresence } from './usePresence';

/** Frosted bar that floats above the bottom edge for selection and progress. */
export function FloatingBar({ open, children }: { open: boolean; children: React.ReactNode }) {
  const { mounted, shown } = usePresence(open, 300);
  if (!mounted) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div
        className={`pointer-events-auto flex min-h-[56px] w-full max-w-lg items-center gap-3 rounded-[20px] px-4 py-2 material-thick shadow-float
          transition-[transform,opacity] duration-300 ease-ios ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
      >
        {children}
      </div>
    </div>
  );
}

/** Thin progress track used inside FloatingBar. */
export function ProgressTrack({ value }: { value: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full bg-label transition-[width] duration-300 ease-out" style={{ width: `${Math.max(2, value * 100)}%` }} />
    </div>
  );
}
