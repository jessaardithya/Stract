"use client";

import { useState, useEffect, useCallback } from 'react';
import { getWorkspaceReports } from '@/lib/api';
import type { WorkspaceReports } from '@/types';
import { useApp } from '@/context/AppContext';

export function useReportsData() {
  const { activeWorkspace } = useApp();
  const [data, setData] = useState<WorkspaceReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchReports = useCallback(async () => {
    if (!activeWorkspace) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const reports = await getWorkspaceReports(activeWorkspace.id);
      setData(reports);
      setLastUpdated(new Date());
    } catch (err) {
      if (err instanceof Error) {
        setError(err);
      } else {
        setError(new Error('An unknown error occurred'));
      }
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 60000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: fetchReports,
  };
}
