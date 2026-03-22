"use client";

import { useMemo } from "react";
import type { TimelineTaskSegment, TimelineWeekRow } from "@/hooks/useTimelineLayout";

type DependencyPath = {
  key: string;
  path: string;
  arrowhead: string;
};

function buildArrowhead(x: number, y: number): string {
  return `${x},${y} ${x - 8},${y - 4} ${x - 8},${y + 4}`;
}

export default function TimelineDependencies({
  weeks,
  dayWidth,
  barHeight,
  width,
  height,
}: {
  weeks: TimelineWeekRow[];
  dayWidth: number;
  barHeight: number;
  width: number;
  height: number;
}) {
  const paths = useMemo(() => {
    const weekMap = new Map<string, TimelineWeekRow>();
    const byLabel = new Map<
      string,
      Array<{ taskId: string; task: TimelineTaskSegment["task"]; first: TimelineTaskSegment; last: TimelineTaskSegment }>
    >();

    weeks.forEach((week) => {
      weekMap.set(week.key, week);

      const byTask = new Map<string, TimelineTaskSegment[]>();
      week.segments.forEach((segment) => {
        const label = segment.task.label?.trim();
        if (!label) return;

        const segments = byTask.get(segment.task.id) || [];
        segments.push(segment);
        byTask.set(segment.task.id, segments);
      });

      byTask.forEach((segments) => {
        const label = segments[0]?.task.label?.trim();
        if (!label) return;

        const group = byLabel.get(label) || [];
        const sorted = [...segments].sort((left, right) => left.start.getTime() - right.start.getTime());
        group.push({
          taskId: segments[0].task.id,
          task: segments[0].task,
          first: sorted[0],
          last: sorted[sorted.length - 1],
        });
        byLabel.set(label, group);
      });
    });

    const nextPaths: DependencyPath[] = [];

    byLabel.forEach((group, label) => {
      if (group.length < 2) return;

      const sortedTasks = [...group].sort((left, right) => {
        const startDiff = left.first.start.getTime() - right.first.start.getTime();
        if (startDiff !== 0) return startDiff;
        return left.task.title.localeCompare(right.task.title);
      });

      sortedTasks.slice(0, -1).forEach((source, index) => {
        const target = sortedTasks[index + 1];
        const sourceWeek = weekMap.get(source.last.weekKey);
        const targetWeek = weekMap.get(target.first.weekKey);
        if (!sourceWeek || !targetWeek) return;

        const startX = (source.last.endCol + 1) * dayWidth;
        const startY = sourceWeek.top + source.last.top + barHeight / 2;
        const endX = target.first.startCol * dayWidth;
        const endY = targetWeek.top + target.first.top + barHeight / 2;
        const controlOffset = Math.max(Math.abs(endX - startX) * 0.35, 28);

        nextPaths.push({
          key: `${label}-${source.taskId}-${target.taskId}`,
          path: `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`,
          arrowhead: buildArrowhead(endX, endY),
        });
      });
    });

    return nextPaths;
  }, [barHeight, dayWidth, weeks]);

  if (paths.length === 0) {
    return null;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      {paths.map((item) => (
        <g key={item.key}>
          <path
            d={item.path}
            stroke="rgba(99, 102, 241, 0.5)"
            strokeWidth="2"
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
          <polygon points={item.arrowhead} fill="rgba(99, 102, 241, 0.5)" />
        </g>
      ))}
    </svg>
  );
}
