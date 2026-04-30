  "use client";

  import { useState, useEffect } from "react";
  import Link from "next/link";
  import { usePathname, useRouter } from "next/navigation";
  import { supabase, getCurrentUser } from "@/lib/supabase";
  import { Avatar, AvatarFallback } from "@/components/ui/avatar";
  import { Input } from "@/components/ui/input";
  import { Button } from "@/components/ui/button";
  import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "@/components/ui/popover";
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
  } from "@/components/ui/dialog";
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "@/components/ui/alert-dialog";
  import {
    House,
    LayoutDashboard,
    Settings,
    Plus,
    Check,
    X,
    ChevronsUpDown,
    Building2,
    Loader2,
    Globe,
    LogOut,
    LayoutList,
    AlertTriangle,
    BarChart2,
    Trash2,
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    CalendarRange,
    LayoutTemplate,
    NotebookText,
    FileInput,
    Paperclip,
    User,
  } from "lucide-react";
  import ApplyProjectTemplate from "@/components/templates/ApplyProjectTemplate";
  import { useApp } from "@/context/AppContext";
  import {
    createProject,
    createWorkspace,
    getProjectTemplate,
    getProjectTemplates,
    updateProject,
    deleteProject,
    updateWorkspace,
    deleteWorkspace,
    getMembers,
    removeWorkspaceMember,
  } from "@/lib/api";
  import { deriveSlug } from "@/utils/slug";
  import type { Workspace, Project, WorkspaceMember, ProjectTemplate, ProjectTemplateListItem } from "@/types";

  const PRESET_COLORS = [
    "#6366f1",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#6b7280",
  ];

  const ACTIVE_WORKSPACE_ID_KEY = "activeWorkspaceId";
  const ACTIVE_PROJECT_ID_KEY = "activeProjectId";
  const LAST_USED_WORKSPACE_ID_KEY = "lastUsedWorkspaceId";
  const FORCE_WORKSPACE_HOME_KEY = "forceWorkspaceHome";

  const BOTTOM_NAV = [
    { href: "/home", label: "Home", Icon: House },
    { href: "/dashboard", label: "Reports", Icon: BarChart2 },
    { href: "/templates", label: "Templates", Icon: LayoutTemplate },
    { href: "/settings", label: "Settings", Icon: Settings },
  ];

  export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const pathname = usePathname();
    const router = useRouter(); // [NEW] routing fix
    const {
      activeWorkspace,
      activeProject,
      workspaces,
      projects,
      setActiveWorkspace,
      setActiveProject,
      addWorkspace,
      refreshProjects,
    } = useApp();

    // Project form (Creation)
    const [showNewProject, setShowNewProject] = useState<boolean>(false);
    const [newProjectMode, setNewProjectMode] = useState<"menu" | "blank">("menu");
    const [newProjectName, setNewProjectName] = useState<string>("");
    const [newProjectDescription, setNewProjectDescription] = useState<string>("");
    const [newProjectColor, setNewProjectColor] = useState<string>(PRESET_COLORS[0]);
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [projectTemplatesOpen, setProjectTemplatesOpen] = useState<boolean>(false);
    const [projectTemplatesLoading, setProjectTemplatesLoading] = useState<boolean>(false);
    const [projectTemplates, setProjectTemplates] = useState<ProjectTemplateListItem[]>([]);
    const [selectedProjectTemplate, setSelectedProjectTemplate] = useState<ProjectTemplate | null>(null);
    const [applyProjectTemplateOpen, setApplyProjectTemplateOpen] = useState<boolean>(false);

    // Project Settings (Edit/Delete)
    const [projectSettingsOpen, setProjectSettingsOpen] = useState<boolean>(false);
    const [editProjectName, setEditProjectName] = useState<string>("");
    const [editProjectDescription, setEditProjectDescription] = useState<string>("");
    const [editProjectColor, setEditProjectColor] = useState<string>("");
    const [isUpdatingProject, setIsUpdatingProject] = useState<boolean>(false);
    const [projectDeleteError, setProjectDeleteError] = useState<string>("");
    const [isDeletingProject, setIsDeletingProject] = useState<boolean>(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

    const openProjectSettings = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (activeProject) {
        setEditProjectName(activeProject.name);
        setEditProjectDescription(activeProject.description || "");
        setEditProjectColor(activeProject.color);
        setProjectSettingsOpen(true);
      }
    };

    const handleUpdateProject = async () => {
      const trimmed = editProjectName.trim();
      if (!trimmed || !activeWorkspace || !activeProject) return;
      setIsUpdatingProject(true);
      try {
        await updateProject(activeWorkspace.id, activeProject.id, {
          name: trimmed,
          description: editProjectDescription.trim(),
          color: editProjectColor,
        });
        await refreshProjects();
        setProjectSettingsOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error("[Sidebar] update project error:", message);
      } finally {
        setIsUpdatingProject(false);
      }
    };

    // const handleDeleteProject = async () => {
    //   if (!activeWorkspace || !projectToDelete) return;
    //   setIsDeletingProject(true);
    //   setProjectDeleteError("");
    //   try {
    //     await deleteProject(activeWorkspace.id, projectToDelete.id);
    //     await refreshProjects();
    //     setProjectToDelete(null);
    //     setProjectSettingsOpen(false);
    //   } catch (err) {
    //     console.error("[Sidebar] delete project error:", err);
    //     setProjectDeleteError(err.message || "Failed to delete project.");
    //   } finally {
    //     setIsDeletingProject(false);
    //   }
    // };

    const handleDeleteProject = async () => {
      if (!activeWorkspace || !projectToDelete) return;
      setIsDeletingProject(true);
      setProjectDeleteError("");

      try {
        await deleteProject(activeWorkspace.id, projectToDelete.id);
        setProjectToDelete(null);
        setProjectSettingsOpen(false);
        await refreshProjects();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        // ✅ Only log unexpected errors to console
        const isExpectedError =
          message.toLowerCase().includes("cannot delete") ||
          message.toLowerCase().includes("contains") ||
          message.toLowerCase().includes("tasks first");

        if (!isExpectedError) {
          console.error("[Sidebar] delete project error:", message);
        }

        // Always show user-friendly message in UI
        setProjectDeleteError(
          message || "Failed to delete project. Please try again.",
        );
      } finally {
        setIsDeletingProject(false);
      }
    };
    // ... (rest of sidebar functionality)

    // Auto-open project form when there are no projects
    useEffect(() => {
      if (activeWorkspace && projects.length === 0) {
        setShowNewProject(true);
        setNewProjectMode("menu");
      }
    }, [activeWorkspace, projects.length]);

    // Workspace switcher popover ... (exists)
    const [wsOpen, setWsOpen] = useState<boolean>(false);

    // New workspace dialog ... (exists)
    const [wsDialogOpen, setWsDialogOpen] = useState<boolean>(false);
    const [wsName, setWsName] = useState<string>("");
    const [wsDescription, setWsDescription] = useState<string>("");
    const [wsSlug, setWsSlug] = useState<string>("");
    const [wsSlugManuallyEdited, setWsSlugManuallyEdited] = useState<boolean>(false);
    const [wsSlugError, setWsSlugError] = useState<string>("");
    const [wsCreating, setWsCreating] = useState<boolean>(false);

    // ... (workspace handlers omitted for brevity, will replace carefully below)

    // Workspace Settings (Edit/Delete)
    const [wsSettingsOpen, setWsSettingsOpen] = useState<boolean>(false);
    const [editWsName, setEditWsName] = useState<string>("");
    const [wsMembers, setWsMembers] = useState<WorkspaceMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
    const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;
      if (wsSettingsOpen && activeWorkspace) {
        setIsLoadingMembers(true);
        Promise.all([
          getMembers(activeWorkspace.id),
          supabase.auth.getUser()
        ]).then(([res, userRes]) => {
          if (cancelled) return;
          setWsMembers(Array.isArray(res) ? res : res.data || []);
          setCurrentUserId(userRes.data.user?.id || null);
        }).catch(err => {
          if (!cancelled) console.error("Failed to fetch members", err);
        }).finally(() => {
          if (!cancelled) setIsLoadingMembers(false);
        });
      } else {
        setWsMembers([]);
      }
      return () => { cancelled = true; };
    }, [wsSettingsOpen, activeWorkspace]);

    const handleRemoveMember = async (memberId: string) => {
      if (!activeWorkspace) return;
      setRemovingMemberId(memberId);
      try {
         await removeWorkspaceMember(activeWorkspace.id, memberId);
         setWsMembers(prev => prev.filter(m => m.id !== memberId));
      } catch (err) {
         console.error("Failed to remove member", err);
      } finally {
         setRemovingMemberId(null);
      }
    };
    const [editWsDescription, setEditWsDescription] = useState<string>("");
    const [isUpdatingWs, setIsUpdatingWs] = useState<boolean>(false);
    const [wsDeleteAlertOpen, setWsDeleteAlertOpen] = useState<boolean>(false);
    const [wsDeleteError, setWsDeleteError] = useState<string>("");
    const [isDeletingWs, setIsDeletingWs] = useState<boolean>(false);
    const [accountOpen, setAccountOpen] = useState<boolean>(false);
    const [currentUser, setCurrentUser] = useState<{ name: string | null; avatar_url: string | null; email: string } | null>(null);

    useEffect(() => {
      getCurrentUser().then((user) => {
        if (user) setCurrentUser({ name: user.name, avatar_url: user.avatar_url, email: user.email });
      }).catch(() => {});
    }, []);

    const openWsSettings = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (activeWorkspace) {
        setEditWsName(activeWorkspace.name);
        setEditWsDescription(activeWorkspace.description || "");
        setWsSettingsOpen(true);
        setWsOpen(false);
      }
    };

    const handleSignOut = async () => {
      await supabase.auth.signOut();
      localStorage.removeItem(ACTIVE_WORKSPACE_ID_KEY);
      localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
      localStorage.removeItem(LAST_USED_WORKSPACE_ID_KEY);
      window.sessionStorage.removeItem(FORCE_WORKSPACE_HOME_KEY);
      setAccountOpen(false);
      window.location.href = "/login";
    };

    const handleUpdateWorkspace = async () => {
      const trimmed = editWsName.trim();
      if (!trimmed || !activeWorkspace) return;
      setIsUpdatingWs(true);
      try {
        const result = await updateWorkspace(activeWorkspace.id, {
          name: trimmed,
          description: editWsDescription.trim(),
        });
        // Update the workspace in the local context list by re-fetching or mutating
        // Easiest is to force a re-boot or just update the current one in place
        // For now, since AppContext handles boot, we can just reload the page or
        // rely on the user to see it reflected on next boot.
        // Better: we update the activeWorkspace directly, but AppContext `workspaces` needs updating.
        // Let's reload to keep context perfectly synced for this basic version:
        window.location.reload();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error("[Sidebar] update workspace error:", message);
      } finally {
        setIsUpdatingWs(false);
      }
    };

    // const handleDeleteWorkspace = async () => {
    //   if (!activeWorkspace) return;
    //   setIsDeletingWs(true);
    //   setWsDeleteError("");
    //   try {
    //     await deleteWorkspace(activeWorkspace.id);
    //     localStorage.removeItem("activeWorkspaceId");
    //     localStorage.removeItem("activeProjectId");
    //     window.location.reload(); // AppContext boot sequence will gracefully handle the empty state
    //   } catch (err) {
    //     console.error("[Sidebar] delete workspace error:", err);
    //     setWsDeleteError(
    //       err.message || "Failed to delete workspace. Please try again.",
    //     );
    //   } finally {
    //     setIsDeletingWs(false);
    //   }
    // };
    const handleDeleteWorkspace = async () => {
      if (!activeWorkspace) return;
      setIsDeletingWs(true);
      setWsDeleteError("");

      try {
        await deleteWorkspace(activeWorkspace.id);
        localStorage.removeItem(ACTIVE_WORKSPACE_ID_KEY);
        localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
        localStorage.removeItem(LAST_USED_WORKSPACE_ID_KEY);
        window.sessionStorage.removeItem(FORCE_WORKSPACE_HOME_KEY);
        window.location.reload();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        // ✅ Only log unexpected errors to console
        const isExpectedError =
          message.toLowerCase().includes("cannot delete") ||
          message.toLowerCase().includes("contains") ||
          message.toLowerCase().includes("projects first");

        if (!isExpectedError) {
          console.error("[Sidebar] delete workspace error:", message);
        }

        // Always show user-friendly message in UI
        setWsDeleteError(
          message || "Failed to delete workspace. Please try again.",
        );
      } finally {
        setIsDeletingWs(false);
      }
    };
    const handleWsNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setWsName(e.target.value);
      if (!wsSlugManuallyEdited) {
        setWsSlug(deriveSlug(e.target.value));
        setWsSlugError("");
      }
    };
    const handleWsSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setWsSlugManuallyEdited(true);
      setWsSlug(deriveSlug(e.target.value));
      setWsSlugError("");
    };
    const handleWsDialogClose = () => {
      setWsDialogOpen(false);
      setWsName("");
      setWsDescription("");
      setWsSlug("");
      setWsSlugManuallyEdited(false);
      setWsSlugError("");
    };
    const handleCreateWorkspace = async () => {
      const trimmedName = wsName.trim();
      const trimmedSlug = wsSlug.trim();
      if (!trimmedName || !trimmedSlug || wsCreating) return;
      setWsCreating(true);
      setWsSlugError("");
      try {
        const result = await createWorkspace({
          name: trimmedName,
          slug: trimmedSlug,
          description: wsDescription.trim(),
        });
        handleWsDialogClose();
        await addWorkspace(result.data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        if (
          message.toLowerCase().includes("slug") ||
          message.toLowerCase().includes("taken")
        ) {
          setWsSlugError("This URL is already taken");
        } else {
          setWsSlugError(message);
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
        const result = await createProject(activeWorkspace.id, {
          name,
          description: newProjectDescription.trim(),
          color: newProjectColor,
        });
        await refreshProjects();
        setActiveProject(result.data);
        setShowNewProject(false);
        setNewProjectMode("menu");
        setNewProjectName("");
        setNewProjectDescription("");
        setNewProjectColor(PRESET_COLORS[0]);
        router.push("/");
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error("[Sidebar] create project error:", message);
      } finally {
        setIsCreating(false);
      }
    };

    const handleNewProjectKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleCreateProject();
      if (e.key === "Escape" && projects.length > 0) {
        setShowNewProject(false);
        setNewProjectMode("menu");
        setNewProjectName("");
        setNewProjectDescription("");
      }
    };

    const handleOpenProjectTemplates = async () => {
      if (!activeWorkspace?.id) return;
      setProjectTemplatesOpen(true);
      setProjectTemplatesLoading(true);
      try {
        const result = await getProjectTemplates(activeWorkspace.id);
        setProjectTemplates(result.data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[Sidebar] load project templates error:", message);
      } finally {
        setProjectTemplatesLoading(false);
      }
    };

    const handleChooseProjectTemplate = async (templateId: string) => {
      if (!activeWorkspace?.id) return;
      try {
        const result = await getProjectTemplate(activeWorkspace.id, templateId);
        setSelectedProjectTemplate(result.data);
        setProjectTemplatesOpen(false);
        setApplyProjectTemplateOpen(true);
        setShowNewProject(false);
        setNewProjectMode("menu");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[Sidebar] load project template error:", message);
      }
    };

    const totalTaskCount = (p: Project) =>
      (p.task_counts?.todo ?? 0) +
      (p.task_counts?.['in-progress'] ?? 0) +
      (p.task_counts?.done ?? 0);

    return (
      <>
        <aside
          className={`sticky top-0 h-screen z-40 border-r border-[#e7e1d8] bg-[#fbfaf6] flex flex-col shrink-0 transition-all duration-300 relative ${
            isCollapsed ? "w-[72px]" : "w-[248px]"
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(99,102,241,0.07),rgba(99,102,241,0))] pointer-events-none" />

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute -right-px top-6 h-8 w-7 border border-[#e7e1d8] border-r-0 bg-[#fbfaf6] flex items-center justify-center text-[#8a8a85] hover:text-gray-900 z-50 transition-colors"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Workspace Switcher */}
          <div className="relative border-b border-[#e7e1d8] group/wsheader">
            <Popover open={wsOpen} onOpenChange={setWsOpen}>
              <div className="flex items-stretch">
              <PopoverTrigger
                className={`flex flex-1 items-center text-left outline-none cursor-pointer transition-colors hover:bg-white/60 ${
                  isCollapsed ? "justify-center px-0 h-[76px]" : "gap-3 px-4 py-4"
                }`}
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center border border-black/[0.07] bg-gradient-to-br from-violet-500 via-violet-500 to-blue-500 text-white shadow-[0_6px_18px_rgba(79,70,229,0.18)]">
                  <span className="text-sm font-semibold">
                    {activeWorkspace?.name?.[0]?.toUpperCase() ?? "S"}
                  </span>
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 flex flex-1 items-center gap-2">
                    <span className="text-[15px] font-semibold text-gray-950 truncate flex-1">
                      {activeWorkspace?.name ?? "Loading…"}
                    </span>
                    <ChevronsUpDown
                      size={13}
                      className="text-[#8a8a85] shrink-0"
                    />
                  </div>
                )}
              </PopoverTrigger>
              {!isCollapsed && (
                <button
                  onClick={openWsSettings}
                  className="px-4 text-[#8a8a85] opacity-0 group-hover/wsheader:opacity-100 hover:text-gray-900 transition-all outline-none"
                  title="Workspace Settings"
                >
                  <Settings size={14} />
                </button>
              )}
              </div>
              <PopoverContent
                className="w-[220px] border-[#e7e1d8] bg-[#fffdf8] p-1.5 shadow-[0_18px_40px_rgba(26,26,26,0.08)]"
                align="start"
                side="bottom"
              >
                <p className="text-[10px] font-semibold text-[#8a8a85] uppercase tracking-widest px-2 py-1">
                  Workspaces
                </p>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setActiveWorkspace(ws);
                      setWsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-2 text-sm transition-colors ${
                      ws.id === activeWorkspace?.id
                        ? "bg-[#f4f1ea] text-gray-950 font-medium"
                        : "text-gray-700 hover:bg-[#f7f4ee]"
                    }`}
                  >
                    <Building2 size={13} className="shrink-0 text-[#8a8a85]" />
                    <span className="truncate">{ws.name}</span>
                    {ws.id === activeWorkspace?.id && (
                      <Check size={12} className="ml-auto shrink-0 text-violet-600" />
                    )}
                  </button>
                ))}
                {/* New workspace */}
                <div className="border-t border-[#e7e1d8] mt-1 pt-1">
                  <button
                    onClick={() => {
                      setWsOpen(false);
                      setWsDialogOpen(true);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-2 text-sm text-[#5d5a54] hover:bg-[#f7f4ee] hover:text-gray-900 transition-colors"
                  >
                    <Plus size={13} />
                    New Workspace
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <nav className={`flex-1 overflow-y-auto ${isCollapsed ? "px-2 py-4" : "px-3 py-4"}`}>
            {!isCollapsed ? (
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold text-[#8a8a85] uppercase tracking-[0.22em] transition-all">
                  Projects
                </p>
                <span className="text-[11px] text-[#8a8a85]">{projects.length}</span>
              </div>
            ) : (
              <div className="mb-2 h-4" />
            )}

            <div className="space-y-1">
            {projects.map((p) => {
              const isActive = activeProject?.id === p.id;
              const count = totalTaskCount(p);
              return (
                <div key={p.id}>
                  <button
                    onClick={() => {
                      setActiveProject(p);
                      router.push("/");
                    }}
                    className={`group relative flex items-center text-left transition-colors ${
                      isCollapsed
                        ? "mx-auto h-11 w-11 justify-center"
                        : "min-h-[42px] w-full gap-3 px-3 py-2"
                    } text-sm font-medium ${
                      isActive
                        ? "text-gray-950 bg-white/75"
                        : "text-[#4f4a43] hover:bg-white/55 hover:text-gray-950"
                    }`}
                    style={
                      isActive
                        ? { boxShadow: `inset 2px 0 0 ${p.color}` }
                        : undefined
                    }
                    title={isCollapsed ? p.name : undefined}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    {!isCollapsed && (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{p.name}</p>
                          {isActive && (
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#8a8a85]">
                              Active project
                            </p>
                          )}
                        </div>
                        {count > 0 && (
                          <span className="shrink-0 text-[11px] font-medium text-[#8a8a85]">
                            {count}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                  {/* Accordion Expanded State */}
                  {isActive && !isCollapsed && (
                    <div
                      className="ml-5 mt-1 mb-3 flex flex-col gap-0.5 border-l pl-4"
                      style={{ borderColor: `${p.color}30` }}
                    >
                      <button
                        onClick={() => router.push("/")}
                        className={`relative w-full flex items-center gap-2 py-1.5 pr-2 pl-3 text-[12px] transition-colors ${
                          pathname === "/"
                            ? "font-medium text-gray-950"
                            : "text-[#8a8a85] hover:text-gray-950"
                        }`}
                      >
                        {pathname === "/" && (
                          <span
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2"
                            style={{ backgroundColor: p.color }}
                          />
                        )}
                        <LayoutDashboard
                          size={13}
                          className="shrink-0"
                          style={pathname === "/" ? { color: p.color } : undefined}
                        />
                        Kanban Board
                      </button>
                      <button
                        onClick={() => router.push("/list")}
                        className={`relative w-full flex items-center gap-2 py-1.5 pr-2 pl-3 text-[12px] transition-colors ${
                          pathname === "/list"
                            ? "font-medium text-gray-950"
                            : "text-[#8a8a85] hover:text-gray-950"
                        }`}
                      >
                        {pathname === "/list" && (
                          <span
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2"
                            style={{ backgroundColor: p.color }}
                          />
                        )}
                        <LayoutList
                          size={13}
                          className="shrink-0"
                          style={pathname === "/list" ? { color: p.color } : undefined}
                        />
                        List View
                      </button>
                      <button
                        onClick={() => router.push("/timeline")}
                        className={`relative w-full flex items-center gap-2 py-1.5 pr-2 pl-3 text-[12px] transition-colors ${
                          pathname === "/timeline"
                            ? "font-medium text-gray-950"
                            : "text-[#8a8a85] hover:text-gray-950"
                        }`}
                      >
                        {pathname === "/timeline" && (
                          <span
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2"
                            style={{ backgroundColor: p.color }}
                          />
                        )}
                        <CalendarDays
                          size={13}
                          className="shrink-0"
                          style={pathname === "/timeline" ? { color: p.color } : undefined}
                        />
                        Timeline
                      </button>
                      <button
                        onClick={() => router.push("/calendar")}
                        className={`relative w-full flex items-center gap-2 py-1.5 pr-2 pl-3 text-[12px] transition-colors ${
                          pathname === "/calendar"
                            ? "font-medium text-gray-950"
                            : "text-[#8a8a85] hover:text-gray-950"
                        }`}
                      >
                        {pathname === "/calendar" && (
                          <span
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2"
                            style={{ backgroundColor: p.color }}
                          />
                        )}
                        <CalendarRange
                          size={13}
                          className="shrink-0"
                          style={pathname === "/calendar" ? { color: p.color } : undefined}
                        />
                        Calendar
                      </button>
                      <button
                        onClick={() => router.push("/meetings")}
                        className={`relative w-full flex items-center gap-2 py-1.5 pr-2 pl-3 text-[12px] transition-colors ${
                          pathname === "/meetings"
                            ? "font-medium text-gray-950"
                            : "text-[#8a8a85] hover:text-gray-950"
                        }`}
                      >
                        {pathname === "/meetings" && (
                          <span
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2"
                            style={{ backgroundColor: p.color }}
                          />
                        )}
                        <NotebookText
                          size={13}
                          className="shrink-0"
                          style={pathname === "/meetings" ? { color: p.color } : undefined}
                        />
                        Meetings
                      </button>
                      <button
                        onClick={() => router.push("/forms")}
                        className={`relative w-full flex items-center gap-2 py-1.5 pr-2 pl-3 text-[12px] transition-colors ${
                          pathname === "/forms"
                            ? "font-medium text-gray-950"
                            : "text-[#8a8a85] hover:text-gray-950"
                        }`}
                      >
                        {pathname === "/forms" && (
                          <span
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2"
                            style={{ backgroundColor: p.color }}
                          />
                        )}
                        <FileInput
                          size={13}
                          className="shrink-0"
                          style={pathname === "/forms" ? { color: p.color } : undefined}
                        />
                        Forms
                      </button>
                      <button
                        onClick={() => router.push("/assets")}
                        className={`relative w-full flex items-center gap-2 py-1.5 pr-2 pl-3 text-[12px] transition-colors ${
                          pathname === "/assets"
                            ? "font-medium text-gray-950"
                            : "text-[#8a8a85] hover:text-gray-950"
                        }`}
                      >
                        {pathname === "/assets" && (
                          <span
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2"
                            style={{ backgroundColor: p.color }}
                          />
                        )}
                        <Paperclip
                          size={13}
                          className="shrink-0"
                          style={pathname === "/assets" ? { color: p.color } : undefined}
                        />
                        Assets
                      </button>
                      <button
                        onClick={openProjectSettings}
                        className="w-full flex items-center gap-2 py-1.5 pr-2 pl-3 text-[12px] text-[#8a8a85] hover:text-gray-950 transition-colors"
                      >
                        <Settings size={13} className="shrink-0" />
                        Project Settings
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            </div>

            {/* Inline new project */}
            {showNewProject && !isCollapsed ? (
              <div className="mt-3 border-t border-[#e7e1d8] pt-3">
                <div className="space-y-2 px-1">
                  {newProjectMode === "menu" ? (
                    <>
                      <button
                        onClick={() => setNewProjectMode("blank")}
                        className="flex w-full items-center justify-between rounded-xl border border-[#ddd7cd] bg-white/85 px-3 py-3 text-left text-[12px] text-[#4f4a43] transition-colors hover:border-[#cfc5b6] hover:bg-white"
                      >
                        <span className="font-medium">Blank project</span>
                        <ChevronRight size={12} className="text-[#8a8a85]" />
                      </button>
                      <button
                        onClick={() => void handleOpenProjectTemplates()}
                        className="flex w-full items-center justify-between rounded-xl border border-[#ddd7cd] bg-white/85 px-3 py-3 text-left text-[12px] text-[#4f4a43] transition-colors hover:border-[#cfc5b6] hover:bg-white"
                      >
                        <span className="font-medium">From template</span>
                        <ChevronRight size={12} className="text-[#8a8a85]" />
                      </button>
                    </>
                  ) : (
                    <>
                <Input
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={handleNewProjectKeyDown}
                  placeholder="Project name…"
                  disabled={isCreating}
                  className="h-8 border-[#ddd7cd] bg-white/85 text-[12px] shadow-none focus-visible:ring-violet-300"
                />
                <Input
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  onKeyDown={handleNewProjectKeyDown}
                  placeholder="Project description (optional)"
                  disabled={isCreating}
                  className="h-8 border-[#ddd7cd] bg-white/85 text-[12px] shadow-none focus-visible:ring-violet-300"
                />
                {/* Color swatches */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewProjectColor(color)}
                      className="relative h-5 w-5 rounded-full transition-transform hover:scale-110"
                      style={{ backgroundColor: color }}
                    >
                      {newProjectColor === color && (
                        <Check
                          size={10}
                          className="absolute inset-0 m-auto text-white"
                        />
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={handleCreateProject}
                    disabled={isCreating || !newProjectName.trim()}
                    className="h-7 bg-[#1a1a1a] px-2.5 text-[11px] text-white hover:bg-[#333]"
                  >
                    {isCreating ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Check size={10} className="mr-1" />
                    )}
                    {isCreating ? "Creating…" : "Create"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewProjectMode("menu")}
                    className="h-7 px-2 text-[11px] text-[#8a8a85]"
                  >
                    Back
                  </Button>
                  {projects.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowNewProject(false);
                        setNewProjectMode("menu");
                        setNewProjectName("");
                        setNewProjectDescription("");
                      }}
                      className="h-7 px-2 text-[11px] text-[#8a8a85]"
                    >
                      <X size={10} />
                    </Button>
                  )}
                </div>
                {projects.length === 0 && (
                  <p className="pt-1 text-[11px] text-[#8a8a85]">
                    Start with one project. You can add more later.
                  </p>
                )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (isCollapsed) setIsCollapsed(false);
                  setShowNewProject(true);
                  setNewProjectMode("menu");
                }}
                className={`mt-3 flex items-center text-[#5d5a54] transition-colors hover:bg-white/55 hover:text-gray-950 ${
                  isCollapsed
                    ? "mx-auto h-11 w-11 justify-center"
                    : "w-full gap-2 px-3 py-2 text-[12px]"
                }`}
                title={isCollapsed ? "New Project" : undefined}
              >
                <Plus size={13} className="shrink-0" />
                {!isCollapsed && <span className="font-medium">New Project</span>}
              </button>
            )}

            <div className="mt-5 border-t border-[#e7e1d8] pt-4">
              {!isCollapsed && (
                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a8a85]">
                  Workspace
                </p>
              )}
              {BOTTOM_NAV.map(({ href, label, Icon }) => {
                const active = pathname === href;
                const opensWorkspaceSettings = label === "Settings";

                if (opensWorkspaceSettings) {
                  return (
                    <button
                      key={href}
                      type="button"
                      title={isCollapsed ? label : undefined}
                      onClick={() => openWsSettings()}
                      className={`relative mb-1 flex items-center transition-colors ${
                        isCollapsed
                          ? "mx-auto h-11 w-11 justify-center"
                          : "w-full gap-3 px-3 py-2 text-sm"
                      } text-[#4f4a43] hover:bg-white/55 hover:text-gray-950`}
                    >
                      <Icon size={15} className="text-[#8a8a85] shrink-0" />
                      {!isCollapsed && <span className="font-medium">{label}</span>}
                    </button>
                  );
                }

                return (
                  <Link
                    key={href}
                    href={href}
                    title={isCollapsed ? label : undefined}
                    className={`relative mb-1 flex items-center transition-colors ${
                      isCollapsed
                        ? "mx-auto h-11 w-11 justify-center"
                        : "w-full gap-3 px-3 py-2 text-sm"
                    } ${
                      active
                        ? "bg-white/75 text-gray-950"
                        : "text-[#4f4a43] hover:bg-white/55 hover:text-gray-950"
                    }`}
                  >
                    {active && !isCollapsed && (
                      <span className="absolute left-0 top-0 h-full w-[2px] bg-violet-500" />
                    )}
                    <Icon
                      size={15}
                      className={
                        active
                          ? "text-violet-600 shrink-0"
                          : "text-[#8a8a85] shrink-0"
                      }
                    />
                    {!isCollapsed && <span className="font-medium">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div
            className={`border-t border-[#e7e1d8] py-3.5 ${
              isCollapsed ? "px-2" : "px-4"
            }`}
          >
            <Popover open={accountOpen} onOpenChange={setAccountOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`w-full transition-colors hover:bg-white/65 ${
                    isCollapsed
                      ? "flex justify-center rounded-xl py-1.5"
                      : "flex items-center gap-3 rounded-2xl px-2 py-2.5 text-left"
                  }`}
                  title={isCollapsed ? "Account actions" : undefined}
                >
                  <Avatar className="h-8 w-8 shrink-0 border border-black/[0.05]">
                    {currentUser?.avatar_url && (
                      <img src={currentUser.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-violet-400 to-blue-400 text-white text-[11px] font-semibold">
                      {(currentUser?.name ?? currentUser?.email ?? 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium leading-tight text-gray-950">
                          {currentUser?.name ?? currentUser?.email ?? '…'}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-[#8a8a85]">
                          Free plan
                        </p>
                      </div>
                      <ChevronsUpDown size={13} className="shrink-0 text-[#8a8a85]" />
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align={isCollapsed ? "center" : "start"}
                side="top"
                className="w-[220px] border-[#e7e1d8] bg-[#fffdf8] p-1.5 shadow-[0_18px_40px_rgba(26,26,26,0.08)]"
              >
                <div className="border-b border-[#e7e1d8] px-2 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a8a85]">
                    Account
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-950">{currentUser?.name ?? currentUser?.email ?? '…'}</p>
                  <p className="text-[11px] text-[#8a8a85]">Free plan</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setAccountOpen(false); router.push('/profile'); }}
                  className="mt-1 flex w-full items-center gap-2 px-2 py-2 text-sm text-[#5d5a54] transition-colors hover:bg-[#f7f4ee] hover:text-gray-950"
                >
                  <User size={13} className="shrink-0 text-[#8a8a85]" />
                  Profile settings
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-2 py-2 text-sm text-[#5d5a54] transition-colors hover:bg-[#f7f4ee] hover:text-gray-950"
                >
                  <LogOut size={13} className="shrink-0 text-[#8a8a85]" />
                  Sign out
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </aside>

        <Dialog open={projectTemplatesOpen} onOpenChange={setProjectTemplatesOpen}>
          <DialogContent className="border-[#e4e4e0] bg-[#fffdf9] sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Create project from template</DialogTitle>
            </DialogHeader>
            <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto">
              {projectTemplatesLoading ? (
                <p className="text-sm text-[#746d62]">Loading templates…</p>
              ) : projectTemplates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d9d2c6] bg-[#fbfaf7] px-4 py-10 text-sm text-[#746d62]">
                  No project templates yet.
                </div>
              ) : (
                projectTemplates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleChooseProjectTemplate(item.id)}
                    className="rounded-xl border border-[#e4e4e0] bg-white px-4 py-4 text-left transition-colors hover:border-[#d4cfc4] hover:bg-[#fffaf3]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <p className="truncate text-sm font-semibold text-[#1f1b17]">{item.name}</p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#746d62]">
                          {item.description?.trim() || "Reusable setup for a new project."}
                        </p>
                      </div>
                      <span className="rounded-full border border-[#ece5d8] bg-[#faf7f1] px-2 py-1 text-[11px] text-[#8f877a]">
                        {item.task_count} tasks
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        <ApplyProjectTemplate
          workspaceId={activeWorkspace?.id ?? ""}
          template={selectedProjectTemplate}
          open={applyProjectTemplateOpen}
          onOpenChange={setApplyProjectTemplateOpen}
          onApplied={async (project) => {
            await refreshProjects();
            setActiveProject(project);
            router.push("/");
          }}
        />

        {/* New Workspace Dialog */}
        <Dialog
          open={wsDialogOpen}
          onOpenChange={(open) => {
            if (!open) handleWsDialogClose();
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create a new workspace</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Workspace name */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Workspace name
                </label>
                <Input
                  autoFocus
                  value={wsName}
                  onChange={handleWsNameChange}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                  placeholder="e.g. My Team"
                  disabled={wsCreating}
                  className="border-[#e4e4e0] focus-visible:ring-violet-300"
                />
              </div>

              {/* Workspace Description */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Description{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input
                  value={wsDescription}
                  onChange={(e) => setWsDescription(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                  placeholder="What is this workspace for?"
                  disabled={wsCreating}
                  className="border-[#e4e4e0] focus-visible:ring-violet-300"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Workspace URL
                </label>
                <div className="flex items-center rounded-lg border border-[#e4e4e0] overflow-hidden focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400 transition-all">
                  <div className="flex items-center gap-1.5 pl-3 pr-2 py-2 bg-[#f4f4f2] border-r border-[#e4e4e0] shrink-0">
                    <Globe size={13} className="text-[#8a8a85]" />
                    <span className="text-sm text-gray-400 whitespace-nowrap">
                      stract.app /
                    </span>
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
              <Button
                variant="ghost"
                onClick={handleWsDialogClose}
                disabled={wsCreating}
              >
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
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Project Settings Dialog */}
        {/* <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Project Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Project Name
                </label>
                <Input
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateProject()}
                  disabled={isUpdatingProject}
                  className="border-[#e4e4e0] focus-visible:ring-violet-300"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Description{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input
                  value={editProjectDescription}
                  onChange={(e) => setEditProjectDescription(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateProject()}
                  placeholder="What is this project?"
                  disabled={isUpdatingProject}
                  className="border-[#e4e4e0] focus-visible:ring-violet-300"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Color
                </label>
                <div className="flex items-center gap-2 flex-wrap bg-[#f4f4f2] p-2 rounded-lg border border-[#e4e4e0]">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditProjectColor(color)}
                      className="w-6 h-6 rounded-full transition-transform hover:scale-110 relative border border-black/10 shadow-sm"
                      style={{ backgroundColor: color }}
                    >
                      {editProjectColor === color && (
                        <Check
                          size={12}
                          className="absolute inset-0 m-auto text-white drop-shadow-sm"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-[#e4e4e0] mt-4">
                <label className="text-sm font-medium text-red-600 block mb-1.5">
                  Danger Zone
                </label>
                <button
                  onClick={() => setProjectToDelete(activeProject)}
                  className="w-full flex items-center justify-center gap-2 px-3 h-9 rounded-md text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200"
                >
                  Delete Project
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setProjectSettingsOpen(false)}
                disabled={isUpdatingProject}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateProject}
                disabled={!editProjectName.trim() || isUpdatingProject}
                className="bg-[#1a1a1a] hover:bg-[#333] text-white"
              >
                {isUpdatingProject ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog> */}

        {/* Project Settings Dialog */}
        <Dialog open={projectSettingsOpen} onOpenChange={setProjectSettingsOpen}>
          <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-black/[0.08] [&>button]:hidden">
            <DialogTitle className="sr-only">Project settings</DialogTitle>
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-0">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: editProjectColor }}
                />
                <div>
                  <h2 className="text-[16px] font-semibold text-zinc-900 tracking-tight leading-snug">
                    Project settings
                  </h2>
                  <p className="text-[12px] text-zinc-400 mt-0.5 font-normal">
                    {activeProject?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProjectSettingsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-black/[0.04]
                          text-zinc-500 hover:bg-black/[0.08] hover:text-zinc-800 transition-colors mt-0.5"
              >
                <X size={12} strokeWidth={2.2} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 pt-5 pb-0 space-y-4">
              {/* Project Name */}
              <div>
                <label className="text-[10px] font-bold tracking-[0.07em] uppercase text-zinc-400 block mb-1.5">
                  Project name
                </label>
                <Input
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateProject()}
                  disabled={isUpdatingProject}
                  className="h-9 text-[13px] border-black/[0.12] rounded-lg shadow-none
                            focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:border-violet-400
                            placeholder:text-zinc-300 transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-bold tracking-[0.07em] uppercase text-zinc-400 block mb-1.5">
                  Description{" "}
                  <span className="text-zinc-300 font-normal normal-case tracking-normal">
                    (optional)
                  </span>
                </label>
                <Input
                  value={editProjectDescription}
                  onChange={(e) => setEditProjectDescription(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateProject()}
                  placeholder="What is this project?"
                  disabled={isUpdatingProject}
                  className="h-9 text-[13px] border-black/[0.12] rounded-lg shadow-none
                            focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:border-violet-400
                            placeholder:text-zinc-300 transition-all"
                />
              </div>

              {/* Color */}
              <div>
                <label className="text-[10px] font-bold tracking-[0.07em] uppercase text-zinc-400 block mb-1.5">
                  Color
                </label>
                <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-black/[0.08] bg-zinc-50/80">
                  {PRESET_COLORS.map((color) => {
                    const isSelected = editProjectColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => setEditProjectColor(color)}
                        className="relative transition-transform hover:scale-110"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          backgroundColor: color,
                          border: isSelected
                            ? `2px solid ${color}`
                            : "1.5px solid rgba(0,0,0,0.08)",
                          outline: isSelected ? `2px solid ${color}40` : "none",
                          outlineOffset: 1,
                        }}
                      >
                        {isSelected && (
                          <Check
                            size={11}
                            className="absolute inset-0 m-auto text-white drop-shadow-sm"
                            strokeWidth={3}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-[10px] bg-red-50/60 border border-red-200/50 p-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle
                    size={11}
                    className="text-red-500"
                    strokeWidth={2.5}
                  />
                  <span className="text-[10px] font-bold tracking-[0.09em] uppercase text-red-500">
                    Danger zone
                  </span>
                </div>
                <p className="text-[12px] text-red-400/80 leading-relaxed mb-3">
                  Deleting this project permanently removes all of its tasks. This
                  cannot be undone.
                </p>
                <button
                  onClick={() => setProjectToDelete(activeProject)}
                  className="w-full h-[34px] flex items-center justify-center gap-1.5
                            rounded-[7px] border border-red-300/50 bg-transparent
                            text-[12px] font-semibold text-red-600
                            hover:bg-red-100/60 hover:border-red-300
                            transition-colors"
                >
                  <Trash2 size={13} strokeWidth={2} />
                  Delete project
                </button>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-2 px-6 py-4 mt-5
                            border-t border-black/[0.06]"
            >
              <button
                onClick={() => setProjectSettingsOpen(false)}
                disabled={isUpdatingProject}
                className="h-[34px] px-4 rounded-[7px] border border-black/[0.12] bg-transparent
                          text-[13px] font-medium text-zinc-500
                          hover:bg-black/[0.04] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProject}
                disabled={!editProjectName.trim() || isUpdatingProject}
                className="h-[34px] px-5 rounded-[7px] bg-zinc-900 border-none
                          text-[13px] font-semibold text-white tracking-tight
                          hover:bg-zinc-700 transition-colors
                          disabled:opacity-40 disabled:cursor-not-allowed
                          flex items-center gap-2"
              >
                {isUpdatingProject && (
                  <Loader2 size={13} className="animate-spin" />
                )}
                Save changes
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Project Confirm */}
        <AlertDialog
          open={!!projectToDelete}
          onOpenChange={(open) => {
            if (!open) {
              setProjectToDelete(null);
              setProjectDeleteError("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  This will permanently delete the{" "}
                  <strong>{projectToDelete?.name}</strong> project and all of its
                  tasks. This action cannot be undone.
                  {projectDeleteError && (
                    <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                      {projectDeleteError}
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingProject}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteProject();
                }}
                disabled={isDeletingProject}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {isDeletingProject ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  "Delete Project"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Workspace Settings Dialog */}
        {/* <Dialog open={wsSettingsOpen} onOpenChange={setWsSettingsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Workspace Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Workspace Name
                </label>
                <Input
                  value={editWsName}
                  onChange={(e) => setEditWsName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateWorkspace()}
                  disabled={isUpdatingWs}
                  className="border-[#e4e4e0] focus-visible:ring-violet-300"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Note: Workspace URL cannot be changed after creation.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Description{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input
                  value={editWsDescription}
                  onChange={(e) => setEditWsDescription(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateWorkspace()}
                  placeholder="What is this workspace for?"
                  disabled={isUpdatingWs}
                  className="border-[#e4e4e0] focus-visible:ring-violet-300"
                />
              </div>

              <div className="pt-4 border-t border-[#e4e4e0] mt-4">
                <label className="text-sm font-medium text-red-600 block mb-1.5">
                  Danger Zone
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Deleting a workspace will immediately delete all of its projects
                  and tasks. This cannot be undone.
                </p>
                <button
                  onClick={() => setWsDeleteAlertOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 h-9 rounded-md text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200"
                >
                  Delete Workspace
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setWsSettingsOpen(false)}
                disabled={isUpdatingWs}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateWorkspace}
                disabled={!editWsName.trim() || isUpdatingWs}
                className="bg-[#1a1a1a] hover:bg-[#333] text-white"
              >
                {isUpdatingWs ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  */}
        {/* Workspace Settings Dialog */}
        <Dialog open={wsSettingsOpen} onOpenChange={setWsSettingsOpen}>
          <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-black/[0.08] [&>button]:hidden">
            {/* Header */}
            <DialogTitle className="sr-only">Workspace Settings</DialogTitle>
            <div className="flex items-start justify-between px-6 pt-6 pb-0">
              <div>
                <h2 className="text-[16px] font-semibold text-zinc-900 tracking-tight leading-snug">
                  Workspace settings
                </h2>
                <p className="text-[12px] text-zinc-400 mt-0.5 font-normal">
                  {activeWorkspace?.name}
                </p>
              </div>
              <button
                onClick={() => setWsSettingsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-black/[0.04]
                          text-zinc-500 hover:bg-black/[0.08] hover:text-zinc-800 transition-colors mt-0.5"
              >
                <X size={12} strokeWidth={2.2} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 pt-5 pb-0 space-y-4">
              {/* Workspace Name */}
              <div>
                <label className="text-[10px] font-bold tracking-[0.07em] uppercase text-zinc-400 block mb-1.5">
                  Workspace name
                </label>
                <Input
                  value={editWsName}
                  onChange={(e) => setEditWsName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateWorkspace()}
                  disabled={isUpdatingWs}
                  className="h-9 text-[13px] border-black/[0.12] rounded-lg shadow-none
                            focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:border-violet-400
                            placeholder:text-zinc-300 transition-all"
                />
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  URL cannot be changed after creation.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-bold tracking-[0.07em] uppercase text-zinc-400 block mb-1.5">
                  Description{" "}
                  <span className="text-zinc-300 font-normal normal-case tracking-normal">
                    (optional)
                  </span>
                </label>
                <Input
                  value={editWsDescription}
                  onChange={(e) => setEditWsDescription(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateWorkspace()}
                  placeholder="What is this workspace for?"
                  disabled={isUpdatingWs}
                  className="h-9 text-[13px] border-black/[0.12] rounded-lg shadow-none
                            focus-visible:ring-2 focus-visible:ring-violet-200 focus-visible:border-violet-400
                            placeholder:text-zinc-300 transition-all"
                />
              </div>

              {/* Members */}
              <div>
                <label className="text-[10px] font-bold tracking-[0.07em] uppercase text-zinc-400 block mb-1.5">
                  Members
                </label>
                <div className="rounded-lg border border-black/[0.12] divide-y divide-black/[0.06] bg-zinc-50/50 max-h-48 overflow-y-auto overflow-x-hidden">
                  {isLoadingMembers ? (
                    <div className="p-4 text-center text-xs text-zinc-500">Loading members...</div>
                  ) : wsMembers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-500">No members found</div>
                  ) : (
                    wsMembers.map(member => {
                      const isOwner = member.role === 'owner';
                      const currentUserIsUser = currentUserId === member.id;
                      const amIOwner = activeWorkspace?.owner_id === currentUserId;
                      const canRemove = amIOwner && !isOwner && !currentUserIsUser;
                      
                      return (
                        <div key={member.id} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-blue-400 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                                {member.name ? member.name[0].toUpperCase() : member.email[0].toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <p className="text-[13px] font-medium text-zinc-900 truncate">
                                    {member.name || "Pending User"}
                                    {isOwner && <span className="ml-2 text-[10px] uppercase font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">Owner</span>}
                                </p>
                                <p className="text-[11px] text-zinc-500 truncate">{member.email}</p>
                            </div>
                          </div>
                          {canRemove && (
                            <button
                                type="button"
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={removingMemberId === member.id}
                                className="shrink-0 ml-3 h-[26px] px-2.5 rounded-md border border-zinc-200 bg-white text-[11px] font-medium text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50"
                            >
                                {removingMemberId === member.id ? "Removing..." : "Remove"}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="rounded-[10px] bg-red-50/60 border border-red-200/50 p-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle
                    size={11}
                    className="text-red-500"
                    strokeWidth={2.5}
                  />
                  <span className="text-[10px] font-bold tracking-[0.09em] uppercase text-red-500">
                    Danger zone
                  </span>
                </div>
                <p className="text-[12px] text-red-400/80 leading-relaxed mb-3">
                  Deleting this workspace permanently removes all projects and
                  tasks. This cannot be undone.
                </p>
                <button
                  onClick={() => setWsDeleteAlertOpen(true)}
                  className="w-full h-[34px] flex items-center justify-center gap-1.5
                            rounded-[7px] border border-red-300/50 bg-transparent
                            text-[12px] font-semibold text-red-600
                            hover:bg-red-100/60 hover:border-red-300
                            transition-colors"
                >
                  <Trash2 size={13} strokeWidth={2} />
                  Delete workspace
                </button>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-2 px-6 py-4 mt-5
                            border-t border-black/[0.06]"
            >
              <button
                onClick={() => setWsSettingsOpen(false)}
                disabled={isUpdatingWs}
                className="h-[34px] px-4 rounded-[7px] border border-black/[0.12] bg-transparent
                          text-[13px] font-medium text-zinc-500
                          hover:bg-black/[0.04] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateWorkspace}
                disabled={!editWsName.trim() || isUpdatingWs}
                className="h-[34px] px-5 rounded-[7px] bg-zinc-900 border-none
                          text-[13px] font-semibold text-white tracking-tight
                          hover:bg-zinc-700 transition-colors
                          disabled:opacity-40 disabled:cursor-not-allowed
                          flex items-center gap-2"
              >
                {isUpdatingWs && <Loader2 size={13} className="animate-spin" />}
                Save changes
              </button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Delete Workspace Confirm */}
        <AlertDialog
          open={wsDeleteAlertOpen}
          onOpenChange={(open) => {
            setWsDeleteAlertOpen(open);
            if (!open) setWsDeleteError("");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  This will permanently delete the{" "}
                  <strong>{activeWorkspace?.name}</strong> workspace, all of its
                  projects, and all tasks within them. This action is destructive
                  and cannot be undone.
                  {wsDeleteError && (
                    <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                      {wsDeleteError}
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeletingWs}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteWorkspace();
                }}
                disabled={isDeletingWs}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {isDeletingWs ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  "Delete Workspace"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
