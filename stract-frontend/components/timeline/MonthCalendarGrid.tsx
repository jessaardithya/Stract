"use client";

import { CalendarDays } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import type { CalendarMonthLayout } from "@/hooks/useCalendarMonthLayout";

export default function MonthCalendarGrid({
  layout,
  onPrevious,
  onNext,
  onToday,
}: {
  layout: CalendarMonthLayout;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
      <div className="flex flex-col gap-4 px-2 py-1 md:flex-row md:items-center md:justify-between md:px-3 md:py-2">
        <div className="pl-1">
          <h2 className="text-[2rem] font-semibold tracking-[-0.05em] text-[#1f1b17]">
            {layout.monthLabel}
          </h2>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <div className="inline-flex items-center gap-2 rounded-[10px] border border-[#e5ded2] bg-white px-3 py-2 text-sm font-medium text-[#3f372d]">
            <CalendarDays className="h-4 w-4 text-[#7a7266]" />
            <span>Manage in Calendar</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrevious}
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#8f877a] transition-colors hover:bg-[#f2eee7] hover:text-[#1f1b17]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToday}
              className="h-9 rounded-md px-3 text-[14px] font-medium text-[#3f372d] hover:bg-[#f2eee7] hover:text-[#1f1b17]"
            >
              Today
            </Button>
            <button
              type="button"
              onClick={onNext}
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#8f877a] transition-colors hover:bg-[#f2eee7] hover:text-[#1f1b17]"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 px-px">
        {layout.weekdays.map((weekday) => (
          <div
            key={weekday}
            className="px-3 py-2 text-center text-[15px] font-medium text-[#9a9184]"
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 border-l border-t border-[#e7e2d8]">
        {layout.weeks.flat().map((day) => (
          <div
            key={day.key}
            className="min-h-[128px] border-b border-r border-[#e7e2d8] bg-[#fbfaf7] p-2.5 md:min-h-[164px]"
          >
            <div className="flex justify-center pt-0.5">
              <span
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-[15px] font-medium ${
                  day.isToday
                    ? "bg-[#ea6a5d] text-white"
                    : day.isCurrentMonth
                      ? "text-[#2a241c]"
                      : "text-[#aaa194]"
                }`}
              >
                {day.date.getDate() === 1 ? format(day.date, "MMM d") : day.dayNumber}
              </span>
            </div>

            <div className="mt-2 space-y-2">
              {day.tasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="rounded-[12px] border border-[#e5ded2] bg-[#f1ece4] px-3 py-2 text-[#2a241c]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: task.status?.color || "#a3a3a3" }}
                    />
                    <span className="truncate text-sm font-medium">{task.title}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#7b7367]">
                    <span className="truncate">{task.status?.name || "No status"}</span>
                    <span className="shrink-0 capitalize">{task.priority}</span>
                  </div>
                </div>
              ))}

              {day.tasks.length > 3 && (
                <p className="px-1 text-xs font-medium text-[#938a7d]">
                  +{day.tasks.length - 3} more
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
