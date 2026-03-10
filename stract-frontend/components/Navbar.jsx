'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Columns3, LayoutDashboard } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const isDashboard = pathname === '/dashboard';

  return (
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
            <span className="text-[15px] text-[#8a8a85] font-medium">
              {isDashboard ? 'Dashboard' : 'My Board'}
            </span>
          </div>
        </div>

        {/* Right: View toggle + avatar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 bg-[#f4f4f2] border border-[#e4e4e0] rounded-lg p-1">
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2.5 text-xs font-medium rounded-md gap-1.5
                  ${!isDashboard
                    ? 'bg-white text-gray-900 shadow-sm hover:bg-white'
                    : 'text-[#8a8a85] hover:text-gray-700 hover:bg-white/70'
                  }`}
              >
                <Columns3 size={13} />
                Kanban
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2.5 text-xs font-medium rounded-md gap-1.5
                  ${isDashboard
                    ? 'bg-white text-gray-900 shadow-sm hover:bg-white'
                    : 'text-[#8a8a85] hover:text-gray-700 hover:bg-white/70'
                  }`}
              >
                <LayoutDashboard size={13} />
                Dashboard
              </Button>
            </Link>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gradient-to-br from-violet-400 to-blue-400 text-white text-xs font-semibold">J</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
