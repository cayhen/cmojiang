'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const LETTERS = 'cmojiang'.split('');
const BASE_COLOR = '#c1c1bf';
const DIM_COLOR  = '#777';
const BURST_MS   = 750;

interface LetterData {
  icon: 'mail' | 'instagram' | 'person';
  value: string;
  href?: string;
}

// C=0, M=1, O=2, J=3, I=4, A=5, N=6, G=7
const LETTER_DATA: Partial<Record<number, LetterData>> = {
  0: { icon: 'mail',      value: 'cadenjiang777@gmail.com', href: 'mailto:cadenjiang777@gmail.com' },
  4: { icon: 'instagram', value: 'caden.jiang',             href: 'https://instagram.com/caden.jiang' },
  5: { icon: 'person',    value: "humbio @ stanford '28" },
};

interface InkBound { ascent: number; descent: number }
interface Burst    { key: number; x: number; y: number; icon: LetterData['icon'] }

function MailIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="3"/>
      <polyline points="2,7 12,13 22,7"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5"/>
      <circle cx="12" cy="12" r="5"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-3.866 3.582-7 8-7s8 3.134 8 7"/>
    </svg>
  );
}

function Icon({ type }: { type: LetterData['icon'] }) {
  if (type === 'mail')      return <MailIcon />;
  if (type === 'instagram') return <InstagramIcon />;
  return <PersonIcon />;
}

export function LogoTitle() {
  const spanRefs    = useRef<(HTMLSpanElement | null)[]>([]);
  const baselineRef = useRef<HTMLSpanElement>(null);
  const burstActive = useRef(false);

  const [inkBounds, setInkBounds] = useState<InkBound[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [burst,     setBurst]     = useState<Burst | null>(null);

  useEffect(() => {
    document.fonts.ready.then(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.font = '150px Rogeta, system-ui, sans-serif';
      setInkBounds(
        LETTERS.map(l => {
          const m = ctx.measureText(l.toUpperCase());
          return { ascent: m.actualBoundingBoxAscent || 105, descent: m.actualBoundingBoxDescent || 5 };
        })
      );
    });
  }, []);

  // Fire a burst when activeIdx changes to a decorated letter
  useEffect(() => {
    if (activeIdx === null) return;
    const data = LETTER_DATA[activeIdx];
    if (!data || burstActive.current) return;

    const span = spanRefs.current[activeIdx];
    if (!span) return;
    const rect = span.getBoundingClientRect();

    burstActive.current = true;
    setBurst({ key: Date.now(), x: rect.left + rect.width / 2, y: rect.top, icon: data.icon });
    setTimeout(() => { setBurst(null); burstActive.current = false; }, BURST_MS);
  }, [activeIdx]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!baselineRef.current || inkBounds.length === 0) return;
    const baselineY = baselineRef.current.getBoundingClientRect().top;
    const cx = e.clientX, cy = e.clientY;

    for (let i = 0; i < LETTERS.length; i++) {
      const span = spanRefs.current[i];
      if (!span) continue;
      const rect = span.getBoundingClientRect();
      if (cx < rect.left || cx > rect.right) continue;
      const { ascent, descent } = inkBounds[i];
      if (cy >= baselineY - ascent && cy <= baselineY + descent) {
        setActiveIdx(i);
        return;
      }
    }
    setActiveIdx(null);
  }, [inkBounds]);

  const handleMouseLeave = useCallback(() => setActiveIdx(null), []);

  const activeData = activeIdx !== null ? LETTER_DATA[activeIdx] ?? null : null;

  return (
    <div>
      <h1
        className="text-[150px] leading-none uppercase tracking-[0.02em] whitespace-nowrap"
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
        <span ref={baselineRef} aria-hidden="true" style={{ fontSize: 0, display: 'inline', verticalAlign: 'baseline' }} />
      </h1>

      <div className="h-[25px] flex items-center mt-[-25px]">
        <div style={{
          opacity: activeData ? 1 : 0,
          transform: activeData ? 'translateY(0)' : 'translateY(3px)',
          transition: 'opacity 0.15s ease, transform 0.15s ease',
          pointerEvents: activeData ? 'auto' : 'none',
        }}>
          {activeData?.href ? (
            <a
              href={activeData.href}
              target={activeData.href.startsWith('http') ? '_blank' : undefined}
              rel={activeData.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="text-[#555] text-xs tracking-[0.04em] hover:text-[#777] transition-colors whitespace-nowrap"
            >
              {activeData.value}
            </a>
          ) : (
            <span className="text-[#555] text-xs tracking-[0.04em] whitespace-nowrap">{activeData?.value}</span>
          )}
        </div>
      </div>

      {/* Icon burst — shoots upward from the letter and fades */}
      {burst && (
        <div
          key={burst.key}
          className="icon-burst"
          style={{ position: 'fixed', left: burst.x, top: burst.y, pointerEvents: 'none', zIndex: 50, color: '#666' }}
        >
          <Icon type={burst.icon} />
        </div>
      )}
    </div>
  );
}
