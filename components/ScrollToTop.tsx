'use client';

import { useState, useEffect } from 'react';
import { ArrowUpIcon } from './icons';
import { prefersReducedMotion } from './usePresence';

export function ScrollToTop({ hidden }: { hidden?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() { setVisible(window.scrollY > window.innerHeight * 1.5); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const show = visible && !hidden;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}
      aria-label="Scroll to top"
      tabIndex={show ? 0 : -1}
      className={`fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full material-thick text-label shadow-float
        transition-[opacity,transform] duration-300 ease-ios active:scale-90 ${show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}
    >
      <ArrowUpIcon size={18} />
    </button>
  );
}
