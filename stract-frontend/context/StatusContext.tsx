"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode
} from "react";
import { getStatuses } from "@/lib/api";
import { useApp } from "./AppContext";
import type { ProjectStatus } from "@/types";

interface StatusContextValue {
  statuses: ProjectStatus[];
  loading: boolean;
  error: string | null;
  refreshStatuses: () => Promise<void>;
}

const StatusContext = createContext<StatusContextValue>({} as StatusContextValue);

export function StatusProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace, activeProject } = useApp();
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatuses = useCallback(async () => {
    if (!activeWorkspace?.id || !activeProject?.id) {
      setStatuses([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getStatuses(activeWorkspace.id, activeProject.id);
      // Backend returns { data: [...] }
      const sorted = (result.data || []).sort(
        (a, b) => a.position - b.position,
      );
      setStatuses(sorted);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error("Failed to fetch statuses:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, activeProject?.id]);

  useEffect(() => {
    refreshStatuses();
  }, [refreshStatuses]);

  return (
    <StatusContext.Provider
      value={{ statuses, loading, error, refreshStatuses }}
    >
      {children}
    </StatusContext.Provider>
  );
}

export function useStatuses() {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error("useStatuses must be used within a StatusProvider");
  }
  return context;
}
