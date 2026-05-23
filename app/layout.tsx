import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-dm-sans',
});

export const metadata: Metadata = {
  title: 'Caden Jiang — Photos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className="font-sans bg-[#0f0f0f] text-[#888] antialiased">
        {children}
      </body>
    </html>
  );
}
