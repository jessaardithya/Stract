'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getPendingInvitations, getProjects, getWorkspaces } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { BootState, Project, Workspace } from '@/types';

const ACTIVE_WORKSPACE_ID_KEY = 'activeWorkspaceId';
const ACTIVE_PROJECT_ID_KEY = 'activeProjectId';
const LAST_USED_WORKSPACE_ID_KEY = 'lastUsedWorkspaceId';

interface AppContextValue {
  activeWorkspace: Workspace | null;
  activeProject: Project | null;
  projects: Project[];
  workspaces: Workspace[];
  bootState: BootState;
  activeTaskId: string | null;
  setActiveWorkspace: (
    workspace: Workspace,
    options?: { projectId?: string | null },
  ) => Promise<void>;
  setActiveProject: (project: Project) => void;
  addWorkspace: (workspace: Workspace) => Promise<void>;
  appendWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<Workspace[]>;
  refreshProjects: () => Promise<void>;
  openTask: (taskId: string) => void;
  closeTask: () => void;
}

const AppContext = createContext<AppContextValue>({} as AppContextValue);

export function useApp(): AppContextValue {
  return useContext(AppContext);
}

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [activeProject, setActiveProjectState] = useState<Project | null>(null);
  const [bootState, setBootState] = useState<BootState>('loading');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const openTask = useCallback((id: string) => setActiveTaskId(id), []);
  const closeTask = useCallback(() => setActiveTaskId(null), []);

  const refreshWorkspaces = useCallback(async () => {
    const result = await getWorkspaces();
    const list = result.data || [];
    setWorkspaces(list);
    return list;
  }, []);

  const loadProjects = useCallback(async (workspaceId: string, savedProjectId: string | null = null) => {
    try {
      const result = await getProjects(workspaceId);
      const list = result.data || [];
      setProjects(list);
      const saved = savedProjectId ? list.find((project) => project.id === savedProjectId) : null;
      const nextProject = saved || list[0] || null;
      setActiveProjectState(nextProject);
      if (nextProject) {
        localStorage.setItem('activeProjectId', nextProject.id);
      } else {
        localStorage.removeItem('activeProjectId');
      }
      return nextProject;
    } catch {
      setProjects([]);
      setActiveProjectState(null);
      localStorage.removeItem('activeProjectId');
      return null;
    }
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setActiveWorkspaceState(null);
          setActiveProjectState(null);
          setProjects([]);
          setBootState('unauthenticated');
          return;
        }

        const savedWorkspaceId = localStorage.getItem(ACTIVE_WORKSPACE_ID_KEY);
        const savedProjectId = localStorage.getItem(ACTIVE_PROJECT_ID_KEY);
        const [list, invitationsResult] = await Promise.all([
          refreshWorkspaces(),
          getPendingInvitations(),
        ]);
        const pendingInvitations = invitationsResult.data || [];

        if (list.length === 0 && pendingInvitations.length === 0) {
          setActiveWorkspaceState(null);
          setActiveProjectState(null);
          setProjects([]);
          setBootState('no-workspace');
          return;
        }

        if (list.length === 1 && pendingInvitations.length === 0) {
          const workspace = list[0];
          setActiveWorkspaceState(workspace);
          localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, workspace.id);
          localStorage.setItem(LAST_USED_WORKSPACE_ID_KEY, workspace.id);
          await loadProjects(workspace.id, savedProjectId);
          setBootState('ready');
          return;
        }

        if (savedWorkspaceId) {
          localStorage.setItem(LAST_USED_WORKSPACE_ID_KEY, savedWorkspaceId);
        }

        localStorage.removeItem(ACTIVE_WORKSPACE_ID_KEY);
        localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
        setActiveWorkspaceState(null);
        setActiveProjectState(null);
        setProjects([]);
        setBootState('workspace-selection');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown boot error';
        console.error('[AppContext] boot error:', message);
        setBootState('no-workspace');
      }
    };

    boot();
  }, [loadProjects, refreshWorkspaces]);

  const setActiveWorkspace = useCallback(async (
    workspace: Workspace,
    options?: { projectId?: string | null },
  ) => {
    setActiveWorkspaceState(workspace);
    setActiveProjectState(null);
    setProjects([]);
    setActiveTaskId(null);
    localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, workspace.id);
    localStorage.setItem(LAST_USED_WORKSPACE_ID_KEY, workspace.id);
    if (options?.projectId) {
      localStorage.setItem(ACTIVE_PROJECT_ID_KEY, options.projectId);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    }
    await loadProjects(workspace.id, options?.projectId ?? null);
    setBootState('ready');
  }, [loadProjects]);

  const appendWorkspace = useCallback((workspace: Workspace) => {
    setWorkspaces((prev) => {
      if (prev.some((item) => item.id === workspace.id)) {
        return prev.map((item) => (item.id === workspace.id ? { ...item, ...workspace } : item));
      }
      return [...prev, workspace];
    });
  }, []);

  const addWorkspace = useCallback(async (workspace: Workspace) => {
    appendWorkspace(workspace);
    setActiveWorkspaceState(workspace);
    setActiveProjectState(null);
    setProjects([]);
    setActiveTaskId(null);
    localStorage.setItem(ACTIVE_WORKSPACE_ID_KEY, workspace.id);
    localStorage.setItem(LAST_USED_WORKSPACE_ID_KEY, workspace.id);
    localStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    setBootState('ready');
    await loadProjects(workspace.id);
  }, [appendWorkspace, loadProjects]);

  const setActiveProject = useCallback((project: Project) => {
    setActiveProjectState(project);
    localStorage.setItem(ACTIVE_PROJECT_ID_KEY, project.id);
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!activeWorkspace) {
      return;
    }

    await loadProjects(activeWorkspace.id, activeProject?.id ?? null);
  }, [activeProject?.id, activeWorkspace, loadProjects]);

  return (
    <AppContext.Provider
      value={{
        activeWorkspace,
        activeProject,
        workspaces,
        projects,
        bootState,
        activeTaskId,
        setActiveWorkspace,
        setActiveProject,
        addWorkspace,
        appendWorkspace,
        refreshWorkspaces,
        refreshProjects,
        openTask,
        closeTask,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
