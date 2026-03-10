import Board from '@/components/Board';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Columns3, List } from 'lucide-react';

export const metadata = {
  title: 'Stract — Kanban Board',
  description: 'A premium task management Kanban board',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafaf8]">
      {/* Navbar */}
      <header className="bg-white border-b border-[#e4e4e0] sticky top-0 z-50 h-14 flex items-center">
        <div className="w-full flex items-center justify-between px-6">
          {/* Left: Logo + wordmark */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-gray-900">Stract</span>
              <span className="text-[#e4e4e0]">/</span>
              <span className="text-[15px] text-[#8a8a85] font-medium">My Board</span>
            </div>
          </div>

          {/* Right: View toggle + avatar */}
          <div className="flex items-center gap-3">
            {/* Segmented view toggle */}
            <div className="flex items-center gap-0.5 bg-[#f4f4f2] border border-[#e4e4e0] rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium bg-white text-gray-900 shadow-sm hover:bg-white rounded-md gap-1.5"
              >
                <Columns3 size={13} />
                Kanban
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs font-medium text-[#8a8a85] hover:text-gray-700 hover:bg-white/70 rounded-md gap-1.5"
              >
                <List size={13} />
                List
              </Button>
            </div>
            {/* Avatar */}
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-violet-400 to-blue-400 text-white text-xs font-semibold">J</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Board title */}
      <div className="max-w-6xl mx-auto px-6 pt-7 pb-1">
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
