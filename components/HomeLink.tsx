import Link from 'next/link';

export function HomeLink() {
  return (
    <Link
      href="/"
      aria-label="Home"
      className="text-[#444] hover:text-[#666] transition-colors inline-flex items-center"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    </Link>
  );
}
