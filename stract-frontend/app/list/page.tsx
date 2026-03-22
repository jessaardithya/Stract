import ListView from '@/components/views/ListView';

export const metadata = {
  title: 'Stract — List',
  description: 'View all your tasks in a flat sortable list',
};

export default function ListPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <div className="mx-auto max-w-[1240px] px-6 py-8">
        <ListView />
      </div>
    </main>
  );
}
