import Dashboard from '@/components/Dashboard';

export const metadata = {
  title: 'Stract — Dashboard',
  description: 'Live analytics and project insights',
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#fafaf8]">
      <Dashboard />
    </main>
  );
}
