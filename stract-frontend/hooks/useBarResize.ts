"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type ResizeEdge = "left" | "right";

type UseBarResizeArgs = {
  edge: ResizeEdge;
  pixelsPerDay: number;
  minDayDelta: number;
  maxDayDelta: number;
  onCommit: (dayDelta: number) => void;
};

export function useBarResize({
  edge,
  pixelsPerDay,
  minDayDelta,
  maxDayDelta,
  onCommit,
}: UseBarResizeArgs) {
  const [offsetDays, setOffsetDays] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const startClientXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (startClientXRef.current == null) return;
      const rawDays = Math.round((event.clientX - startClientXRef.current) / pixelsPerDay);
      const clampedDays = Math.min(maxDayDelta, Math.max(minDayDelta, rawDays));
      setOffsetDays(clampedDays);
    };

    const handleMouseUp = () => {
      const finalDays = offsetDays;
      setIsResizing(false);
      startClientXRef.current = null;
      setOffsetDays(0);
      if (finalDays !== 0) {
        onCommit(finalDays);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, maxDayDelta, minDayDelta, offsetDays, onCommit, pixelsPerDay]);

  const onMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    startClientXRef.current = event.clientX;
    setOffsetDays(0);
    setIsResizing(true);
  };

  const offsetPx = useMemo(() => offsetDays * pixelsPerDay, [offsetDays, pixelsPerDay]);

  return {
    edge,
    isResizing,
    offsetDays,
    offsetPx,
    handleProps: {
      onMouseDown,
    },
  };
}
