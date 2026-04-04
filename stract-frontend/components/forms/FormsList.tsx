'use client';

import React, { useEffect, useState } from 'react';
import { Plus, FileInput, Loader2 } from 'lucide-react';
import { getForms, deleteForm } from '@/lib/api';
import { FormCard } from './FormCard';
import type { FormListItem } from '@/types';

interface FormsListProps {
  workspaceId: string;
  projectId: string;
  selectedFormId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  isCreating: boolean;
  refreshKey: number;
}

export function FormsList({ workspaceId, projectId, selectedFormId, onSelect, onCreate, isCreating, refreshKey }: FormsListProps) {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getForms(workspaceId, projectId)
      .then((res) => { if (!cancelled) setForms(res.data || []); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId, projectId, refreshKey]);

  const handleDelete = async (formId: string) => {
    await deleteForm(workspaceId, projectId, formId);
    setForms((prev) => prev.filter((f) => f.id !== formId));
  };

  return (
    <div className="flex h-full flex-col border-r border-[#e7e1d8] bg-[#fafaf8]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e7e1d8] px-4 py-4">
        <div className="flex items-center gap-2">
          <FileInput size={15} className="text-violet-500" />
          <span className="text-[13px] font-semibold text-gray-900">Forms</span>
          <span className="text-[11px] text-[#8a8a85]">({forms.length})</span>
        </div>
        <button
          onClick={onCreate}
          disabled={isCreating}
          className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {isCreating ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
          New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          [1, 2].map((k) => (
            <div key={k} className="h-28 animate-pulse rounded-xl border border-[#e7e1d8] bg-[#f5f2ee]" />
          ))
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
              <FileInput size={18} className="text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-[12.5px] font-medium text-gray-700">No forms yet</p>
              <p className="mt-0.5 text-[11px] text-[#8a8a85]">Create your first intake form</p>
            </div>
            <button
              onClick={onCreate}
              disabled={isCreating}
              className="flex items-center gap-1 rounded-lg border border-[#e4e4e0] bg-white px-3 py-1.5 text-[11.5px] font-medium text-gray-700 hover:bg-[#f5f2ee]"
            >
              {isCreating ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              New Form
            </button>
          </div>
        ) : (
          forms.map((f) => (
            <FormCard
              key={f.id}
              item={f}
              isSelected={selectedFormId === f.id}
              onSelect={() => onSelect(f.id)}
              onDelete={() => handleDelete(f.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
