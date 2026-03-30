"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { CalendarDay } from "./useCalendarData";
import type { ProjectStatus } from "@/types";
import CalendarTaskChip from "./CalendarTaskChip";
import CalendarQuickCreate from "./CalendarQuickCreate";

interface CalendarWeekCellProps {
  day: CalendarDay;
  statuses: ProjectStatus[];
  onTaskClick: (id: string) => void;
  workspaceId: string;
  projectId: string;
  onTaskCreated: () => void;
}

export default function CalendarWeekCell({
  day,
  statuses,
  onTaskClick,
  workspaceId,
  projectId,
  onTaskCreated,
}: CalendarWeekCellProps) {
  const dateStr = format(day.date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const [showCreate, setShowCreate] = useState<boolean>(false);

  return (
    <div
      ref={setNodeRef}
      className={`
        p-2 border-r border-[#e4e4e0] last:border-r-0
        relative group transition-colors
        ${isOver ? "bg-violet-50" : "bg-white hover:bg-[#fafaf9]"}
      `}
    >
      <button
        onClick={() => setShowCreate(true)}
        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center
                   rounded text-gray-300 hover:text-violet-600 hover:bg-violet-50
                   opacity-0 group-hover:opacity-100 transition-all"
      >
        <Plus size={12} />
      </button>

      <div className="space-y-1 mt-1">
        {day.tasks.map((task) => (
          <CalendarTaskChip
            key={task.id}
            task={task}
            statuses={statuses}
            onClick={() => onTaskClick(task.id)}
          />
        ))}
      </div>

      {showCreate && (
        <CalendarQuickCreate
          date={day.date}
          workspaceId={workspaceId}
          projectId={projectId}
          onCreated={() => {
            setShowCreate(false);
            onTaskCreated();
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
