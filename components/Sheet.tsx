'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FocusTrap from 'focus-trap-react';
import { usePresence, useScrollLock } from './usePresence';
import { CloseIcon } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const EXIT_MS = 320;

/** Bottom sheet on phones, centered panel from md up. Drag the header down to dismiss. */
export function Sheet({ open, onClose, title, children }: Props) {
  const { mounted, shown } = usePresence(open, EXIT_MS);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ y: number; t: number; active: boolean }>({ y: 0, t: 0, active: false });
  useScrollLock(mounted);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => { if (!open) setDragY(0); }, [open]);

  if (!mounted) return null;

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), active: true };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    setDragY(Math.max(0, e.clientY - drag.current.y));
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!drag.current.active) return;
    drag.current.active = false;
    const dy = e.clientY - drag.current.y;
    const v = dy / Math.max(1, performance.now() - drag.current.t);
    if (dy > 110 || v > 0.6) onClose();
    else setDragY(0);
  }

  const dragging = drag.current.active;

  return createPortal(
    <FocusTrap
      active={shown}
      focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: false, allowOutsideClick: true, fallbackFocus: () => document.body }}
    >
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
        <div
          onClick={onClose}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out ${shown ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragging ? 'none' : undefined }}
          className={`relative flex max-h-[86vh] w-full flex-col overflow-hidden rounded-t-sheet bg-surface pb-[env(safe-area-inset-bottom)] shadow-float
            transition-[transform,opacity] duration-[320ms] ease-ios
            md:max-h-[78vh] md:w-[min(520px,calc(100vw-48px))] md:rounded-sheet md:pb-0
            ${shown ? 'translate-y-0 opacity-100 md:scale-100' : 'translate-y-full md:translate-y-2 md:scale-[0.97] md:opacity-0'}`}
        >
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { drag.current.active = false; setDragY(0); }}
            className="shrink-0 touch-none select-none"
          >
            <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-fill2 md:hidden" />
            <div className="flex items-center justify-between px-4 pb-2 pt-2 md:pt-4">
              <h2 className="text-title3">{title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="btn-icon h-8 w-8 bg-fill text-label2">
                <CloseIcon size={14} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        </div>
      </div>
    </FocusTrap>,
    document.body
  );
}
