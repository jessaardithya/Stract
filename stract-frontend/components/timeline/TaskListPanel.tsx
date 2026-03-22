"use client";

import { CalendarDays } from "lucide-react";
import type { TimelineTaskLayout } from "@/hooks/useTimelineLayout";
import { formatDate } from "@/utils/date";

function formatTaskWindow(startDate: string | null, dueDate: string | null): string {
  const start = formatDate(startDate);
  const end = formatDate(dueDate);

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end || "No schedule";
}

export default function TaskListPanel({
  tasks,
  hoveredTaskId,
}: {
  tasks: TimelineTaskLayout[];
  hoveredTaskId: string | null;
}) {
  return (
    <div className="h-full bg-white">
      <div className="border-b border-[#e4e4e0] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f877a]">
          Tasks
        </p>
      </div>

      <div className="max-h-[760px] overflow-y-auto">
        {tasks.map((item) => (
          <div
            key={item.task.id}
            className={`border-b border-[#f0f0ec] px-4 py-3 transition-colors ${
              hoveredTaskId === item.task.id ? "bg-[#f5f3ff]" : "bg-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.task.status?.color || "#9ca3af" }}
              />
              <p className="truncate text-sm font-medium text-[#2d2d2a]">
                {item.task.title}
              </p>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8a8479]">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="truncate">
                {formatTaskWindow(item.task.start_date, item.task.due_date)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
