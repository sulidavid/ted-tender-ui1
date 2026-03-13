import './globals.css';
import type { Metadata } from 'next';
import { QueryProvider } from '@/components/QueryProvider';

export const metadata: Metadata = {
  title: 'TED Tender Explorer',
  description: 'A cleaner interface for browsing TED procurement notices',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
