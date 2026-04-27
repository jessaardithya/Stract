'use client';

import { CheckSquare, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskTemplateListItem } from '@/types';

interface TaskTemplateCardProps {
  template: TaskTemplateListItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export default function TaskTemplateCard({
  template,
  isSelected,
  onSelect,
}: TaskTemplateCardProps) {
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
      <p className="truncate text-sm font-semibold text-[#1f1b17]">{template.name}</p>
      <p className="mt-1 text-sm text-[#4f4a43]">{template.title}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#746d62]">
        {template.description?.trim() || 'Reusable task blueprint for recurring work.'}
      </p>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-[#8f877a]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ece5d8] bg-[#faf7f1] px-2 py-1 capitalize">
          {template.priority}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ece5d8] bg-[#faf7f1] px-2 py-1">
          <CheckSquare className="h-3.5 w-3.5" />
          {template.checklist_count} items
        </span>
        {template.label && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ece5d8] bg-[#faf7f1] px-2 py-1">
            <Tag className="h-3.5 w-3.5" />
            {template.label}
          </span>
        )}
      </div>
    </button>
  );
}
