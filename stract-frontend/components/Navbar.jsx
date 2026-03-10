'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Columns3, LayoutDashboard, Settings, Inbox } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Board', Icon: Columns3, exact: true },
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', Icon: Inbox },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <aside className="
      fixed top-0 left-0 h-screen w-[220px] z-40
      bg-white border-r border-[#e4e4e0]
      flex flex-col
      shrink-0
    ">
      {/* Logo / Wordmark */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-[#e4e4e0]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">S</span>
        </div>
        <span className="text-[15px] font-semibold text-gray-900 tracking-tight">Stract</span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <p className="text-[10px] font-semibold text-[#8a8a85] uppercase tracking-widest px-3 mb-1.5">Workspace</p>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive({ href, exact: href === '/' });
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5
                text-sm font-medium transition-colors duration-100
                ${active
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-[#4a4a45] hover:bg-[#f4f4f2] hover:text-gray-900'
                }
              `}
            >
              <Icon
                size={16}
                className={active ? 'text-violet-600' : 'text-[#8a8a85]'}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User avatar at bottom */}
      <div className="px-4 py-4 border-t border-[#e4e4e0] flex items-center gap-3">
        <Avatar className="h-7 w-7 shrink-0">
          <AvatarFallback className="bg-gradient-to-br from-violet-400 to-blue-400 text-white text-[11px] font-semibold">J</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate leading-tight">Jessa</p>
          <p className="text-[11px] text-[#8a8a85] truncate">Free plan</p>
        </div>
      </div>
    </aside>
  );
}
