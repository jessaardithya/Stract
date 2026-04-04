'use client';

import { useState, useCallback, useRef } from 'react';
import type { ProjectForm, FormField } from '@/types';
import { updateForm, updateFormField } from '@/lib/api';

type SaveState = '' | 'saving' | 'saved' | 'error';

export function useFormBuilder(
  workspaceId: string,
  projectId: string,
  initialForm: ProjectForm,
) {
  const [form, setForm] = useState<ProjectForm>(initialForm);
  const [saveState, setSaveState] = useState<SaveState>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (patch: Partial<ProjectForm>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

      setSaveState('saving');
      try {
        await updateForm(workspaceId, projectId, form.id, patch as Parameters<typeof updateForm>[3]);
        setSaveState('saved');
        savedTimerRef.current = setTimeout(() => setSaveState(''), 2000);
      } catch {
        setSaveState('error');
      }
    },
    [workspaceId, projectId, form.id],
  );

  // Auto-save with debounce for text fields, immediate for toggles
  const updateSetting = useCallback(
    (patch: Partial<ProjectForm>, immediate = false) => {
      setForm((prev) => ({ ...prev, ...patch }));
      if (immediate) {
        void save(patch);
      } else {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => void save(patch), 600);
      }
    },
    [save],
  );

  const updateField = useCallback(
    (fieldId: string, patch: Partial<FormField>) => {
      setForm((prev) => ({
        ...prev,
        fields: prev.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
      }));
    },
    [],
  );

  const addField = useCallback((field: FormField) => {
    setForm((prev) => ({ ...prev, fields: [...prev.fields, field] }));
  }, []);

  const removeField = useCallback((fieldId: string) => {
    setForm((prev) => ({ ...prev, fields: prev.fields.filter((f) => f.id !== fieldId) }));
  }, []);

  const reorderFields = useCallback((fields: FormField[]) => {
    setForm((prev) => ({ ...prev, fields }));
  }, []);

  return { form, setForm, saveState, updateSetting, updateField, addField, removeField, reorderFields };
}
