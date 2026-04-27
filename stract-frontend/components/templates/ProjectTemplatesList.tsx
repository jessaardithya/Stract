'use client';

import { Skeleton } from '@/components/ui/skeleton';
import type { ProjectTemplateListItem } from '@/types';
import ProjectTemplateCard from './ProjectTemplateCard';

interface ProjectTemplatesListProps {
  templates: ProjectTemplateListItem[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}

export default function ProjectTemplatesList({
  templates,
  selectedId,
  loading,
  onSelect,
}: ProjectTemplatesListProps) {
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
        <ProjectTemplateCard
          key={template.id}
          template={template}
          isSelected={template.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
