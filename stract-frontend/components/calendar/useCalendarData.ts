import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import type { Task } from "@/types";

export interface CalendarDay {
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  tasks: Task[];
}

export function buildMonthGrid(tasks: Task[], viewDate: Date): CalendarDay[] {
  const gridStart = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });

  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) => ({
    date,
    isToday: isToday(date),
    isCurrentMonth: isSameMonth(date, viewDate),
    tasks: tasks.filter(
      (t) => t.due_date && isSameDay(new Date(t.due_date), date),
    ),
  }));
}

export function buildWeekGrid(tasks: Task[], viewDate: Date): CalendarDay[] {
  const weekStart = startOfWeek(viewDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(viewDate, { weekStartsOn: 0 });

  return eachDayOfInterval({ start: weekStart, end: weekEnd }).map((date) => ({
    date,
    isToday: isToday(date),
    isCurrentMonth: isSameMonth(date, viewDate),
    tasks: tasks.filter(
      (t) => t.due_date && isSameDay(new Date(t.due_date), date),
    ),
  }));
}
