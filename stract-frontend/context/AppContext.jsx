'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getWorkspaces, getProjects } from '@/lib/api';

const AppContext = createContext({
  activeWorkspace: null,
  activeProject: null,
  projects: [],
  workspaces: [],
  setActiveWorkspace: () => {},
  setActiveProject: () => {},
  refreshProjects: () => {},
  isBooting: true,
});

export function useApp() {
  return useContext(AppContext);
}

export function AppContextProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState(null);
  const [activeProject, setActiveProjectState] = useState(null);
  const [isBooting, setIsBooting] = useState(true);

  // Load projects for a given workspace
  const loadProjects = useCallback(async (workspaceId, savedProjectId = null) => {
    try {
      const result = await getProjects(workspaceId);
      const list = result.data || [];
      setProjects(list);

      // Pick saved project or first
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

  // Boot: fetch workspaces, restore from localStorage
  useEffect(() => {
    const boot = async () => {
      try {
        const savedWsId = localStorage.getItem('activeWorkspaceId');
        const savedPjId = localStorage.getItem('activeProjectId');

        const result = await getWorkspaces();
        const list = result.data || [];
        setWorkspaces(list);

        if (list.length === 0) {
          setIsBooting(false);
          return;
        }

        const saved = savedWsId ? list.find((w) => w.id === savedWsId) : null;
        const ws = saved || list[0];
        setActiveWorkspaceState(ws);
        localStorage.setItem('activeWorkspaceId', ws.id);

        await loadProjects(ws.id, savedPjId);
      } catch (err) {
        console.error('[AppContext] boot error:', err);
      } finally {
        setIsBooting(false);
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

  const setActiveProject = useCallback((project) => {
    setActiveProjectState(project);
    if (project) localStorage.setItem('activeProjectId', project.id);
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!activeWorkspace) return;
    const savedPjId = activeProject?.id;
    await loadProjects(activeWorkspace.id, savedPjId);
  }, [activeWorkspace, activeProject, loadProjects]);

  return (
    <AppContext.Provider value={{
      activeWorkspace,
      activeProject,
      workspaces,
      projects,
      setActiveWorkspace,
      setActiveProject,
      refreshProjects,
      isBooting,
    }}>
      {children}
    </AppContext.Provider>
  );
}
