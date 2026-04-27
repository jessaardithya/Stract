'use client';

import { Layers3, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectTemplateListItem } from '@/types';

interface ProjectTemplateCardProps {
  template: ProjectTemplateListItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export default function ProjectTemplateCard({
  template,
  isSelected,
  onSelect,
}: ProjectTemplateCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className={cn(
        'w-full rounded-xl border bg-white p-4 text-left transition-all',
        isSelected
          ? 'border-[#cfc4ff] shadow-[0_12px_32px_-26px_rgba(99,102,241,0.5)]'
          : 'border-[#e4e4e0] hover:border-[#d4cfc4] hover:bg-[#fffdf8]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: template.color }}
            />
            <p className="truncate text-sm font-semibold text-[#1f1b17]">{template.name}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#746d62]">
            {template.description?.trim() || 'Reusable setup for a new project.'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-[#8f877a]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ece5d8] bg-[#faf7f1] px-2 py-1">
          <Layers3 className="h-3.5 w-3.5" />
          {template.status_count} statuses
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ece5d8] bg-[#faf7f1] px-2 py-1">
          <ListTodo className="h-3.5 w-3.5" />
          {template.task_count} tasks
        </span>
      </div>
    </button>
  );
}
