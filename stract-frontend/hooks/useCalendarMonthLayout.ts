"use client";

import { useMemo } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Task } from "@/types";

export type CalendarDay = {
  key: string;
  date: Date;
  dayNumber: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
};

export type CalendarMonthLayout = {
  monthLabel: string;
  weekdays: string[];
  weeks: CalendarDay[][];
  visibleTaskCount: number;
};

const WEEK_STARTS_ON = 0 as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getTaskCalendarDate(task: Task): Date | null {
  const anchor = task.due_date || task.start_date;
  return anchor ? parseISO(anchor) : null;
}

function priorityWeight(priority?: string): number {
  switch (priority) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 3;
  }
}

export function useCalendarMonthLayout(
  tasks: Task[],
  month: Date,
): CalendarMonthLayout {
  return useMemo(() => {
    const monthStart = startOfMonth(month);
    const rangeStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
    const rangeEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: WEEK_STARTS_ON });

    const tasksByDay = new Map<string, Task[]>();

    tasks.forEach((task) => {
      const date = getTaskCalendarDate(task);
      if (!date) return;

      const key = format(date, "yyyy-MM-dd");
      const existing = tasksByDay.get(key) || [];
      existing.push(task);
      existing.sort((left, right) => {
        const priorityDiff = priorityWeight(left.priority) - priorityWeight(right.priority);
        if (priorityDiff !== 0) return priorityDiff;
        return left.title.localeCompare(right.title);
      });
      tasksByDay.set(key, existing);
    });

    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map((date) => {
      const key = format(date, "yyyy-MM-dd");
      return {
        key,
        date,
        dayNumber: format(date, "d"),
        isCurrentMonth: isSameMonth(date, monthStart),
        isToday: isToday(date),
        tasks: tasksByDay.get(key) || [],
      };
    });

    const weeks: CalendarDay[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      weeks.push(days.slice(index, index + 7));
    }

    const visibleTaskCount = days.reduce((sum, day) => {
      if (!day.isCurrentMonth) return sum;
      return sum + day.tasks.length;
    }, 0);

    return {
      monthLabel: format(monthStart, "MMMM yyyy"),
      weekdays: WEEKDAYS,
      weeks,
      visibleTaskCount,
    };
  }, [month, tasks]);
}
