"use client";

import { useState, useEffect, useCallback } from "react";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  format,
  startOfWeek,
  endOfWeek,
  isSameMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import { useApp } from "@/context/AppContext";
import { useStatuses } from "@/context/StatusContext";
import { getTasks, updateTask } from "@/lib/api";
import { buildMonthGrid, buildWeekGrid } from "./useCalendarData";
import CalendarMonthGrid from "./CalendarMonthGrid";
import CalendarWeekGrid from "./CalendarWeekGrid";
import type { Task } from "@/types";

type CalendarMode = "month" | "week";

export default function CalendarView() {
  const { activeWorkspace, activeProject, openTask } = useApp();
  const { statuses } = useStatuses();

  const [mode, setMode] = useState<CalendarMode>("month");
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Require ≥8px movement before a drag starts — plain clicks go through normally
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Navigation
  const goBack = () =>
    setViewDate((prev) => (mode === "week" ? subWeeks(prev, 1) : subMonths(prev, 1)));
  const goForward = () =>
    setViewDate((prev) => (mode === "week" ? addWeeks(prev, 1) : addMonths(prev, 1)));
  const goToday = () => setViewDate(new Date());

  // Header title
  const headerTitle =
    mode === "week"
      ? (() => {
          const s = startOfWeek(viewDate, { weekStartsOn: 0 });
          const e = endOfWeek(viewDate, { weekStartsOn: 0 });
          return isSameMonth(s, e)
            ? `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`
            : `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
        })()
      : format(viewDate, "MMMM yyyy");

  // Fetch tasks with a due_date
  const fetchTasks = useCallback(async () => {
    if (!activeWorkspace || !activeProject) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getTasks(activeWorkspace.id, activeProject.id);
      setTasks((res.data ?? []).filter((t: Task) => !!t.due_date));
    } catch (err) {
      console.error("[CalendarView] failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, activeProject]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  // Drag end — update due_date optimistically
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !activeWorkspace) return;

      const taskId = active.id as string;
      const newDate = over.id as string; // "yyyy-MM-dd"

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, due_date: newDate } : t)),
      );

      try {
        await updateTask(activeWorkspace.id, taskId, { due_date: newDate });
      } catch {
        void fetchTasks(); // rollback on failure
      }
    },
    [activeWorkspace, fetchTasks],
  );

  const gridDays =
    mode === "month"
      ? buildMonthGrid(tasks, viewDate)
      : buildWeekGrid(tasks, viewDate);

  if (!activeWorkspace || !activeProject) {
    return (
      <div className="rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] p-8 text-[#1f1b17] shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f877a]">
          Calendar
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
          Pick a project to see the calendar.
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <section className="flex flex-col gap-3 rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] px-5 py-5 shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f877a]">
            Calendar
          </p>
          <h1 className="mt-1.5 text-[2rem] font-semibold tracking-[-0.05em] text-[#1f1b17]">
            {activeProject.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#746d62]">
            {activeProject.description?.trim() ||
              "View and manage tasks by due date. Click a task to open it, drag it to reschedule, or hover a day to add a new task."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5e564a]">
            <CalendarRange className="h-3.5 w-3.5" />
            {tasks.length} task{tasks.length === 1 ? "" : "s"} with due dates
          </span>
        </div>
      </section>

      {/* Calendar panel */}
      <section className="rounded-[18px] border border-[#e7e2d8] bg-white shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)] overflow-hidden">
        {/* Toolbar */}
        <div className="h-12 flex items-center justify-between border-b border-[#e4e4e0] px-5">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-900 min-w-[180px]">
              {headerTitle}
            </h2>
            <div className="flex items-center gap-0.5">
              <button
                onClick={goBack}
                className="w-7 h-7 flex items-center justify-center rounded-md
                           text-gray-400 hover:text-gray-700 hover:bg-[#f4f4f2] transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={goToday}
                className="px-2.5 h-7 text-xs font-medium text-gray-600 rounded-md
                           border border-[#e4e4e0] hover:bg-[#f4f4f2] transition-colors"
              >
                Today
              </button>
              <button
                onClick={goForward}
                className="w-7 h-7 flex items-center justify-center rounded-md
                           text-gray-400 hover:text-gray-700 hover:bg-[#f4f4f2] transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-0.5 bg-[#f4f4f2] rounded-lg p-0.5">
            {(["month", "week"] as CalendarMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize
                  ${
                    mode === m
                      ? "bg-white text-gray-900 shadow-sm border border-[#e4e4e0]"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar body */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {loading ? (
            <CalendarSkeleton />
          ) : mode === "month" ? (
            <CalendarMonthGrid
              days={gridDays}
              statuses={statuses}
              onTaskClick={openTask}
              workspaceId={activeWorkspace.id}
              projectId={activeProject.id}
              onTaskCreated={() => void fetchTasks()}
            />
          ) : (
            <CalendarWeekGrid
              days={gridDays}
              statuses={statuses}
              onTaskClick={openTask}
              workspaceId={activeWorkspace.id}
              projectId={activeProject.id}
              onTaskCreated={() => void fetchTasks()}
            />
          )}
        </DndContext>
      </section>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-7 border-b border-[#e4e4e0]">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-10 border-r border-[#e4e4e0] last:border-r-0" />
        ))}
      </div>
      <div className="grid grid-cols-7">
        {[...Array(35)].map((_, i) => (
          <div
            key={i}
            className="min-h-[110px] p-2 border-r border-b border-[#e4e4e0] last:border-r-0"
          >
            <div className="w-7 h-7 rounded-full bg-zinc-100 ml-auto mb-2" />
            {i % 4 === 0 && (
              <div className="h-5 bg-zinc-100 rounded-md w-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
