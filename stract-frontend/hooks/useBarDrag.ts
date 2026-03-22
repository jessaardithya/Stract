"use client";

import { useDraggable } from "@dnd-kit/core";

type UseBarDragArgs = {
  id: string;
  taskId: string;
  pixelsPerDay: number;
};

function snapOffset(offset: number, pixelsPerDay: number): number {
  return Math.round(offset / pixelsPerDay) * pixelsPerDay;
}

export function useBarDrag({ id, taskId, pixelsPerDay }: UseBarDragArgs) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { taskId },
  });

  const snappedOffset = transform ? snapOffset(transform.x, pixelsPerDay) : 0;

  return {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
    transformStyle: transform
      ? { transform: `translate3d(${snappedOffset}px, 0, 0)` }
      : undefined,
  };
}
