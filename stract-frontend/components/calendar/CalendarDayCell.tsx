"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import type { CalendarDay } from "./useCalendarData";
import type { ProjectStatus } from "@/types";
import CalendarTaskChip from "./CalendarTaskChip";
import CalendarQuickCreate from "./CalendarQuickCreate";

interface CalendarDayCellProps {
  day: CalendarDay;
  statuses: ProjectStatus[];
  onTaskClick: (id: string) => void;
  workspaceId: string;
  projectId: string;
  onTaskCreated: () => void;
  isLastRow: boolean;
}

export default function CalendarDayCell({
  day,
  statuses,
  onTaskClick,
  workspaceId,
  projectId,
  onTaskCreated,
  isLastRow,
}: CalendarDayCellProps) {
  const dateStr = format(day.date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const [showCreate, setShowCreate] = useState<boolean>(false);

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[110px] p-2 border-r border-b border-[#e4e4e0]
        last:border-r-0 relative group transition-colors
        ${isLastRow ? "border-b-0" : ""}
        ${isOver
          ? "bg-violet-50"
          : day.isCurrentMonth
            ? "bg-white"
            : "bg-[#fafaf9]"}
      `}
    >
      {/* Day number + add button */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={`
            w-7 h-7 flex items-center justify-center rounded-full
            text-[13px] font-medium select-none
            ${day.isToday
              ? "bg-violet-600 text-white font-bold"
              : day.isCurrentMonth
                ? "text-gray-700"
                : "text-gray-300"}
          `}
        >
          {format(day.date, "d")}
        </span>
        <button
          onClick={() => setShowCreate(true)}
          className="w-5 h-5 flex items-center justify-center rounded
                     text-gray-300 hover:text-violet-600 hover:bg-violet-50
                     opacity-0 group-hover:opacity-100 transition-all"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Task chips */}
      <div className="space-y-0.5">
        {day.tasks.map((task) => (
          <CalendarTaskChip
            key={task.id}
            task={task}
            statuses={statuses}
            onClick={() => onTaskClick(task.id)}
          />
        ))}
      </div>

      {/* Quick create */}
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
