import DashboardPreviewWrapper from '@/components/marketing/DashboardPreviewWrapper';

export default function InteractivePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Interactive Dashboard Preview</h1>
      <div className="border rounded-lg overflow-hidden">
        <DashboardPreviewWrapper />
      </div>
    </div>
  );
}
