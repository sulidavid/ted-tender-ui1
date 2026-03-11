import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TED Tender Explorer',
  description: 'A cleaner interface for browsing TED procurement notices',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
