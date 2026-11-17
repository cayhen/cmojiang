import type { CSSProperties } from 'react';

/**
 * Soft light in the photos' own colors, pooled around the edges of the whole
 * screen behind the page. Fixed to the viewport and behind everything in the
 * nearest isolated ancestor (give the page `relative isolate`). Changing
 * `colors` eases the light from one palette to the next. Renders nothing
 * without colors.
 */
export function AmbientGlow({ colors }: { colors: string[] }) {
  if (colors.length === 0) return null;
  const slot = (i: number) => colors[i % colors.length];
  const style = {
    '--glow-1': slot(0),
    '--glow-2': slot(1),
    '--glow-3': slot(2),
    '--glow-4': slot(3),
  } as CSSProperties;
  return <div aria-hidden className="ambient-glow" style={style} />;
}
