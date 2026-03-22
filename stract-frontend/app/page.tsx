import Board from '@/components/Board';

export const metadata = {
  title: 'Stract — Kanban Board',
  description: 'A premium task management Kanban board',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafaf8]">
      {/* Board title */}
      <div className="max-w-5xl mx-auto px-6 pt-7 pb-1">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] tracking-tight">Board</h1>
        <p className="text-sm text-[#8a8a85] mt-0.5">Manage and track your tasks across stages</p>
      </div>

      {/* Board columns */}
      <div className="pt-5">
        <Board />
      </div>
    </main>
  );
}
