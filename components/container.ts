// Page-width classes shared by server and client components (kept out of the
// 'use client' PageHeader module so server pages can read them).
export const CONTAINER = {
  narrow: 'mx-auto w-full max-w-2xl px-4 sm:px-6',
  wide: 'mx-auto w-full px-4 sm:px-6 lg:px-8',
  /** Home: the narrow reading column on phones and tablets, a wide index from lg up. */
  index: 'mx-auto w-full max-w-2xl px-4 sm:px-6 lg:max-w-6xl lg:px-8',
} as const;
