import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Website Audit Engine',
  description: 'Professional website diagnostic & evaluation tool. Audit performance, SEO, AEO, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
