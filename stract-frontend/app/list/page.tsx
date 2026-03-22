import ListView from '@/components/views/ListView';

export const metadata = {
  title: 'Stract — List',
  description: 'View all your tasks in a flat sortable list',
};

export default function ListPage() {
  return (
    <main className="min-h-screen bg-[#fafaf8]">
      <div className="max-w-5xl mx-auto px-6 pt-7 pb-1">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] tracking-tight">List</h1>
        <p className="text-sm text-[#8a8a85] mt-0.5">Filter, sort, and organize tasks efficiently</p>
      </div>

      <div className="pt-5">
        <ListView />
      </div>
    </main>
  );
}
