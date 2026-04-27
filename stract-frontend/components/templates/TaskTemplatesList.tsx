'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { TaskTemplateListItem } from '@/types';
import TaskTemplateCard from './TaskTemplateCard';

interface TaskTemplatesListProps {
  templates: TaskTemplateListItem[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}

export default function TaskTemplatesList({
  templates,
  selectedId,
  loading,
  onSelect,
}: TaskTemplatesListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl border border-[#e4e4e0]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {templates.map((template) => (
        <TaskTemplateCard
          key={template.id}
          template={template}
          isSelected={template.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
