'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const LETTERS = 'cmojiang'.split('');
const BASE_COLOR = '#c1c1bf';
const DIM_COLOR  = '#777';

interface InkBound { ascent: number; descent: number }

export function LogoTitle() {
  const spanRefs   = useRef<(HTMLSpanElement | null)[]>([]);
  const baselineRef = useRef<HTMLSpanElement>(null);
  const [inkBounds, setInkBounds] = useState<InkBound[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Measure actual ink extents (from baseline) for each letter via canvas
  useEffect(() => {
    document.fonts.ready.then(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.font = '120px Rogeta, system-ui, sans-serif';
      setInkBounds(
        LETTERS.map(l => {
          const m = ctx.measureText(l.toUpperCase());
          return {
            ascent:  m.actualBoundingBoxAscent  || 84,
            descent: m.actualBoundingBoxDescent || 4,
          };
        })
      );
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!baselineRef.current || inkBounds.length === 0) return;

    // A zero-height inline span's top edge sits exactly on the baseline
    const baselineY = baselineRef.current.getBoundingClientRect().top;
    const cx = e.clientX;
    const cy = e.clientY;

    for (let i = 0; i < LETTERS.length; i++) {
      const span = spanRefs.current[i];
      if (!span) continue;
      const rect = span.getBoundingClientRect();

      // Horizontal: CSS box is already tight to the glyph advance width
      if (cx < rect.left || cx > rect.right) continue;

      // Vertical: compare against actual ink bounds measured from the baseline
      const { ascent, descent } = inkBounds[i];
      if (cy >= baselineY - ascent && cy <= baselineY + descent) {
        setActiveIdx(i);
        return;
      }
    }
    setActiveIdx(null);
  }, [inkBounds]);

  const handleMouseLeave = useCallback(() => setActiveIdx(null), []);

  return (
    <h1
      className="text-[120px] leading-none uppercase tracking-[0.02em] whitespace-nowrap"
      style={{ fontFamily: 'Rogeta, system-ui, sans-serif' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {LETTERS.map((letter, i) => (
        <span
          key={i}
          ref={el => { spanRefs.current[i] = el; }}
          style={{
            color: activeIdx === i ? DIM_COLOR : BASE_COLOR,
            transition: 'color 0.2s ease',
            display: 'inline-block',
          }}
        >
          {letter}
        </span>
      ))}
      {/* Zero-size inline probe: its top edge sits exactly on the parent baseline */}
      <span
        ref={baselineRef}
        aria-hidden="true"
        style={{ fontSize: 0, display: 'inline', verticalAlign: 'baseline' }}
      />
    </h1>
  );
}
