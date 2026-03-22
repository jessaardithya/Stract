"use client";

import { useMemo } from "react";
import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { CalendarDays, Flag } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TimelineTaskSegment } from "@/hooks/useTimelineLayout";
import { useBarDrag } from "@/hooks/useBarDrag";
import { useBarResize } from "@/hooks/useBarResize";

const PRIORITY_DOT: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

function hexToRgba(hex: string | undefined, alpha: number): string {
  if (!hex || !hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) {
    return `rgba(99, 102, 241, ${alpha})`;
  }

  const normalized =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatWindow(startDate: string | null, dueDate: string | null): string {
  if (!startDate || !dueDate) return "No dates";
  return `${format(parseISO(startDate), "MMM d")} - ${format(parseISO(dueDate), "MMM d")}`;
}

export default function TimelineBar({
  segment,
  pixelsPerDay,
  barHeight,
  projectCreatedAt,
  onResizeEnd,
  isHovered,
  onHoverChange,
}: {
  segment: TimelineTaskSegment;
  pixelsPerDay: number;
  barHeight: number;
  projectCreatedAt?: string;
  onResizeEnd: (taskId: string, edge: "left" | "right", dayDelta: number) => void;
  isHovered: boolean;
  onHoverChange: (taskId: string | null) => void;
}) {
  const statusColor = segment.task.status?.color || "#6366f1";
  const spanDays = Math.max(differenceInCalendarDays(segment.end, segment.start) + 1, 1);
  const segmentDays = segment.endCol - segment.startCol + 1;
  const segmentWidthPx = segmentDays * pixelsPerDay;
  const compact = segmentWidthPx < 140;

  const { attributes, listeners, setNodeRef, isDragging, transformStyle } = useBarDrag({
    id: segment.key,
    taskId: segment.task.id,
    pixelsPerDay,
  });

  const projectBoundaryShift = useMemo(() => {
    if (!projectCreatedAt) return spanDays * -1;
    const guardDate = startOfDay(parseISO(projectCreatedAt));
    return Math.min(0, differenceInCalendarDays(guardDate, segment.start));
  }, [projectCreatedAt, segment.start, spanDays]);

  const leftResize = useBarResize({
    edge: "left",
    pixelsPerDay,
    minDayDelta: projectBoundaryShift,
    maxDayDelta: spanDays - 1,
    onCommit: (dayDelta) => onResizeEnd(segment.task.id, "left", dayDelta),
  });
  const rightResize = useBarResize({
    edge: "right",
    pixelsPerDay,
    minDayDelta: -(spanDays - 1),
    maxDayDelta: 3650,
    onCommit: (dayDelta) => onResizeEnd(segment.task.id, "right", dayDelta),
  });

  const isResizing = leftResize.isResizing || rightResize.isResizing;
  const widthOffsetPx = rightResize.offsetPx - leftResize.offsetPx;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...attributes}
          {...(!isResizing ? listeners : undefined)}
          className={`absolute flex cursor-grab items-center gap-2 border border-black/[0.06] px-2.5 text-left shadow-sm transition-all ${
            isDragging || isResizing
              ? "z-20 opacity-80 shadow-lg ring-2 ring-violet-300"
              : isHovered
                ? "z-10 brightness-95 ring-1 ring-violet-200"
                : "z-10"
          }`}
          onMouseEnter={() => onHoverChange(segment.task.id)}
          onMouseLeave={() => onHoverChange(null)}
          style={{
            top: segment.top,
            left: `calc(${segment.leftPercent}% + ${leftResize.offsetPx}px)`,
            width: `calc(${segment.widthPercent}% + ${widthOffsetPx}px)`,
            height: barHeight,
            backgroundColor: hexToRgba(statusColor, 0.1),
            borderLeft: `3px solid ${statusColor}`,
            borderRadius: `${segment.isFirstWeekSegment ? "6px" : "0"} ${segment.isLastWeekSegment ? "6px" : "0"} ${segment.isLastWeekSegment ? "6px" : "0"} ${segment.isFirstWeekSegment ? "6px" : "0"}`,
            ...(isResizing ? undefined : transformStyle),
          }}
        >
          {segment.isFirstWeekSegment && (
            <button
              type="button"
              aria-label="Resize start date"
              className="absolute inset-y-0 left-0 z-10 w-3 cursor-w-resize bg-transparent"
              {...leftResize.handleProps}
            />
          )}
          {segment.isLastWeekSegment && (
            <button
              type="button"
              aria-label="Resize due date"
              className="absolute inset-y-0 right-0 z-10 w-3 cursor-e-resize bg-transparent"
              {...rightResize.handleProps}
            />
          )}

          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: PRIORITY_DOT[segment.task.priority] || "#9ca3af" }}
          />

          {segment.isFirstWeekSegment && (
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-700">
              {segment.task.title}
            </span>
          )}

          {segment.isLastWeekSegment && segment.endCol - segment.startCol >= 2 && !compact && (
            <span className="hidden shrink-0 text-[10px] text-gray-400 group-hover:block md:inline-flex md:items-center md:gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatWindow(segment.task.start_date, segment.task.due_date)}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={10} className="max-w-[260px] rounded-xl">
        <div className="space-y-2">
          <p className="font-semibold">{segment.task.title}</p>
          <p className="text-xs opacity-90">{formatWindow(segment.task.start_date, segment.task.due_date)}</p>
          <div className="flex items-center gap-2 text-xs opacity-90">
            <Flag className="h-3.5 w-3.5" />
            <span className="capitalize">{segment.task.priority} priority</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
