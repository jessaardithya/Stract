"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { format, isSameMonth, isToday } from "date-fns";
import type { TimelineLayout, TimelineMonthSection } from "@/hooks/useTimelineLayout";
import TimelineDependencies from "./TimelineDependencies";
import TimelineHeader from "./TimelineHeader";
import TimelineBar from "./TimelineBar";

function CalendarDayCell({
  date,
  monthDate,
  todayRef,
}: {
  date: Date;
  monthDate: Date;
  todayRef: RefObject<HTMLSpanElement | null>;
}) {
  const currentMonth = isSameMonth(date, monthDate);
  const today = isToday(date);

  return (
    <div
      className={`min-h-full border-r border-[#e4e4e0] p-2 last:border-r-0 ${
        currentMonth ? "bg-white" : "bg-[#fafaf9]"
      }`}
    >
      <div className="mb-1 flex justify-end">
        <span
          ref={today ? todayRef : undefined}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
            today
              ? "bg-violet-600 font-bold text-white"
              : currentMonth
                ? "text-gray-700 hover:bg-[#f4f4f2]"
                : "text-gray-300"
          }`}
        >
          {format(date, "d")}
        </span>
      </div>
    </div>
  );
}

function MonthSection({
  section,
  pixelsPerDay,
  layout,
  projectCreatedAt,
  showDependencies,
  hoveredTaskId,
  onHoverChange,
  onBarResizeEnd,
  todayRef,
  showMonthTitle,
}: {
  section: TimelineMonthSection;
  pixelsPerDay: number;
  layout: TimelineLayout;
  projectCreatedAt?: string;
  showDependencies: boolean;
  hoveredTaskId: string | null;
  onHoverChange: (taskId: string | null) => void;
  onBarResizeEnd: (taskId: string, edge: "left" | "right", dayDelta: number) => void;
  todayRef: RefObject<HTMLSpanElement | null>;
  showMonthTitle: boolean;
}) {
  const totalHeight = section.weeks.reduce((sum, week) => sum + week.height, 0);

  return (
    <section className="border-b border-[#e4e4e0] last:border-b-0">
      {showMonthTitle && (
        <div className="border-b border-[#e4e4e0] px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
        </div>
      )}

      <TimelineHeader />

      <div className="relative">
        {showDependencies && (
          <TimelineDependencies
            weeks={section.weeks}
            dayWidth={pixelsPerDay}
            barHeight={layout.barHeight}
            width={pixelsPerDay * 7}
            height={totalHeight}
          />
        )}

        {section.weeks.map((week) => (
          <div
            key={week.key}
            className="relative grid grid-cols-7 border-b border-[#e4e4e0] last:border-b-0"
            style={{ minHeight: week.height }}
          >
            {week.days.map((day) => (
              <CalendarDayCell
                key={day.toISOString()}
                date={day}
                monthDate={section.monthDate}
                todayRef={todayRef}
              />
            ))}

            {week.segments.map((segment) => (
              <TimelineBar
                key={segment.key}
                segment={segment}
                pixelsPerDay={pixelsPerDay}
                barHeight={layout.barHeight}
                projectCreatedAt={projectCreatedAt}
                onResizeEnd={onBarResizeEnd}
                isHovered={hoveredTaskId === segment.task.id}
                onHoverChange={onHoverChange}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TimelineGrid({
  layout,
  onBarDragEnd,
  onBarResizeEnd,
  projectCreatedAt,
  showDependencies,
  hoveredTaskId,
  onHoverChange,
  todayLineRef,
}: {
  layout: TimelineLayout;
  onBarDragEnd: (taskId: string, dayDelta: number) => void;
  onBarResizeEnd: (taskId: string, edge: "left" | "right", dayDelta: number) => void;
  projectCreatedAt?: string;
  showDependencies: boolean;
  hoveredTaskId: string | null;
  onHoverChange: (taskId: string | null) => void;
  todayLineRef: RefObject<HTMLSpanElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(980);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateWidth = () => setContainerWidth(node.getBoundingClientRect().width);
    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const pixelsPerDay = Math.max(containerWidth / 7, 40);

  const handleDragEnd = (event: DragEndEvent) => {
    const taskId = event.active.data.current?.taskId as string | undefined;
    if (!taskId) return;

    const dayDelta = Math.round(event.delta.x / pixelsPerDay);
    if (dayDelta === 0) return;

    onBarDragEnd(taskId, dayDelta);
  };

  return (
    <DndContext modifiers={[restrictToHorizontalAxis]} onDragEnd={handleDragEnd}>
      <div ref={containerRef} className="bg-[#fafaf8]">
        {layout.months.map((section) => (
          <MonthSection
            key={section.key}
            section={section}
            pixelsPerDay={pixelsPerDay}
            layout={layout}
            projectCreatedAt={projectCreatedAt}
            showDependencies={showDependencies}
            hoveredTaskId={hoveredTaskId}
            onHoverChange={onHoverChange}
            onBarResizeEnd={onBarResizeEnd}
            todayRef={todayLineRef}
            showMonthTitle={layout.zoom === "quarter"}
          />
        ))}
      </div>
    </DndContext>
  );
}
