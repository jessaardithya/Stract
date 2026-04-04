'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, Type, AlignLeft, List, Mail, Calendar, Flag, X, Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { updateFormField, deleteFormField } from '@/lib/api';
import type { FormField, FieldType } from '@/types';

const FIELD_TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type size={12} />,
  textarea: <AlignLeft size={12} />,
  select: <List size={12} />,
  email: <Mail size={12} />,
  date: <Calendar size={12} />,
  priority: <Flag size={12} />,
};

const FIELD_TYPE_COLORS: Record<FieldType, string> = {
  text: 'bg-blue-50 text-blue-600',
  textarea: 'bg-indigo-50 text-indigo-600',
  select: 'bg-purple-50 text-purple-600',
  email: 'bg-cyan-50 text-cyan-600',
  date: 'bg-green-50 text-green-600',
  priority: 'bg-orange-50 text-orange-600',
};

interface FormFieldRowProps {
  field: FormField;
  workspaceId: string;
  projectId: string;
  formId: string;
  canDelete: boolean;
  onUpdate: (fieldId: string, patch: Partial<FormField>) => void;
  onDelete: (fieldId: string) => void;
  dragHandleProps?: Record<string, unknown>;
}

export function FormFieldRow({
  field,
  workspaceId,
  projectId,
  formId,
  canDelete,
  onUpdate,
  onDelete,
  dragHandleProps,
}: FormFieldRowProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [label, setLabel] = useState(field.label);
  const [showOptions, setShowOptions] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingLabel) labelRef.current?.focus();
  }, [isEditingLabel]);

  const saveLabel = async () => {
    setIsEditingLabel(false);
    if (label.trim() === field.label) return;
    try {
      await updateFormField(workspaceId, projectId, formId, field.id, { label: label.trim() });
      onUpdate(field.id, { label: label.trim() });
    } catch {
      setLabel(field.label);
    }
  };

  const saveRequired = async (v: boolean) => {
    onUpdate(field.id, { is_required: v });
    await updateFormField(workspaceId, projectId, formId, field.id, { is_required: v }).catch(console.error);
  };

  const addOption = async () => {
    if (!newOption.trim()) return;
    const opts = [...(field.options ?? []), newOption.trim()];
    setNewOption('');
    onUpdate(field.id, { options: opts });
    await updateFormField(workspaceId, projectId, formId, field.id, { options: opts }).catch(console.error);
  };

  const removeOption = async (idx: number) => {
    const opts = (field.options ?? []).filter((_, i) => i !== idx);
    onUpdate(field.id, { options: opts });
    await updateFormField(workspaceId, projectId, formId, field.id, { options: opts }).catch(console.error);
  };

  const handleDelete = async () => {
    await deleteFormField(workspaceId, projectId, formId, field.id);
    onDelete(field.id);
  };

  return (
    <div
      className="group rounded-lg border border-[#e7e1d8] bg-white transition-shadow hover:shadow-sm"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle */}
        <div
          {...(dragHandleProps ?? {})}
          className="flex shrink-0 cursor-grab items-center text-[#c9c4bc] hover:text-[#8a8a85] active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </div>

        {/* Type icon badge */}
        <span className={`flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${FIELD_TYPE_COLORS[field.field_type]}`}>
          {FIELD_TYPE_ICONS[field.field_type]}
          {field.field_type}
        </span>

        {/* Label */}
        {isEditingLabel ? (
          <input
            ref={labelRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={saveLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') { setLabel(field.label); setIsEditingLabel(false); } }}
            className="flex-1 rounded border-0 bg-transparent p-0 text-[13px] font-medium text-gray-800 outline-none focus:outline-none"
          />
        ) : (
          <span
            onClick={() => setIsEditingLabel(true)}
            className="flex-1 cursor-text truncate text-[13px] font-medium text-gray-800"
          >
            {field.label}
            {field.is_required && <span className="ml-0.5 text-red-400">*</span>}
          </span>
        )}

        {/* For select: toggle options editor */}
        {field.field_type === 'select' && (
          <button
            onClick={() => setShowOptions((v) => !v)}
            className="shrink-0 text-[10px] font-medium text-[#8a8a85] hover:text-violet-600"
          >
            {showOptions ? 'Hide' : 'Options'}
            {field.options && field.options.length > 0 ? ` (${field.options.length})` : ''}
          </button>
        )}

        {/* Required toggle */}
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-[10px] text-[#8a8a85]">Required</span>
          <Switch
            checked={field.is_required}
            onCheckedChange={saveRequired}
            className="scale-75"
          />
        </div>

        {/* Delete */}
        {canDelete && isHovered && (
          <button
            onClick={() => void handleDelete()}
            className="shrink-0 text-[#c9c4bc] hover:text-red-400 transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Options editor (for select type) */}
      {field.field_type === 'select' && showOptions && (
        <div className="border-t border-[#f0ede8] px-3 pb-3 pt-2">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(field.options ?? []).map((opt, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-[#f5f2ee] px-2.5 py-0.5 text-[11px] text-gray-700">
                {opt}
                <button onClick={() => void removeOption(i)} className="text-[#8a8a85] hover:text-red-400">
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void addOption(); }}
              placeholder="Add option..."
              className="flex-1 rounded-md border border-[#e7e1d8] bg-[#fafaf8] px-2.5 py-1 text-[12px] outline-none focus:border-violet-400"
            />
            <button
              onClick={() => void addOption()}
              className="flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-600 hover:bg-violet-100"
            >
              <Plus size={10} /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
