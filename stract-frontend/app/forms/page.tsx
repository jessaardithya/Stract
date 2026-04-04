'use client';

import React, { useState } from 'react';
import { FileInput, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { createForm, getForm } from '@/lib/api';
import { FormsList } from '@/components/forms/FormsList';
import { FormBuilder } from '@/components/forms/FormBuilder';
import { useFormBuilder } from '@/components/forms/useFormBuilder';
import type { ProjectForm, FormField } from '@/types';

// Inner component that holds the state for selected form's builder
function SelectedFormView({
  formId,
  workspaceId,
  projectId,
}: {
  formId: string;
  workspaceId: string;
  projectId: string;
}) {
  const [initialForm, setInitialForm] = React.useState<ProjectForm | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getForm(workspaceId, projectId, formId)
      .then((res) => { if (!cancelled) setInitialForm(res.data); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId, projectId, formId]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
      </div>
    );
  }
  if (!initialForm) return null;

  return <FormBuilderWrapper initialForm={initialForm} workspaceId={workspaceId} projectId={projectId} />;
}

function FormBuilderWrapper({
  initialForm,
  workspaceId,
  projectId,
}: {
  initialForm: ProjectForm;
  workspaceId: string;
  projectId: string;
}) {
  const { form, saveState, updateSetting, updateField, addField, removeField, reorderFields } = useFormBuilder(
    workspaceId,
    projectId,
    initialForm,
  );

  return (
    <FormBuilder
      form={form}
      workspaceId={workspaceId}
      projectId={projectId}
      saveState={saveState}
      onFieldUpdate={updateField}
      onFieldAdd={addField}
      onFieldRemove={removeField}
      onFieldsReorder={reorderFields}
      onSettingsUpdate={updateSetting}
    />
  );
}

export default function FormsPage() {
  const { activeWorkspace, activeProject } = useApp();
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const workspaceId = activeWorkspace?.id ?? '';
  const projectId = activeProject?.id ?? '';

  if (!activeWorkspace || !activeProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-[13px] text-[#8a8a85]">
          <FileInput className="mx-auto mb-2 h-7 w-7 text-[#c9c4bc]" />
          Select a project to manage forms
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const res = await createForm(workspaceId, projectId);
      setRefreshKey((k) => k + 1);
      setSelectedFormId(res.data.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-48px)] w-full overflow-hidden">
      {/* Left: forms list */}
      <div className="w-72 shrink-0 overflow-hidden">
        <FormsList
          workspaceId={workspaceId}
          projectId={projectId}
          selectedFormId={selectedFormId}
          onSelect={setSelectedFormId}
          onCreate={() => void handleCreate()}
          isCreating={isCreating}
          refreshKey={refreshKey}
        />
      </div>

      {/* Right: form builder */}
      <div className="flex-1 overflow-hidden bg-white">
        {selectedFormId ? (
          <SelectedFormView
            key={selectedFormId}
            formId={selectedFormId}
            workspaceId={workspaceId}
            projectId={projectId}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50">
              <FileInput size={24} className="text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium text-gray-700">Select or create a form</p>
              <p className="mt-1 text-[12.5px] text-[#8a8a85]">Choose a form from the list or create a new one</p>
            </div>
            <button
              onClick={() => void handleCreate()}
              disabled={isCreating}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {isCreating ? <Loader2 size={12} className="animate-spin" /> : null}
              New Form
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
