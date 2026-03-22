"use client";

import { useMemo } from "react";
import {
  addMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Task } from "@/types";

export type TimelineZoom = "week" | "month" | "quarter";

export type TimelineTaskLayout = {
  task: Task;
  start: Date;
  end: Date;
};

export type TimelineTaskSegment = {
  key: string;
  task: Task;
  start: Date;
  end: Date;
  segmentStart: Date;
  segmentEnd: Date;
  startCol: number;
  endCol: number;
  laneIndex: number;
  top: number;
  leftPercent: number;
  widthPercent: number;
  isFirstWeekSegment: boolean;
  isLastWeekSegment: boolean;
  weekKey: string;
};

export type TimelineWeekRow = {
  key: string;
  start: Date;
  end: Date;
  days: Date[];
  top: number;
  height: number;
  segments: TimelineTaskSegment[];
};

export type TimelineMonthSection = {
  key: string;
  title: string;
  monthDate: Date;
  weeks: TimelineWeekRow[];
  totalHeight: number;
};

export type TimelineLayout = {
  zoom: TimelineZoom;
  viewDate: Date;
  weekdayLabels: string[];
  barHeight: number;
  months: TimelineMonthSection[];
  tasks: TimelineTaskLayout[];
};

const WEEK_STARTS_ON = 0 as const;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ZOOM_CONFIG = {
  week: {
    minWeekHeight: 180,
    barHeight: 28,
    barGap: 6,
    barTop: 42,
  },
  month: {
    minWeekHeight: 120,
    barHeight: 28,
    barGap: 6,
    barTop: 36,
  },
  quarter: {
    minWeekHeight: 120,
    barHeight: 28,
    barGap: 6,
    barTop: 36,
  },
} as const;

function toTimelineDate(dateValue: string | null | undefined): Date | null {
  if (!dateValue) return null;
  return parseISO(dateValue);
}

function getTaskRange(task: Task): { start: Date; end: Date } | null {
  const startDate = toTimelineDate(task.start_date);
  const dueDate = toTimelineDate(task.due_date);

  if (!startDate || !dueDate) {
    return null;
  }

  if (startDate <= dueDate) {
    return { start: startDate, end: dueDate };
  }

  return { start: dueDate, end: startDate };
}

function buildWeekRow(
  weekStart: Date,
  normalizedTasks: TimelineTaskLayout[],
  config: (typeof ZOOM_CONFIG)[TimelineZoom],
  top: number,
): TimelineWeekRow {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: WEEK_STARTS_ON });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const rawSegments = normalizedTasks
    .filter((item) => item.start <= weekEnd && item.end >= weekStart)
    .map((item) => {
      const segmentStart = item.start > weekStart ? item.start : weekStart;
      const segmentEnd = item.end < weekEnd ? item.end : weekEnd;
      const startCol = getDay(segmentStart);
      const endCol = getDay(segmentEnd);

      return {
        task: item.task,
        start: item.start,
        end: item.end,
        segmentStart,
        segmentEnd,
        startCol,
        endCol,
      };
    })
    .sort((left, right) => {
      if (left.startCol !== right.startCol) return left.startCol - right.startCol;
      if (left.endCol !== right.endCol) return right.endCol - left.endCol;
      return left.task.title.localeCompare(right.task.title);
    });

  const laneEnds: number[] = [];
  const segments: TimelineTaskSegment[] = rawSegments.map((segment) => {
    let laneIndex = laneEnds.findIndex((endCol) => segment.startCol > endCol);
    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
    }
    laneEnds[laneIndex] = segment.endCol;

    return {
      key: `${segment.task.id}-${format(weekStart, "yyyy-MM-dd")}`,
      task: segment.task,
      start: segment.start,
      end: segment.end,
      segmentStart: segment.segmentStart,
      segmentEnd: segment.segmentEnd,
      startCol: segment.startCol,
      endCol: segment.endCol,
      laneIndex,
      top: config.barTop + laneIndex * (config.barHeight + config.barGap),
      leftPercent: (segment.startCol / 7) * 100,
      widthPercent: ((segment.endCol - segment.startCol + 1) / 7) * 100,
      isFirstWeekSegment: segment.start >= weekStart,
      isLastWeekSegment: segment.end <= weekEnd,
      weekKey: format(weekStart, "yyyy-MM-dd"),
    };
  });

  const laneCount = Math.max(laneEnds.length, 1);
  const height = Math.max(
    config.minWeekHeight,
    config.barTop + laneCount * (config.barHeight + config.barGap) + 12,
  );

  return {
    key: format(weekStart, "yyyy-MM-dd"),
    start: weekStart,
    end: weekEnd,
    days,
    top,
    height,
    segments,
  };
}

function buildMonthSection(
  monthDate: Date,
  normalizedTasks: TimelineTaskLayout[],
  config: (typeof ZOOM_CONFIG)[TimelineZoom],
  zoom: TimelineZoom,
): TimelineMonthSection {
  const monthStart = zoom === "week"
    ? startOfWeek(monthDate, { weekStartsOn: WEEK_STARTS_ON })
    : startOfMonth(monthDate);
  const monthEnd = zoom === "week"
    ? endOfWeek(monthDate, { weekStartsOn: WEEK_STARTS_ON })
    : endOfMonth(monthDate);
  const weekStarts = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: WEEK_STARTS_ON },
  );

  let currentTop = 0;
  const weeks = weekStarts.map((weekStart) => {
    const week = buildWeekRow(weekStart, normalizedTasks, config, currentTop);
    currentTop += week.height;
    return week;
  });

  return {
    key: format(monthDate, "yyyy-MM"),
    title: format(monthDate, "MMMM yyyy"),
    monthDate,
    weeks,
    totalHeight: currentTop,
  };
}

export function useTimelineLayout(
  tasks: Task[],
  zoom: TimelineZoom,
  viewDate: Date,
): TimelineLayout {
  return useMemo(() => {
    const config = ZOOM_CONFIG[zoom];
    const normalized = tasks
      .map((task) => {
        const range = getTaskRange(task);
        return range ? { task, ...range } : null;
      })
      .filter((item): item is TimelineTaskLayout => item != null)
      .sort((left, right) => {
        const startDiff = left.start.getTime() - right.start.getTime();
        if (startDiff !== 0) return startDiff;
        const endDiff = left.end.getTime() - right.end.getTime();
        if (endDiff !== 0) return endDiff;
        return left.task.title.localeCompare(right.task.title);
      });

    const monthDates =
      zoom === "quarter"
        ? [viewDate, addMonths(viewDate, 1), addMonths(viewDate, 2)].map((date) => startOfMonth(date))
        : [viewDate];

    const months = monthDates.map((monthDate) =>
      buildMonthSection(monthDate, normalized, config, zoom),
    );

    return {
      zoom,
      viewDate,
      weekdayLabels: WEEKDAY_LABELS,
      barHeight: config.barHeight,
      months,
      tasks: normalized,
    };
  }, [tasks, viewDate, zoom]);
}
