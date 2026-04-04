'use client';

import React, { useEffect, useState } from 'react';
import { Globe, Lock, Zap, Inbox, CheckCircle2, EyeOff, Copy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStatuses } from '@/context/StatusContext';
import type { ProjectForm, Priority } from '@/types';

interface FormSettingsProps {
  form: ProjectForm;
  workspaceId: string;
  projectId: string;
  onUpdate: (patch: Partial<ProjectForm>, immediate?: boolean) => void;
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-700' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
];

export function FormSettings({ form, workspaceId, projectId, onUpdate }: FormSettingsProps) {
  const { statuses } = useStatuses();
  const [copied, setCopied] = useState(false);

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${form.slug}` : `/f/${form.slug}`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 p-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a0988e] mb-4">Settings</p>

        {/* Title */}
        <div className="mb-4">
          <label className="text-[11px] font-medium text-[#8a8a85] mb-1 block">Form Title</label>
          <input
            value={form.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full rounded-lg border border-[#e7e1d8] bg-white px-3 py-2 text-[13px] text-gray-800 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
          />
        </div>

        {/* Description */}
        <div className="mb-5">
          <label className="text-[11px] font-medium text-[#8a8a85] mb-1 block">Description</label>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Optional description shown to respondents..."
            rows={2}
            className="w-full resize-none rounded-lg border border-[#e7e1d8] bg-white px-3 py-2 text-[13px] text-gray-800 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="text-[11px] font-medium text-[#8a8a85] mb-1 block">Custom URL Slug</label>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#8a8a85] shrink-0">/f/</span>
            <input
              value={form.slug}
              onChange={(e) => onUpdate({ slug: e.target.value })}
              className="flex-1 rounded-lg border border-[#e7e1d8] bg-white px-3 py-1.5 text-[13px] text-gray-800 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
              placeholder="my-cool-form"
            />
          </div>
          <p className="mt-1.5 text-[10px] text-[#8a8a85]">
            Customizing the slug will change the public link immediately.
          </p>
        </div>
      </div>

      <div className="space-y-4 border-t border-[#e7e1d8] pt-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#a0988e] mb-1">Publishing</p>

        {/* Active toggle */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {form.is_active ? <CheckCircle2 size={13} className="text-emerald-600" /> : <EyeOff size={13} className="text-gray-400" />}
              <span className="text-[13px] font-medium text-gray-800">{form.is_active ? 'Live' : 'Draft'}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#8a8a85] pl-5">
              {form.is_active ? 'Form is live and accepting submissions' : 'Form is hidden from everyone'}
            </p>
          </div>
          <Switch
            checked={form.is_active}
            onCheckedChange={(v: boolean) => onUpdate({ is_active: v }, true)}
          />
        </div>

        {/* Public toggle */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {form.is_public ? <Globe size={13} className="text-blue-600" /> : <Lock size={13} className="text-gray-500" />}
              <span className="text-[13px] font-medium text-gray-800">{form.is_public ? 'Public' : 'Internal Only'}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#8a8a85] pl-5">
              {form.is_public ? 'Anyone with the link can submit' : 'Only workspace members can submit'}
            </p>
          </div>
          <Switch
            checked={form.is_public}
            onCheckedChange={(v: boolean) => onUpdate({ is_public: v }, true)}
          />
        </div>

        {/* Auto-create toggle */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {form.auto_create ? <Zap size={13} className="text-violet-600" /> : <Inbox size={13} className="text-gray-500" />}
              <span className="text-[13px] font-medium text-gray-800">{form.auto_create ? 'Instant Auto-Publish' : 'Approval Required'}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#8a8a85] pl-5">
              {form.auto_create ? 'Submissions instantly create tasks' : 'Submissions go to inbox for review'}
            </p>
          </div>
          <Switch
            checked={form.auto_create}
            onCheckedChange={(v: boolean) => onUpdate({ auto_create: v }, true)}
          />
        </div>
      </div>

      {/* Default status */}
      <div className="border-t border-[#e7e1d8] pt-5 space-y-4">
        <div>
          <label className="text-[11px] font-medium text-[#8a8a85] mb-1.5 block">Default Status</label>
          <Select
            value={form.default_status_id ?? '__none__'}
            onValueChange={(v: string) => onUpdate({ default_status_id: v === '__none__' ? null : v }, true)}
          >
            <SelectTrigger className="h-8 text-[12px] border-[#e7e1d8] shadow-none">
              <SelectValue placeholder="First available status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">First available status</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Default priority */}
        <div>
          <label className="text-[11px] font-medium text-[#8a8a85] mb-1.5 block">Default Priority</label>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => onUpdate({ default_priority: p.value }, true)}
                className={`flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-all ${
                  form.default_priority === p.value
                    ? `${p.color} border-current`
                    : 'border-[#e4e4e0] text-[#8a8a85] hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form URL */}
      {form.is_public && (
        <div className="border-t border-[#e7e1d8] pt-5">
          <label className="text-[11px] font-medium text-[#8a8a85] mb-1.5 block">Form URL</label>
          <div className="flex items-center gap-2 rounded-lg border border-[#e7e1d8] bg-[#f9f7f4] px-3 py-2">
            <span className="flex-1 truncate text-[11.5px] text-gray-700">{publicUrl}</span>
            <button onClick={handleCopy} className="shrink-0 text-[#8a8a85] hover:text-violet-600">
              {copied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
