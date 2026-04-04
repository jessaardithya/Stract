'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MeetingNote, MeetingActionItem } from '@/types';
import { getMeeting, updateMeeting } from '@/lib/api';

type SaveState = '' | 'saving' | 'saved' | 'error';

interface UseMeetingEditorReturn {
  meeting: MeetingNote | null;
  setMeeting: React.Dispatch<React.SetStateAction<MeetingNote | null>>;
  saveState: SaveState;
  isLoading: boolean;
  updateField: (field: string, value: unknown) => void;
  refreshMeeting: () => Promise<void>;
}

export function useMeetingEditor(
  workspaceId: string,
  projectId: string,
  meetingId: string,
): UseMeetingEditorReturn {
  const [meeting, setMeeting] = useState<MeetingNote | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('');
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMeeting = useCallback(async () => {
    try {
      const result = await getMeeting(workspaceId, projectId, meetingId);
      setMeeting(result.data);
    } catch (err) {
      console.error('[useMeetingEditor] fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, projectId, meetingId]);

  useEffect(() => {
    void fetchMeeting();
  }, [fetchMeeting]);

  const updateField = useCallback(
    (field: string, value: unknown) => {
      // Optimistic local update
      setMeeting((prev) => {
        if (!prev) return prev;
        return { ...prev, [field]: value };
      });

      // Debounce the API call
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

      debounceRef.current = setTimeout(async () => {
        setSaveState('saving');
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await updateMeeting(workspaceId, projectId, meetingId, { [field]: value } as any);
          setSaveState('saved');
          savedTimerRef.current = setTimeout(() => setSaveState(''), 2000);
        } catch (err) {
          console.error('[useMeetingEditor] save error:', err);
          setSaveState('error');
        }
      }, 800);
    },
    [workspaceId, projectId, meetingId],
  );

  return {
    meeting,
    setMeeting,
    saveState,
    isLoading,
    updateField,
    refreshMeeting: fetchMeeting,
  };
}
