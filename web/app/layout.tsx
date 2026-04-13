import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SiteNav } from '@/components/site-nav';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Lecture Library',
  description: 'Save and organize lecture summaries from the Lecture Assistant extension',
  icons: {
    icon: [{ url: '/lecture-library-icon.png', type: 'image/png' }],
    apple: '/lecture-library-icon.png',
  },
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased text-slate-800`}
        style={{ background: 'var(--background)' }}
      >
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
