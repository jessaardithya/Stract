"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  subMonths,
} from "date-fns";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GitBranch,
  MoveHorizontal,
  PanelLeftClose,
  ZoomIn,
} from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/context/AppContext";
import { getTask, getTasks, updateTask } from "@/lib/api";
import { useRealtime } from "@/hooks/useRealtime";
import type { Task } from "@/types";
import {
  useTimelineLayout,
  type TimelineZoom,
} from "@/hooks/useTimelineLayout";
import TaskListPanel from "@/components/timeline/TaskListPanel";
import TimelineGrid from "@/components/timeline/TimelineGrid";
import TimelineUnscheduled from "@/components/timeline/TimelineUnscheduled";

const ZOOM_OPTIONS: { value: TimelineZoom; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
];
const LEFT_PANEL_STORAGE_KEY = "timeline.left-panel-size";
const DEFAULT_LEFT_PANEL_SIZE = 28;

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 rounded-[18px]" />
      <div className="h-[640px] rounded-[18px] border border-[#e7e2d8] bg-white" />
    </div>
  );
}

function shiftDateString(dateValue: string | null, dayDelta: number): string | null {
  if (!dateValue) return null;
  return format(addDays(parseISO(dateValue), dayDelta), "yyyy-MM-dd");
}

function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function getInitialPanelSize(): number {
  if (typeof window === "undefined") return DEFAULT_LEFT_PANEL_SIZE;
  const stored = window.localStorage.getItem(LEFT_PANEL_STORAGE_KEY);
  const parsed = stored ? Number(stored) : NaN;
  if (Number.isFinite(parsed) && parsed >= 20 && parsed <= 40) {
    return parsed;
  }
  return DEFAULT_LEFT_PANEL_SIZE;
}

function getTaskRange(task: Task): { start: Date; end: Date } | null {
  const startDate = task.start_date ? parseISO(task.start_date) : null;
  const dueDate = task.due_date ? parseISO(task.due_date) : null;

  if (!startDate || !dueDate) {
    return null;
  }

  if (startDate <= dueDate) {
    return { start: startDate, end: dueDate };
  }

  return { start: dueDate, end: startDate };
}

function getGuardedDelta(task: Task, dayDelta: number, projectCreatedAt: string | undefined): number {
  if (!projectCreatedAt) return dayDelta;

  const guardDate = startOfDay(parseISO(projectCreatedAt));
  const earliestDateValue = task.start_date || task.due_date;
  if (!earliestDateValue) return dayDelta;

  const earliestDate = startOfDay(parseISO(earliestDateValue));
  const candidate = addDays(earliestDate, dayDelta);

  if (candidate >= guardDate) {
    return dayDelta;
  }

  return differenceInCalendarDays(guardDate, earliestDate);
}

function hasTimelineDates(task: Task): boolean {
  return Boolean(task.start_date && task.due_date);
}

function upsertTask(tasks: Task[], nextTask: Task): Task[] {
  const existingIndex = tasks.findIndex((item) => item.id === nextTask.id);
  if (existingIndex === -1) {
    return [...tasks, nextTask];
  }

  return tasks.map((item) => (item.id === nextTask.id ? { ...item, ...nextTask } : item));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

export default function TimelineView() {
  const { activeWorkspace, activeProject } = useApp();
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<TimelineZoom>("month");
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [showDependencies, setShowDependencies] = useState(true);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [leftPanelSize, setLeftPanelSize] = useState<number>(getInitialPanelSize);
  const mutationInFlightRef = useRef<boolean>(false);
  const todayLineRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    const projectId = activeProject?.id;

    const load = async () => {
      if (!workspaceId || !projectId) {
        setScheduledTasks([]);
        setUnscheduledTasks([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [scheduledResult, unscheduledResult] = await Promise.all([
          getTasks(workspaceId, projectId, { has_dates: "true" }),
          getTasks(workspaceId, projectId, { has_dates: "false" }),
        ]);
        setScheduledTasks(scheduledResult.data || []);
        setUnscheduledTasks(unscheduledResult.data || []);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [activeProject?.id, activeWorkspace?.id]);

  const layout = useTimelineLayout(scheduledTasks, zoom, viewDate);
  const totalTimelineTasks = scheduledTasks.length + unscheduledTasks.length;
  const toolbarTitle =
    zoom === "quarter"
      ? `${format(viewDate, "MMMM yyyy")} - ${format(addMonths(viewDate, 2), "MMMM yyyy")}`
      : format(viewDate, "MMMM yyyy");

  const syncTaskFromServer = useCallback(
    async (taskId: string) => {
      if (!activeWorkspace?.id || !activeProject?.id) return;

      try {
        const result = await getTask(activeWorkspace.id, taskId);
        const nextTask = result.data;
        if (!nextTask) return;

        if (nextTask.project_id !== activeProject.id) {
          setScheduledTasks((current) => current.filter((item) => item.id !== taskId));
          setUnscheduledTasks((current) => current.filter((item) => item.id !== taskId));
          return;
        }

        if (hasTimelineDates(nextTask)) {
          setScheduledTasks((current) => upsertTask(current, nextTask));
          setUnscheduledTasks((current) => current.filter((item) => item.id !== taskId));
        } else {
          setUnscheduledTasks((current) => upsertTask(current, nextTask));
          setScheduledTasks((current) => current.filter((item) => item.id !== taskId));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[timeline] failed to sync task from SSE:", message);
      }
    },
    [activeProject?.id, activeWorkspace?.id],
  );

  const onRealtimeEvent = useCallback(
    (event: { action: string; task_id: string }, isSelf: boolean) => {
      if (!activeProject?.id || isSelf) return;

      if (event.action === "deleted") {
        setScheduledTasks((current) => current.filter((item) => item.id !== event.task_id));
        setUnscheduledTasks((current) => current.filter((item) => item.id !== event.task_id));
        return;
      }

      if (event.action === "updated" || event.action === "moved" || event.action === "created") {
        void syncTaskFromServer(event.task_id);
      }
    },
    [activeProject?.id, syncTaskFromServer],
  );

  useRealtime(onRealtimeEvent, mutationInFlightRef);

  useEffect(() => {
    if (loading) return;

    const rafId = window.requestAnimationFrame(() => {
      todayLineRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [loading, viewDate, zoom, activeProject?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "w") setZoom("week");
      if (key === "m") setZoom("month");
      if (key === "q") setZoom("quarter");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleBarDragEnd = async (taskId: string, dayDelta: number) => {
    if (!activeWorkspace?.id) return;

    const task = scheduledTasks.find((item) => item.id === taskId);
    if (!task) return;

    const guardedDelta = getGuardedDelta(task, dayDelta, activeProject?.created_at);
    if (guardedDelta === 0) return;

    const previousDates = {
      start_date: task.start_date,
      due_date: task.due_date,
    };

    const payload = {
      start_date: shiftDateString(task.start_date, guardedDelta),
      due_date: shiftDateString(task.due_date, guardedDelta),
    };

    mutationInFlightRef.current = true;
    setScheduledTasks((current) =>
      current.map((item) =>
        item.id === taskId
          ? { ...item, start_date: payload.start_date, due_date: payload.due_date }
          : item,
      ),
    );

    try {
      const result = await updateTask(activeWorkspace.id, taskId, payload);
      setScheduledTasks((current) =>
        current.map((item) => (item.id === taskId ? { ...item, ...result.data } : item)),
      );
    } catch (err) {
      setScheduledTasks((current) =>
        current.map((item) =>
          item.id === taskId
            ? { ...item, start_date: previousDates.start_date, due_date: previousDates.due_date }
            : item,
        ),
      );
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to move timeline bar: ${message}`);
    } finally {
      window.setTimeout(() => {
        mutationInFlightRef.current = false;
      }, 500);
    }
  };

  const handleBarResizeEnd = async (
    taskId: string,
    edge: "left" | "right",
    dayDelta: number,
  ) => {
    if (!activeWorkspace?.id || dayDelta === 0) return;

    const task = scheduledTasks.find((item) => item.id === taskId);
    if (!task) return;

    const range = getTaskRange(task);
    if (!range) return;

    const previousDates = {
      start_date: task.start_date,
      due_date: task.due_date,
    };

    const payload =
      edge === "left"
        ? { start_date: toDateString(addDays(range.start, dayDelta)) }
        : { due_date: toDateString(addDays(range.end, dayDelta)) };

    mutationInFlightRef.current = true;
    setScheduledTasks((current) =>
      current.map((item) => (item.id === taskId ? { ...item, ...payload } : item)),
    );

    try {
      const result = await updateTask(activeWorkspace.id, taskId, payload);
      setScheduledTasks((current) =>
        current.map((item) => (item.id === taskId ? { ...item, ...result.data } : item)),
      );
    } catch (err) {
      setScheduledTasks((current) =>
        current.map((item) =>
          item.id === taskId
            ? { ...item, start_date: previousDates.start_date, due_date: previousDates.due_date }
            : item,
        ),
      );
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to resize timeline bar: ${message}`);
    } finally {
      window.setTimeout(() => {
        mutationInFlightRef.current = false;
      }, 500);
    }
  };

  const handleScheduleTask = async (taskId: string, startDate: string, dueDate: string) => {
    if (!activeWorkspace?.id) {
      throw new Error("No active workspace");
    }

    const task = unscheduledTasks.find((item) => item.id === taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const optimisticTask: Task = {
      ...task,
      start_date: startDate,
      due_date: dueDate,
    };

    mutationInFlightRef.current = true;
    setUnscheduledTasks((current) => current.filter((item) => item.id !== taskId));
    setScheduledTasks((current) => [...current, optimisticTask]);

    try {
      const result = await updateTask(activeWorkspace.id, taskId, {
        start_date: startDate,
        due_date: dueDate,
      });
      setScheduledTasks((current) =>
        current.map((item) => (item.id === taskId ? { ...item, ...result.data } : item)),
      );
    } catch (err) {
      setScheduledTasks((current) => current.filter((item) => item.id !== taskId));
      setUnscheduledTasks((current) => [...current, task]);
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to schedule task: ${message}`);
      throw err;
    } finally {
      window.setTimeout(() => {
        mutationInFlightRef.current = false;
      }, 500);
    }
  };

  const goBack = () => {
    setViewDate((current) => subMonths(current, zoom === "quarter" ? 3 : 1));
  };

  const goForward = () => {
    setViewDate((current) => addMonths(current, zoom === "quarter" ? 3 : 1));
  };

  const goToday = () => {
    setViewDate(new Date());
  };

  if (!activeWorkspace || !activeProject) {
    return (
      <div className="rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] p-8 text-[#1f1b17] shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f877a]">
          Timeline
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
          Pick a project to see the timeline.
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] px-5 py-5 shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f877a]">
            Timeline
          </p>
          <h1 className="mt-1.5 text-[2rem] font-semibold tracking-[-0.05em] text-[#1f1b17]">
            {activeProject.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#746d62]">
            {activeProject.description?.trim() ||
              "Move scheduled work across time and keep the timeline aligned with real task dates."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5e564a]">
            <CalendarRange className="h-3.5 w-3.5" />
            {scheduledTasks.length} scheduled task{scheduledTasks.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5e564a]">
            <PanelLeftClose className="h-3.5 w-3.5" />
            {unscheduledTasks.length} unscheduled
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5e564a]">
            <MoveHorizontal className="h-3.5 w-3.5" />
            Drag or resize to adjust dates
          </span>
        </div>
      </section>

      <section className="rounded-[18px] border border-[#e7e2d8] bg-white shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
        <div className="flex h-12 items-center justify-between border-b border-[#e4e4e0] px-5">
          <div className="flex items-center gap-3">
            <h2 className="min-w-[150px] text-sm font-semibold text-gray-900">
              {toolbarTitle}
            </h2>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6f6659] hover:bg-[#f4f4f2]"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-md border border-[#e4e4e0] px-2.5 py-1 text-xs font-medium text-[#4f4a44] hover:bg-[#f4f4f2]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={goForward}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6f6659] hover:bg-[#f4f4f2]"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDependencies((current) => !current)}
              className={`rounded-full border px-3 text-xs ${
                showDependencies
                  ? "border-[#d9d0ff] bg-[#f5f3ff] text-[#5b4cd8] hover:bg-[#ede9fe]"
                  : "border-[#e6dfd2] bg-white text-[#5e564a] hover:bg-[#f5f2ec]"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              {showDependencies ? "Hide dependencies" : "Show dependencies"}
            </Button>
            <div className="inline-flex items-center gap-1 rounded-full border border-[#e6dfd2] bg-white p-1">
              {ZOOM_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom(option.value)}
                  className={`rounded-full px-3 text-xs ${
                    zoom === option.value
                      ? "bg-[#1f1b17] text-white hover:bg-[#1f1b17]"
                      : "text-[#5e564a] hover:bg-[#f5f2ec]"
                  }`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <Alert variant="destructive" className="rounded-2xl border-red-200 bg-white">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <TimelineSkeleton />
      ) : (
        <>
          {scheduledTasks.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[#d9d2c6] bg-[#fbfaf7] px-8 py-16 text-center text-[#1f1b17] shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5efe5] text-[#8f877a]">
                {totalTimelineTasks === 0 ? <ZoomIn className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em]">
                {totalTimelineTasks === 0 ? "No tasks yet" : "No scheduled tasks yet"}
              </h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#746d62]">
                {totalTimelineTasks === 0
                  ? "Create a few tasks first, then give them both start and due dates to see the timeline populate."
                  : "Tasks missing either a start date or due date are listed below. Set both dates to move them straight into the timeline."}
              </p>
            </div>
          ) : (
            <div className="rounded-[20px] border border-[#e7e2d8] bg-[#fbfaf7] p-3 shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
              {zoom === "month" ? (
                <Group orientation="horizontal" className="min-h-0">
                  <Panel
                    id="timeline-task-list"
                    defaultSize={leftPanelSize}
                    minSize="220px"
                    maxSize="34%"
                    onResize={(size) => {
                      if (typeof size !== "number") return;
                      setLeftPanelSize(size);
                      window.localStorage.setItem(LEFT_PANEL_STORAGE_KEY, String(size));
                    }}
                  >
                    <div className="h-full overflow-hidden rounded-[18px] border border-[#e7e2d8] bg-white">
                      <TaskListPanel tasks={layout.tasks} hoveredTaskId={hoveredTaskId} />
                    </div>
                  </Panel>

                  <Separator className="mx-2 w-2 rounded-full bg-transparent transition-colors hover:bg-[#ece6da] data-[active=true]:bg-[#ddd4c7]" />

                  <Panel id="timeline-grid" minSize="520px">
                    <div className="overflow-hidden rounded-[18px] border border-[#e7e2d8] bg-white">
                      <TimelineGrid
                        layout={layout}
                        onBarDragEnd={handleBarDragEnd}
                        onBarResizeEnd={handleBarResizeEnd}
                        projectCreatedAt={activeProject.created_at}
                        showDependencies={showDependencies}
                        hoveredTaskId={hoveredTaskId}
                        onHoverChange={setHoveredTaskId}
                        todayLineRef={todayLineRef}
                      />
                    </div>
                  </Panel>
                </Group>
              ) : (
                <div className="overflow-hidden rounded-[18px] border border-[#e7e2d8] bg-white">
                  <TimelineGrid
                    layout={layout}
                    onBarDragEnd={handleBarDragEnd}
                    onBarResizeEnd={handleBarResizeEnd}
                    projectCreatedAt={activeProject.created_at}
                    showDependencies={showDependencies}
                    hoveredTaskId={hoveredTaskId}
                    onHoverChange={setHoveredTaskId}
                    todayLineRef={todayLineRef}
                  />
                </div>
              )}
            </div>
          )}

          <TimelineUnscheduled tasks={unscheduledTasks} onSchedule={handleScheduleTask} />
        </>
      )}
    </div>
  );
}
