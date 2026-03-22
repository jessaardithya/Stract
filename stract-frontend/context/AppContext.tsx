'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getWorkspaces, getProjects } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Workspace, Project, BootState } from '@/types';

interface AppContextValue {
  activeWorkspace: Workspace | null;
  activeProject: Project | null;
  projects: Project[];
  workspaces: Workspace[];
  bootState: BootState;
  activeTaskId: string | null;
  setActiveWorkspace: (w: Workspace) => Promise<void>;
  setActiveProject: (p: Project) => void;
  addWorkspace: (ws: Workspace) => Promise<void>;
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

  const loadProjects = useCallback(async (workspaceId: string, savedProjectId: string | null = null) => {
    try {
      const result = await getProjects(workspaceId);
      const list = result.data || [];
      setProjects(list);
      const saved = savedProjectId ? list.find((p) => p.id === savedProjectId) : null;
      const active = saved || list[0] || null;
      setActiveProjectState(active);
      if (active) localStorage.setItem('activeProjectId', active.id);
      return active;
    } catch {
      setProjects([]);
      setActiveProjectState(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const boot = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setBootState('unauthenticated');
          return;
        }

        const savedWsId = localStorage.getItem('activeWorkspaceId');
        const savedPjId = localStorage.getItem('activeProjectId');

        const result = await getWorkspaces();
        const list = result.data || [];
        setWorkspaces(list);

        if (list.length === 0) {
          setBootState('no-workspace');
          return;
        }

        const saved = savedWsId ? list.find((w: Workspace) => w.id === savedWsId) : null;
        const ws = saved || list[0];
        if (ws) {
          setActiveWorkspaceState(ws);
          localStorage.setItem('activeWorkspaceId', ws.id);
          await loadProjects(ws.id, savedPjId);
        }
        setBootState('ready');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown boot error';
        console.error('[AppContext] boot error:', message);
        setBootState('no-workspace');
      }
    };
    boot();
  }, [loadProjects]);

  const setActiveWorkspace = useCallback(async (ws: Workspace) => {
    setActiveWorkspaceState(ws);
    setActiveProjectState(null);
    setProjects([]);
    localStorage.setItem('activeWorkspaceId', ws.id);
    localStorage.removeItem('activeProjectId');
    await loadProjects(ws.id);
  }, [loadProjects]);

  /** Called after a successful POST /workspaces — appends and switches. */
  const addWorkspace = useCallback(async (ws: Workspace) => {
    setWorkspaces((prev) => [...prev, ws]);
    setActiveWorkspaceState(ws);
    setActiveProjectState(null);
    setProjects([]);
    localStorage.setItem('activeWorkspaceId', ws.id);
    localStorage.removeItem('activeProjectId');
    setBootState('ready');
    // Projects will be empty → sidebar auto-opens project form
    await loadProjects(ws.id);
  }, [loadProjects]);

  const setActiveProject = useCallback((project: Project) => {
    setActiveProjectState(project);
    if (project) localStorage.setItem('activeProjectId', project.id);
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!activeWorkspace) return;
    await loadProjects(activeWorkspace.id, activeProject?.id);
  }, [activeWorkspace, activeProject, loadProjects]);

  return (
    <AppContext.Provider value={{
      activeWorkspace,
      activeProject,
      workspaces,
      projects,
      bootState,
      activeTaskId,
      setActiveWorkspace,
      setActiveProject,
      addWorkspace,
      refreshProjects,
      openTask,
      closeTask,
    }}>
      {children}
    </AppContext.Provider>
  );
}

