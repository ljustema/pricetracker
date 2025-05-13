'use client';

import dynamic from 'next/dynamic';

// Import the client component with no SSR to avoid hydration issues
const DashboardPreview = dynamic(
  () => import('@/components/marketing/DashboardPreview'),
  { ssr: false }
);

export default function DashboardPreviewWrapper() {
  return <DashboardPreview />;
}
