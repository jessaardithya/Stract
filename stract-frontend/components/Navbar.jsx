'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  LayoutDashboard,
  Settings,
  Plus,
  Check,
  X,
  ChevronsUpDown,
  Building2,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { createProject } from '@/lib/api';

const PRESET_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#6b7280',
];

const BOTTOM_NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { activeWorkspace, activeProject, workspaces, projects, setActiveWorkspace, setActiveProject, refreshProjects } = useApp();

  // New project inline form
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  // Workspace switcher popover
  const [wsOpen, setWsOpen] = useState(false);

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name || !activeWorkspace) return;
    setIsCreating(true);
    try {
      const result = await createProject(activeWorkspace.id, { name, color: newProjectColor });
      await refreshProjects();
      setActiveProject(result.data);
      setShowNewProject(false);
      setNewProjectName('');
      setNewProjectColor(PRESET_COLORS[0]);
    } catch (err) {
      console.error('[Sidebar] create project error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleNewProjectKeyDown = (e) => {
    if (e.key === 'Enter') handleCreateProject();
    if (e.key === 'Escape') {
      setShowNewProject(false);
      setNewProjectName('');
    }
  };

  const totalTaskCount = (p) =>
    (p.task_counts?.todo ?? 0) + (p.task_counts?.in_progress ?? 0) + (p.task_counts?.done ?? 0);

  return (
    <aside className="fixed top-0 left-0 h-screen w-[220px] z-40 bg-white border-r border-[#e4e4e0] flex flex-col">
      {/* Workspace Switcher */}
      <Popover open={wsOpen} onOpenChange={setWsOpen}>
        <PopoverTrigger asChild>
          <button className="h-14 flex items-center gap-2.5 px-4 border-b border-[#e4e4e0] w-full hover:bg-[#f4f4f2] transition-colors text-left">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">
                {activeWorkspace?.name?.[0]?.toUpperCase() ?? 'S'}
              </span>
            </div>
            <span className="text-[14px] font-semibold text-gray-900 truncate flex-1">
              {activeWorkspace?.name ?? 'Loading…'}
            </span>
            <ChevronsUpDown size={13} className="text-[#8a8a85] shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-1.5" align="start" side="bottom">
          <p className="text-[10px] font-semibold text-[#8a8a85] uppercase tracking-widest px-2 py-1">Workspaces</p>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { setActiveWorkspace(ws); setWsOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                ws.id === activeWorkspace?.id
                  ? 'bg-violet-50 text-violet-700 font-medium'
                  : 'text-gray-700 hover:bg-[#f4f4f2]'
              }`}
            >
              <Building2 size={13} />
              {ws.name}
              {ws.id === activeWorkspace?.id && <Check size={12} className="ml-auto" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Project List */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <p className="text-[10px] font-semibold text-[#8a8a85] uppercase tracking-widest px-3 mb-1.5">Projects</p>

        {projects.map((p) => {
          const isActive = activeProject?.id === p.id;
          const count = totalTaskCount(p);
          return (
            <button
              key={p.id}
              onClick={() => setActiveProject(p)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 text-sm font-medium transition-colors duration-100 text-left ${
                isActive
                  ? 'text-gray-900'
                  : 'text-[#4a4a45] hover:bg-[#f4f4f2] hover:text-gray-900'
              }`}
              style={isActive ? { backgroundColor: `${p.color}18` } : {}}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="flex-1 truncate">{p.name}</span>
              {count > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-medium">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}

        {/* Inline new project */}
        {showNewProject ? (
          <div className="px-2 mt-1">
            <Input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={handleNewProjectKeyDown}
              placeholder="Project name…"
              disabled={isCreating}
              className="h-7 text-xs mb-2 border-[#e4e4e0] focus-visible:ring-violet-300"
            />
            {/* Color swatches */}
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewProjectColor(color)}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110 relative"
                  style={{ backgroundColor: color }}
                >
                  {newProjectColor === color && (
                    <Check size={10} className="absolute inset-0 m-auto text-white" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                onClick={handleCreateProject}
                disabled={isCreating || !newProjectName.trim()}
                className="h-6 text-[11px] px-2 bg-[#1a1a1a] hover:bg-[#333] text-white"
              >
                <Check size={10} className="mr-1" />
                {isCreating ? 'Creating…' : 'Create'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowNewProject(false); setNewProjectName(''); }}
                className="h-6 text-[11px] px-2 text-[#8a8a85]"
              >
                <X size={10} />
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNewProject(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#8a8a85] hover:text-gray-700 hover:bg-[#f4f4f2] rounded-lg transition-colors mt-0.5"
          >
            <Plus size={12} />
            New Project
          </button>
        )}

        {/* Bottom nav */}
        <div className="mt-4 border-t border-[#e4e4e0] pt-3">
          {BOTTOM_NAV.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-[#4a4a45] hover:bg-[#f4f4f2] hover:text-gray-900'
                }`}
              >
                <Icon size={15} className={active ? 'text-violet-600' : 'text-[#8a8a85]'} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User */}
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
