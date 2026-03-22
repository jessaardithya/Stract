"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Clock3,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Task } from "@/types";

const PRIORITY_DOT: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

function toDateInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function ScheduleRow({
  task,
  onSchedule,
}: {
  task: Task;
  onSchedule: (taskId: string, startDate: string, dueDate: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmit = Boolean(startDate && endDate && !saving);

  const handleConfirm = async () => {
    if (!startDate || !endDate) {
      setError("Pick both a start date and due date.");
      return;
    }

    if (startDate > endDate) {
      setError("Start date must be before or the same as the due date.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSchedule(task.id, toDateInputValue(startDate), toDateInputValue(endDate));
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-[#ede7db] px-4 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: PRIORITY_DOT[task.priority] || "#9ca3af" }}
          />
          <p className="truncate text-sm font-medium text-[#1f1b17]">{task.title}</p>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-[#7a7264]">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {task.status?.name || "Unscheduled"} · {task.priority} priority
          </span>
        </div>
      </div>

      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setStartDate(undefined);
            setEndDate(undefined);
            setError(null);
            setSaving(false);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-[#ddd4c7] bg-white px-4 text-xs font-medium text-[#5e564a] hover:bg-[#f5f2ec]"
          >
            <Plus className="h-3.5 w-3.5" />
            Set dates
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          className="w-[min(92vw,720px)] rounded-[20px] border border-[#e6dfd2] bg-[#fbfaf7] p-4 shadow-[0_24px_50px_-34px_rgba(28,24,17,0.28)]"
        >
          <PopoverHeader className="gap-1">
            <PopoverTitle className="text-sm font-semibold text-[#1f1b17]">
              Schedule task
            </PopoverTitle>
            <PopoverDescription className="text-xs text-[#746d62]">
              Pick the start and due dates to move this task into the timeline.
            </PopoverDescription>
          </PopoverHeader>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f877a]">
                Start date
              </p>
              <div className="overflow-hidden rounded-[18px] border border-[#e6dfd2] bg-white">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date);
                    if (date && endDate && date > endDate) {
                      setEndDate(date);
                    }
                    setError(null);
                  }}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f877a]">
                Due date
              </p>
              <div className="overflow-hidden rounded-[18px] border border-[#e6dfd2] bg-white">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    setEndDate(date);
                    if (date && startDate && date < startDate) {
                      setStartDate(date);
                    }
                    setError(null);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-[#ece4d7] pt-4">
            <div className="flex items-center gap-2 text-xs text-[#746d62]">
              <CalendarRange className="h-3.5 w-3.5 shrink-0" />
              <span>
                {startDate && endDate
                  ? `${format(startDate, "MMM d, yyyy")} to ${format(endDate, "MMM d, yyyy")}`
                  : "Choose a range to place the bar on the timeline."}
              </span>
            </div>
            {error && <p className="text-xs text-[#b42318]">{error}</p>}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-full px-4 text-xs text-[#6b6255] hover:bg-[#f3eee6]"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 rounded-full bg-[#1f1b17] px-4 text-xs text-white hover:bg-[#2c251d]"
                onClick={() => void handleConfirm()}
                disabled={!canSubmit}
              >
                {saving ? "Saving..." : "Add to timeline"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function TimelineUnscheduled({
  tasks,
  onSchedule,
}: {
  tasks: Task[];
  onSchedule: (taskId: string, startDate: string, dueDate: string) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState(tasks.length > 5);

  const summary = useMemo(
    () =>
      `${tasks.length} unscheduled task${tasks.length === 1 ? "" : "s"} waiting for dates`,
    [tasks.length],
  );

  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[20px] border border-[#e7e2d8] bg-[#fbfaf7] shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f877a]">
            Unscheduled
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[#1f1b17]">
            Tasks waiting for dates
          </h2>
          <p className="mt-1 text-sm text-[#746d62]">{summary}</p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-[#e4dccd] bg-white px-3 py-1.5 text-xs font-medium text-[#5e564a]">
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {collapsed ? "Show tasks" : "Hide tasks"}
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-[#ece4d7]">
          {tasks.map((task) => (
            <ScheduleRow key={task.id} task={task} onSchedule={onSchedule} />
          ))}
        </div>
      )}
    </section>
  );
}
