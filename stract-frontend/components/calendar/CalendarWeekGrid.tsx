"use client";

import { format } from "date-fns";
import type { CalendarDay } from "./useCalendarData";
import type { ProjectStatus } from "@/types";
import CalendarWeekCell from "./CalendarWeekCell";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarWeekGridProps {
  days: CalendarDay[];
  statuses: ProjectStatus[];
  onTaskClick: (id: string) => void;
  workspaceId: string;
  projectId: string;
  onTaskCreated: () => void;
}

export default function CalendarWeekGrid({
  days,
  statuses,
  onTaskClick,
  workspaceId,
  projectId,
  onTaskCreated,
}: CalendarWeekGridProps) {
  return (
    <div>
      {/* Weekday header row with large date numbers */}
      <div className="grid grid-cols-7 border-b border-[#e4e4e0]">
        {days.map((day, i) => (
          <div
            key={i}
            className="py-3 text-center border-r border-[#e4e4e0] last:border-r-0"
          >
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
              {WEEKDAYS[i]}
            </p>
            <span
              className={`
                w-8 h-8 flex items-center justify-center rounded-full mx-auto
                text-[15px] font-medium
                ${day.isToday ? "bg-violet-600 text-white font-bold" : "text-gray-700"}
              `}
            >
              {format(day.date, "d")}
            </span>
          </div>
        ))}
      </div>

      {/* Tall single row of 7 cells */}
      <div className="grid grid-cols-7" style={{ minHeight: 480 }}>
        {days.map((day, i) => (
          <CalendarWeekCell
            key={i}
            day={day}
            statuses={statuses}
            onTaskClick={onTaskClick}
            workspaceId={workspaceId}
            projectId={projectId}
            onTaskCreated={onTaskCreated}
          />
        ))}
      </div>
    </div>
  );
}
