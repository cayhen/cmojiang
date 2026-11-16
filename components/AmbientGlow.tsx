import type { CSSProperties } from 'react';

/**
 * Soft light in a collection's own photo colors, spilling in from the top of
 * the page and fading into it. Sits behind everything in the nearest isolated
 * ancestor (give the page `relative isolate`). Changing `colors` eases the
 * light from one palette to the next. Renders nothing without colors.
 *
 * header: fades out by the top of the photo grid. page: runs deeper, for home.
 */
export function AmbientGlow({ colors, reach = 'header' }: { colors: string[]; reach?: 'header' | 'page' }) {
  if (colors.length === 0) return null;
  const slot = (i: number) => colors[i % colors.length];
  const style = {
    '--glow-1': slot(0),
    '--glow-2': slot(1),
    '--glow-3': slot(2),
    '--glow-4': slot(3),
  } as CSSProperties;
  return <div aria-hidden className={`ambient-glow ambient-glow-${reach}`} style={style} />;
}
