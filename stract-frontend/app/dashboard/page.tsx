import ReportsDashboard from '@/components/reports/ReportsDashboard';

export const metadata = {
  title: 'Stract - Reports',
  description: 'Live analytics and project insights',
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#fafaf8]">
      <ReportsDashboard />
    </main>
  );
}
