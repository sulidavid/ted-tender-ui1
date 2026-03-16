import { Suspense } from 'react';
import TenderExplorer from '@/components/TenderExplorer';

export default function HomePage() {
  return (
    <Suspense fallback={<main className="page-shell">Loading search…</main>}>
      <TenderExplorer />
    </Suspense>
  );
}
