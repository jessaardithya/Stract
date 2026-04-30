'use client';

import { useState } from 'react';
import { Hexagon, LogOut, PanelLeftClose, PanelLeftOpen, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Workspace } from '@/types';

interface HomeSidebarProps {
  workspaces: Workspace[];
  lastUsedWorkspaceId: string | null;
  displayName: string;
  onEnterWorkspace: (ws: Workspace) => void;
  onSignOut: () => void;
}

export function HomeSidebar({
  workspaces,
  lastUsedWorkspaceId,
  displayName,
  onEnterWorkspace,
  onSignOut,
}: HomeSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-[#fdfdfd] border-r border-[#e5e5e5] h-screen transition-all duration-300 ease-in-out shrink-0 sticky top-0 ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-[#e5e5e5]">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="size-6 rounded bg-[#f4f4f5] text-indigo-600 flex items-center justify-center shrink-0">
              <Hexagon size={14} className="fill-current" />
            </div>
            <span className="text-[13px] font-semibold text-gray-900 truncate">Stract</span>
          </div>
        )}
        {collapsed && (
          <div className="size-10 flex items-center justify-center mx-auto shrink-0">
            <div className="size-6 rounded bg-[#f4f4f5] text-indigo-600 flex items-center justify-center">
              <Hexagon size={14} className="fill-current" />
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`shrink-0 flex items-center justify-center size-6 text-gray-400 hover:text-gray-900 hover:bg-[#f4f4f5] rounded-md transition-colors ${
            collapsed ? 'mx-auto mt-4' : ''
          }`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-5 custom-scrollbar">
        {!collapsed && (
          <div className="px-5 mb-2">
            <p className="text-[11px] font-medium tracking-tight text-gray-500 mb-2">{displayName}'s Workspaces</p>
          </div>
        )}

        <ul className="px-3 space-y-1">
          {workspaces.map((ws) => {
            const isLastUsed = ws.id === lastUsedWorkspaceId;
            return (
              <li key={ws.id}>
                <button
                  onClick={() => onEnterWorkspace(ws)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors group ${
                    isLastUsed
                      ? 'bg-indigo-50/60 text-indigo-900 font-medium'
                      : 'text-gray-600 hover:bg-[#f4f4f5] hover:text-gray-900'
                  }`}
                  aria-label={`Enter workspace ${ws.name}`}
                >
                  <div className="size-5 rounded shrink-0 bg-white border border-[#e5e5e5] text-gray-500 flex items-center justify-center text-[10px] font-bold group-hover:border-gray-300">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  {!collapsed && (
                    <>
                      <span className="truncate flex-1 text-left">{ws.name}</span>
                      <ChevronRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4 border-t border-[#e5e5e5]">
        <button
          onClick={onSignOut}
          className={`flex items-center gap-2.5 w-full p-2 text-gray-500 hover:text-gray-900 hover:bg-[#f4f4f5] rounded-md transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span className="text-[13px] font-medium">Log out</span>}
        </button>
      </div>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: transparent;
          border-radius: 4px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
        }
      `}</style>
    </aside>
  );
}
