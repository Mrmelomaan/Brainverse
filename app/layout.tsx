import type { Metadata, Viewport } from 'next';
import { Oxygen, Space_Grotesk } from 'next/font/google';
import './globals.css';

const oxygen = Oxygen({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-oxygen', display: 'swap' });
const grotesk = Space_Grotesk({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-grotesk', display: 'swap' });

export const metadata: Metadata = {
  title: 'Brainverse',
  description: 'A private universe for everything on your mind.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover', themeColor: '#120a1f' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${oxygen.variable} ${grotesk.variable}`}>
      <body style={{ fontFamily: 'var(--font-grotesk), "Space Grotesk", sans-serif' }}>{children}</body>
    </html>
  );
}
