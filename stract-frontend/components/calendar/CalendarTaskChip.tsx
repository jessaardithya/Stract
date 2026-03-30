"use client";

import { useDraggable } from "@dnd-kit/core";
import type { Task, ProjectStatus } from "@/types";

interface CalendarTaskChipProps {
  task: Task;
  statuses: ProjectStatus[];
  onClick: () => void;
}

export default function CalendarTaskChip({
  task,
  statuses,
  onClick,
}: CalendarTaskChipProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: task.id });

  const status = statuses.find((s) => s.id === task.status_id);
  const statusColor = status?.color ?? "#6b7280";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-md
        text-[11.5px] font-medium cursor-pointer truncate
        border border-black/[0.06] transition-all select-none
        ${isDragging ? "opacity-40 shadow-lg scale-95 z-50" : "hover:brightness-95"}
      `}
      style={{
        backgroundColor: `${statusColor}18`,
        borderLeft: `2.5px solid ${statusColor}`,
        transform: transform
          ? `translate(${transform.x}px, ${transform.y}px)`
          : undefined,
      }}
    >
      <span className="truncate text-gray-700">{task.title}</span>
    </div>
  );
}
