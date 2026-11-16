// One icon family: 24px grid, 1.75 stroke, round caps and joins.
type IconProps = { size?: number; className?: string; strokeWidth?: number };

function Svg({ size = 22, className, strokeWidth = 1.75, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const HEART_PATH =
  'M12 20.3c-.3 0-.6-.1-.8-.3C7.5 16.9 3 13.2 3 8.9 3 6.1 5.1 4 7.7 4c1.7 0 3.2.9 4.3 2.4C13.1 4.9 14.6 4 16.3 4 18.9 4 21 6.1 21 8.9c0 4.3-4.5 8-8.2 11.1-.2.2-.5.3-.8.3z';

export function HeartIcon({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...p}>
      <path d={HEART_PATH} fill={filled ? 'currentColor' : 'none'} />
    </Svg>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return <Svg strokeWidth={2.2} {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
}

export function ChevronRightIcon(p: IconProps) {
  return <Svg strokeWidth={2.2} {...p}><path d="M9 5l7 7-7 7" /></Svg>;
}

export function CloseIcon(p: IconProps) {
  return <Svg strokeWidth={2.2} {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
}

export function CheckIcon(p: IconProps) {
  return <Svg strokeWidth={2.6} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
}

export function ShareIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" />
      <path d="M8 10H6.5A1.5 1.5 0 005 11.5v8A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5v-8a1.5 1.5 0 00-1.5-1.5H16" />
    </Svg>
  );
}

export function DownloadIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v12M7.5 10.5L12 15l4.5-4.5" />
      <path d="M5 17v1.5A2.5 2.5 0 007.5 21h9a2.5 2.5 0 002.5-2.5V17" />
    </Svg>
  );
}

export function CommentIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4c4.97 0 9 3.36 9 7.5S16.97 19 12 19c-1.07 0-2.1-.15-3.05-.44L4.5 20.5l1.3-3.6C4.07 15.55 3 13.62 3 11.5 3 7.36 7.03 4 12 4z" />
    </Svg>
  );
}

export function LockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" />
    </Svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Svg strokeWidth={2} {...p}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L20 20" />
    </Svg>
  );
}

export function PlusIcon(p: IconProps) {
  return <Svg strokeWidth={2.2} {...p}><path d="M12 5v14M5 12h14" /></Svg>;
}

export function MinusIcon(p: IconProps) {
  return <Svg strokeWidth={2.2} {...p}><path d="M5 12h14" /></Svg>;
}

export function ArrowUpIcon(p: IconProps) {
  return <Svg strokeWidth={2.2} {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>;
}

export function PhotoStackIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="6" width="15" height="13" rx="2.5" />
      <path d="M7 3.5h11A2.5 2.5 0 0120.5 6v10" />
      <path d="M3.5 16l4-4 3.5 3.5 2-2 4.5 4.5" />
    </Svg>
  );
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin-smooth ${className ?? ''}`} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
