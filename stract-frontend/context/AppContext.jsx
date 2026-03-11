'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getWorkspaces, getProjects } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const AppContext = createContext({
  activeWorkspace: null,
  activeProject: null,
  projects: [],
  workspaces: [],
  bootState: 'loading',  // 'loading' | 'unauthenticated' | 'no-workspace' | 'ready'
  setActiveWorkspace: () => {},
  setActiveProject: () => {},
  addWorkspace: () => {},
  refreshProjects: () => {},
});

export function useApp() {
  return useContext(AppContext);
}

export function AppContextProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState(null);
  const [activeProject, setActiveProjectState] = useState(null);
  const [bootState, setBootState] = useState('loading');

  const loadProjects = useCallback(async (workspaceId, savedProjectId = null) => {
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

        const saved = savedWsId ? list.find((w) => w.id === savedWsId) : null;
        const ws = saved || list[0];
        setActiveWorkspaceState(ws);
        localStorage.setItem('activeWorkspaceId', ws.id);
        await loadProjects(ws.id, savedPjId);
        setBootState('ready');
      } catch (err) {
        console.error('[AppContext] boot error:', err);
        setBootState('no-workspace');
      }
    };
    boot();
  }, [loadProjects]);

  const setActiveWorkspace = useCallback(async (ws) => {
    setActiveWorkspaceState(ws);
    setActiveProjectState(null);
    setProjects([]);
    localStorage.setItem('activeWorkspaceId', ws.id);
    localStorage.removeItem('activeProjectId');
    await loadProjects(ws.id);
  }, [loadProjects]);

  /** Called after a successful POST /workspaces — appends and switches. */
  const addWorkspace = useCallback(async (ws) => {
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

  const setActiveProject = useCallback((project) => {
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
      setActiveWorkspace,
      setActiveProject,
      addWorkspace,
      refreshProjects,
    }}>
      {children}
    </AppContext.Provider>
  );
}
