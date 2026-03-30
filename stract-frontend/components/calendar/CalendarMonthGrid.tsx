"use client";

import { format } from "date-fns";
import type { CalendarDay } from "./useCalendarData";
import type { ProjectStatus } from "@/types";
import CalendarDayCell from "./CalendarDayCell";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarMonthGridProps {
  days: CalendarDay[];
  statuses: ProjectStatus[];
  onTaskClick: (id: string) => void;
  workspaceId: string;
  projectId: string;
  onTaskCreated: () => void;
}

export default function CalendarMonthGrid({
  days,
  statuses,
  onTaskClick,
  workspaceId,
  projectId,
  onTaskCreated,
}: CalendarMonthGridProps) {
  return (
    <div>
      {/* Weekday header row */}
      <div className="grid grid-cols-7 border-b border-[#e4e4e0]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-2.5 text-center text-[11px] font-semibold text-gray-400
                       uppercase tracking-widest border-r border-[#e4e4e0] last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => (
          <CalendarDayCell
            key={format(day.date, "yyyy-MM-dd")}
            day={day}
            statuses={statuses}
            onTaskClick={onTaskClick}
            workspaceId={workspaceId}
            projectId={projectId}
            onTaskCreated={onTaskCreated}
            isLastRow={i >= days.length - 7}
          />
        ))}
      </div>
    </div>
  );
}
