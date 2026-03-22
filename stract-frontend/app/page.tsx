import Board from '@/components/Board';

export const metadata = {
  title: 'Stract — Kanban Board',
  description: 'A premium task management Kanban board',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <div className="mx-auto max-w-[1240px] px-6 py-8">
        <Board />
      </div>
    </main>
  );
}
