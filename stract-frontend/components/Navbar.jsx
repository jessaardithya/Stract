'use client';

import { useState, useEffect } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  LayoutDashboard,
  Settings,
  Plus,
  Check,
  X,
  ChevronsUpDown,
  Building2,
  Loader2,
  Globe,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  createProject,
  createWorkspace,
  updateProject,
  deleteProject,
  updateWorkspace,
  deleteWorkspace,
} from '@/lib/api';
import { deriveSlug } from '@/utils/slug';

const PRESET_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#6b7280',
];

const BOTTOM_NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

import { useRouter } from 'next/navigation';

// ... (imports will be fixed in a subsequent cleanup if needed, but assuming standard layout, we just add to the existing imports)

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter(); // [NEW] routing fix
  const {
    activeWorkspace, activeProject, workspaces, projects,
    setActiveWorkspace, setActiveProject, addWorkspace, refreshProjects,
  } = useApp();

  // Project form (Creation)
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  // Project Settings (Edit/Delete)
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectColor, setEditProjectColor] = useState('');
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const openProjectSettings = (e) => {
    e.stopPropagation();
    if (activeProject) {
      setEditProjectName(activeProject.name);
      setEditProjectColor(activeProject.color);
      setProjectSettingsOpen(true);
    }
  };

  const handleUpdateProject = async () => {
    const trimmed = editProjectName.trim();
    if (!trimmed || !activeWorkspace || !activeProject) return;
    setIsUpdatingProject(true);
    try {
      await updateProject(activeWorkspace.id, activeProject.id, { name: trimmed, color: editProjectColor });
      await refreshProjects();
      setProjectSettingsOpen(false);
    } catch (err) {
      console.error('[Sidebar] update project error:', err);
    } finally {
      setIsUpdatingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!activeWorkspace || !projectToDelete) return;
    setIsDeletingProject(true);
    try {
      await deleteProject(activeWorkspace.id, projectToDelete.id);
      await refreshProjects();
      setProjectToDelete(null);
      setProjectSettingsOpen(false);
    } catch (err) {
      console.error('[Sidebar] delete project error:', err);
    } finally {
      setIsDeletingProject(false);
    }
  };

  // ... (rest of sidebar functionality)

  // Auto-open project form when there are no projects
  useEffect(() => {
    if (activeWorkspace && projects.length === 0) {
      setShowNewProject(true);
    }
  }, [activeWorkspace, projects.length]);

  // Workspace switcher popover ... (exists)
  const [wsOpen, setWsOpen] = useState(false);

  // New workspace dialog ... (exists)
  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsSlug, setWsSlug] = useState('');
  const [wsSlugManuallyEdited, setWsSlugManuallyEdited] = useState(false);
  const [wsSlugError, setWsSlugError] = useState('');
  const [wsCreating, setWsCreating] = useState(false);

  // ... (workspace handlers omitted for brevity, will replace carefully below)


  // Workspace Settings (Edit/Delete)
  const [wsSettingsOpen, setWsSettingsOpen] = useState(false);
  const [editWsName, setEditWsName] = useState('');
  const [isUpdatingWs, setIsUpdatingWs] = useState(false);
  const [wsDeleteAlertOpen, setWsDeleteAlertOpen] = useState(false);
  const [isDeletingWs, setIsDeletingWs] = useState(false);

  const openWsSettings = (e) => {
    e.stopPropagation();
    if (activeWorkspace) {
      setEditWsName(activeWorkspace.name);
      setWsSettingsOpen(true);
      setWsOpen(false);
    }
  };

  const handleUpdateWorkspace = async () => {
    const trimmed = editWsName.trim();
    if (!trimmed || !activeWorkspace) return;
    setIsUpdatingWs(true);
    try {
      const result = await updateWorkspace(activeWorkspace.id, { name: trimmed });
      // Update the workspace in the local context list by re-fetching or mutating
      // Easiest is to force a re-boot or just update the current one in place
      // For now, since AppContext handles boot, we can just reload the page or 
      // rely on the user to see it reflected on next boot. 
      // Better: we update the activeWorkspace directly, but AppContext `workspaces` needs updating.
      // Let's reload to keep context perfectly synced for this basic version:
      window.location.reload();
    } catch (err) {
      console.error('[Sidebar] update workspace error:', err);
    } finally {
      setIsUpdatingWs(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace) return;
    setIsDeletingWs(true);
    try {
      await deleteWorkspace(activeWorkspace.id);
      localStorage.removeItem('activeWorkspaceId');
      localStorage.removeItem('activeProjectId');
      window.location.reload(); // AppContext boot sequence will gracefully handle the empty state
    } catch (err) {
      console.error('[Sidebar] delete workspace error:', err);
    } finally {
      setIsDeletingWs(false);
    }
  };

  const handleWsNameChange = (e) => {
    setWsName(e.target.value);
    if (!wsSlugManuallyEdited) {
      setWsSlug(deriveSlug(e.target.value));
      setWsSlugError('');
    }
  };
  const handleWsSlugChange = (e) => {
    setWsSlugManuallyEdited(true);
    setWsSlug(deriveSlug(e.target.value));
    setWsSlugError('');
  };
  const handleWsDialogClose = () => {
    setWsDialogOpen(false);
    setWsName('');
    setWsSlug('');
    setWsSlugManuallyEdited(false);
    setWsSlugError('');
  };
  const handleCreateWorkspace = async () => {
    const trimmedName = wsName.trim();
    const trimmedSlug = wsSlug.trim();
    if (!trimmedName || !trimmedSlug || wsCreating) return;
    setWsCreating(true);
    setWsSlugError('');
    try {
      const result = await createWorkspace({ name: trimmedName, slug: trimmedSlug });
      handleWsDialogClose();
      await addWorkspace(result.data);
    } catch (err) {
      if (err.message?.toLowerCase().includes('slug') || err.message?.toLowerCase().includes('taken')) {
        setWsSlugError('This URL is already taken');
      } else {
        setWsSlugError(err.message || 'Something went wrong');
      }
    } finally {
      setWsCreating(false);
    }
  };

  // Project creation
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
      router.push('/');
    } catch (err) {
      console.error('[Sidebar] create project error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleNewProjectKeyDown = (e) => {
    if (e.key === 'Enter') handleCreateProject();
    if (e.key === 'Escape' && projects.length > 0) {
      setShowNewProject(false);
      setNewProjectName('');
    }
  };

  const totalTaskCount = (p) =>
    (p.task_counts?.todo ?? 0) + (p.task_counts?.in_progress ?? 0) + (p.task_counts?.done ?? 0);

  return (
    <>
      <aside className="fixed top-0 left-0 h-screen w-[220px] z-40 bg-white border-r border-[#e4e4e0] flex flex-col">
        {/* Workspace Switcher */}
        <div className="h-14 flex items-center border-b border-[#e4e4e0] w-full group/wsheader">
          <Popover open={wsOpen} onOpenChange={setWsOpen}>
            <PopoverTrigger className="flex-1 flex items-center gap-2.5 pl-4 pr-1 h-full hover:bg-[#f4f4f2] transition-colors text-left outline-none cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">
                  {activeWorkspace?.name?.[0]?.toUpperCase() ?? 'S'}
                </span>
              </div>
              <span className="text-[14px] font-semibold text-gray-900 truncate flex-1">
                {activeWorkspace?.name ?? 'Loading…'}
              </span>
              <ChevronsUpDown size={13} className="text-[#8a8a85] shrink-0" />
            </PopoverTrigger>
            <button
              onClick={openWsSettings}
              className="px-3 h-full flex items-center justify-center text-[#8a8a85] opacity-0 group-hover/wsheader:opacity-100 hover:text-gray-900 transition-all outline-none"
              title="Workspace Settings"
            >
              <Settings size={14} />
            </button>
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
                  <span className="truncate">{ws.name}</span>
                  {ws.id === activeWorkspace?.id && <Check size={12} className="ml-auto shrink-0" />}
                </button>
              ))}
              {/* New workspace */}
              <div className="border-t border-[#e4e4e0] mt-1 pt-1">
                <button
                  onClick={() => { setWsOpen(false); setWsDialogOpen(true); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-[#8a8a85] hover:bg-[#f4f4f2] hover:text-gray-700 transition-colors"
                >
                  <Plus size={13} />
                  New Workspace
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Project List */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <p className="text-[10px] font-semibold text-[#8a8a85] uppercase tracking-widest px-3 mb-1.5">Projects</p>

          {projects.map((p) => {
            const isActive = activeProject?.id === p.id;
            const count = totalTaskCount(p);
            return (
              <div key={p.id} className="mb-0.5">
                <button
                  onClick={() => {
                    setActiveProject(p);
                    router.push('/');
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-100 text-left ${
                    isActive
                      ? 'text-gray-900 bg-[#f4f4f2]'
                      : 'text-[#4a4a45] hover:bg-[#f4f4f2] hover:text-gray-900'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  {!isActive && count > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-medium">
                      {count}
                    </Badge>
                  )}
                </button>
                {/* Accordion Expanded State */}
                {isActive && (
                  <div className="pl-6 pr-2 py-1 flex flex-col gap-0.5 border-l-2 ml-4 mt-0.5 mb-2" style={{ borderColor: `${p.color}40` }}>
                    <button
                      onClick={() => router.push('/')}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors ${
                        pathname === '/' ? 'bg-white shadow-sm border border-[#e4e4e0] font-medium text-gray-900' : 'text-[#8a8a85] hover:text-gray-900 hover:bg-[#f4f4f2]'
                      }`}
                    >
                      <LayoutDashboard size={13} className={pathname === '/' ? `text-[${p.color}]` : ''} style={pathname === '/' ? { color: p.color } : {}} />
                      Kanban Board
                    </button>
                    <button
                      onClick={openProjectSettings}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-[#8a8a85] hover:text-gray-900 hover:bg-[#f4f4f2] transition-colors"
                    >
                      <Settings size={13} />
                      Project Settings
                    </button>
                  </div>
                )}
              </div>
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
                  {isCreating ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} className="mr-1" />}
                  {isCreating ? 'Creating…' : 'Create'}
                </Button>
                {projects.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowNewProject(false); setNewProjectName(''); }}
                    className="h-6 text-[11px] px-2 text-[#8a8a85]"
                  >
                    <X size={10} />
                  </Button>
                )}
              </div>
              {projects.length === 0 && (
                <p className="text-xs text-gray-400 mt-3">You can always add more projects later.</p>
              )}
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

      {/* New Workspace Dialog */}
      <Dialog open={wsDialogOpen} onOpenChange={(open) => { if (!open) handleWsDialogClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a new workspace</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Workspace name */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Workspace name</label>
              <Input
                autoFocus
                value={wsName}
                onChange={handleWsNameChange}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
                placeholder="e.g. My Team"
                disabled={wsCreating}
                className="border-[#e4e4e0] focus-visible:ring-violet-300"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Workspace URL</label>
              <div className="flex items-center rounded-lg border border-[#e4e4e0] overflow-hidden focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400 transition-all">
                <div className="flex items-center gap-1.5 pl-3 pr-2 py-2 bg-[#f4f4f2] border-r border-[#e4e4e0] shrink-0">
                  <Globe size={13} className="text-[#8a8a85]" />
                  <span className="text-sm text-gray-400 whitespace-nowrap">stract.app /</span>
                </div>
                <input
                  value={wsSlug}
                  onChange={handleWsSlugChange}
                  placeholder="my-team"
                  disabled={wsCreating}
                  className="flex-1 px-3 py-2 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-400"
                />
              </div>
              {wsSlugError && (
                <p className="text-sm text-red-500 mt-1.5">{wsSlugError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleWsDialogClose} disabled={wsCreating}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              disabled={!wsName.trim() || !wsSlug.trim() || wsCreating}
              className="bg-[#1a1a1a] hover:bg-[#333] text-white"
            >
              {wsCreating ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  Creating…
                </>
              ) : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Project Settings Dialog */}
      <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Project Name</label>
              <Input
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateProject()}
                disabled={isUpdatingProject}
                className="border-[#e4e4e0] focus-visible:ring-violet-300"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Color</label>
              <div className="flex items-center gap-2 flex-wrap bg-[#f4f4f2] p-2 rounded-lg border border-[#e4e4e0]">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setEditProjectColor(color)}
                    className="w-6 h-6 rounded-full transition-transform hover:scale-110 relative border border-black/10 shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {editProjectColor === color && <Check size={12} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-[#e4e4e0] mt-4">
              <label className="text-sm font-medium text-red-600 block mb-1.5">Danger Zone</label>
              <button
                onClick={() => setProjectToDelete(activeProject)}
                className="w-full flex items-center justify-center gap-2 px-3 h-9 rounded-md text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200"
              >
                Delete Project
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProjectSettingsOpen(false)} disabled={isUpdatingProject}>Cancel</Button>
            <Button onClick={handleUpdateProject} disabled={!editProjectName.trim() || isUpdatingProject} className="bg-[#1a1a1a] hover:bg-[#333] text-white">
              {isUpdatingProject ? <Loader2 size={14} className="mr-2 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirm */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the <strong>{projectToDelete?.name}</strong> project and all of its tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingProject}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteProject(); }}
              disabled={isDeletingProject}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeletingProject ? <Loader2 size={14} className="mr-2 animate-spin" /> : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Workspace Settings Dialog */}
      <Dialog open={wsSettingsOpen} onOpenChange={setWsSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Workspace Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Workspace Name</label>
              <Input
                value={editWsName}
                onChange={(e) => setEditWsName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateWorkspace()}
                disabled={isUpdatingWs}
                className="border-[#e4e4e0] focus-visible:ring-violet-300"
              />
              <p className="text-xs text-gray-500 mt-1.5">Note: Workspace URL cannot be changed after creation.</p>
            </div>
            
            <div className="pt-4 border-t border-[#e4e4e0] mt-4">
              <label className="text-sm font-medium text-red-600 block mb-1.5">Danger Zone</label>
              <p className="text-xs text-gray-500 mb-3">Deleting a workspace will immediately delete all of its projects and tasks. This cannot be undone.</p>
              <button
                onClick={() => setWsDeleteAlertOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 h-9 rounded-md text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200"
              >
                Delete Workspace
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWsSettingsOpen(false)} disabled={isUpdatingWs}>Cancel</Button>
            <Button onClick={handleUpdateWorkspace} disabled={!editWsName.trim() || isUpdatingWs} className="bg-[#1a1a1a] hover:bg-[#333] text-white">
              {isUpdatingWs ? <Loader2 size={14} className="mr-2 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Workspace Confirm */}
      <AlertDialog open={wsDeleteAlertOpen} onOpenChange={setWsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the <strong>{activeWorkspace?.name}</strong> workspace, all of its projects, and all tasks within them. This action is destructive and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingWs}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteWorkspace(); }}
              disabled={isDeletingWs}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeletingWs ? <Loader2 size={14} className="mr-2 animate-spin" /> : 'Delete Workspace'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
