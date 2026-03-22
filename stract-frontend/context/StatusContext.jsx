"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getStatuses } from "@/lib/api";
import { useApp } from "./AppContext";

const StatusContext = createContext();

export function StatusProvider({ children }) {
  const { activeWorkspace, activeProject } = useApp();
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      console.error("Failed to fetch statuses:", err);
      setError(err.message);
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
