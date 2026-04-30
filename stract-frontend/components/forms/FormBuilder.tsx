'use client';

import React, { useState } from 'react';
import { Loader2, Plus, Type, AlignLeft, List, Mail, Calendar, Flag, ChevronDown, ExternalLink, Inbox, CheckCircle2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createFormField, updateFormField } from '@/lib/api';
import { FormFieldRow } from './FormFieldRow';
import { FormSettings } from './FormSettings';
import { SubmissionsInbox } from './SubmissionsInbox';
import type { FormField, FieldType, ProjectForm } from '@/types';

type Tab = 'fields' | 'submissions' | 'settings';

type FieldTypeOption = {
  type: FieldType;
  label: string;
  icon: React.ReactNode;
};

const FIELD_TYPE_OPTIONS: FieldTypeOption[] = [
  { type: 'text', label: 'Text', icon: <Type size={12} /> },
  { type: 'textarea', label: 'Textarea', icon: <AlignLeft size={12} /> },
  { type: 'select', label: 'Select', icon: <List size={12} /> },
  { type: 'email', label: 'Email', icon: <Mail size={12} /> },
  { type: 'date', label: 'Date', icon: <Calendar size={12} /> },
  { type: 'priority', label: 'Priority', icon: <Flag size={12} /> },
];

// Sortable wrapper around FormFieldRow
function SortableFieldRow(props: React.ComponentProps<typeof FormFieldRow>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.field.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 50 : 'auto',
  };
  return (
    <div ref={setNodeRef} style={style}>
      <FormFieldRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

interface FormBuilderProps {
  form: ProjectForm;
  workspaceId: string;
  projectId: string;
  saveState: '' | 'saving' | 'saved' | 'error';
  onFieldUpdate: (fieldId: string, patch: Partial<FormField>) => void;
  onFieldAdd: (field: FormField) => void;
  onFieldRemove: (fieldId: string) => void;
  onFieldsReorder: (fields: FormField[]) => void;
  onSettingsUpdate: (patch: Partial<ProjectForm>, immediate?: boolean) => void;
}

export function FormBuilder({
  form,
  workspaceId,
  projectId,
  saveState,
  onFieldUpdate,
  onFieldAdd,
  onFieldRemove,
  onFieldsReorder,
  onSettingsUpdate,
}: FormBuilderProps) {
  const [activeTab, setActiveTab] = useState<Tab>('fields');
  const [isAddingField, setIsAddingField] = useState(false);
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = form.fields.findIndex((f) => f.id === active.id);
    const newIdx = form.fields.findIndex((f) => f.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const newFields = arrayMove(form.fields, oldIdx, newIdx);
    onFieldsReorder(newFields);

    // Compute midpoint position
    const prev = newFields[newIdx - 1]?.position ?? 0;
    const next = newFields[newIdx + 1]?.position ?? prev + 131072;
    const newPos = (prev + next) / 2;

    await updateFormField(workspaceId, projectId, form.id, String(active.id), { position: newPos }).catch(console.error);
    onFieldUpdate(String(active.id), { position: newPos });
  };

  const handleAddField = async (type: FieldType) => {
    setShowFieldDropdown(false);
    setIsAddingField(true);
    try {
      const res = await createFormField(workspaceId, projectId, form.id, {
        label: type.charAt(0).toUpperCase() + type.slice(1) + ' Field',
        field_type: type,
      });
      onFieldAdd(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAddingField(false);
    }
  };

  const SAVE_INDICATOR: Record<typeof saveState, string> = {
    '': '',
    saving: 'Saving…',
    saved: 'Saved ✓',
    error: 'Save failed',
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[#e7e1d8] px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-gray-800 truncate">{form.title}</h2>
          {saveState && (
            <p className={`text-[10px] mt-0.5 ${saveState === 'error' ? 'text-red-500' : 'text-[#8a8a85]'}`}>
              {SAVE_INDICATOR[saveState]}
            </p>
          )}
          {/* Quick actions */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {form.is_public && (
              <a
                href={`/f/${form.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100 transition-colors"
              >
                <ExternalLink size={10} />
                Open Form
              </a>
            )}
            {!form.is_active && (
              <button
                onClick={() => onSettingsUpdate({ is_active: true }, true)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <CheckCircle2 size={10} />
                Publish Form
              </button>
            )}
            <button
              onClick={() => setActiveTab('submissions')}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'submissions'
                  ? 'border-violet-200 bg-violet-50 text-violet-700'
                  : 'border-[#e7e1d8] bg-[#f9f7f4] text-[#6b6660] hover:bg-[#f0ede8]'
              }`}
            >
              <Inbox size={10} />
              Review Submissions
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex shrink-0 items-center gap-1 bg-[#f5f2ee] rounded-lg p-1">
          {(['fields', 'submissions', 'settings'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1 text-[11.5px] font-medium capitalize transition-colors ${
                activeTab === tab ? 'bg-white text-violet-700 shadow-sm' : 'text-[#8a8a85] hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Fields tab */}
      {activeTab === 'fields' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
            {/* @ts-expect-error Type mismatch with React 18 children */}
            <SortableContext items={form.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              {form.fields.map((field) => (
                <SortableFieldRow
                  key={field.id}
                  field={field}
                  workspaceId={workspaceId}
                  projectId={projectId}
                  formId={form.id}
                  canDelete={form.fields.length > 1}
                  onUpdate={onFieldUpdate}
                  onDelete={onFieldRemove}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Add field button */}
          <div className="relative mt-2">
            <button
              onClick={() => setShowFieldDropdown((v) => !v)}
              disabled={isAddingField}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#d5cfc6] py-2.5 text-[12px] font-medium text-[#8a8a85] hover:border-violet-300 hover:text-violet-600 disabled:opacity-60 transition-colors"
            >
              {isAddingField ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Add Field
              <ChevronDown size={10} />
            </button>
            {showFieldDropdown && (
              <div className="absolute left-0 right-0 mt-1 z-20 bg-white border border-[#e7e1d8] rounded-xl shadow-lg overflow-hidden">
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => void handleAddField(opt.type)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-gray-700 hover:bg-[#f5f2ee] transition-colors"
                  >
                    <span className="text-[#8a8a85]">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submissions tab */}
      {activeTab === 'submissions' && (
        <div className="flex-1 overflow-hidden">
          <SubmissionsInbox
            workspaceId={workspaceId}
            projectId={projectId}
            formId={form.id}
            fields={form.fields}
          />
        </div>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto">
          <FormSettings
            form={form}
            workspaceId={workspaceId}
            projectId={projectId}
            onUpdate={onSettingsUpdate}
          />
        </div>
      )}
    </div>
  );
}
