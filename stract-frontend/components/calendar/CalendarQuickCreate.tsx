"use client";

import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Loader2, X } from "lucide-react";
import { useStatuses } from "@/context/StatusContext";
import { createTask } from "@/lib/api";
import type { Task } from "@/types";

interface CalendarQuickCreateProps {
  date: Date;
  workspaceId: string;
  projectId: string;
  onCreated: () => void;
  onClose: () => void;
}

export default function CalendarQuickCreate({
  date,
  workspaceId,
  projectId,
  onCreated,
  onClose,
}: CalendarQuickCreateProps) {
  const { statuses } = useStatuses();
  const [title, setTitle] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || loading || !statuses.length) return;
    setLoading(true);
    try {
      // Cast to include due_date which the backend accepts but API type omits
      await createTask(workspaceId, {
        title: title.trim(),
        project_id: projectId,
        status_id: statuses[0].id,
        priority: "medium",
        position: Date.now(),
        description: null,
        due_date: format(date, "yyyy-MM-dd"),
      } as Pick<Task, "title" | "project_id" | "status_id" | "priority" | "position" | "description"> & { due_date?: string });
      onCreated();
    } catch (err) {
      console.error("[CalendarQuickCreate] error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="absolute top-1 left-1 z-30 w-[220px] bg-white rounded-xl
                 border border-[#e4e4e0] shadow-lg p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        {format(date, "MMM d, yyyy")}
      </p>
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleCreate();
          if (e.key === "Escape") onClose();
        }}
        placeholder="Task name..."
        className="w-full text-[13px] border border-[#e4e4e0] rounded-lg
                   px-3 py-1.5 outline-none mb-2 placeholder:text-gray-300
                   focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
      />
      <div className="flex gap-1.5">
        <button
          onClick={() => void handleCreate()}
          disabled={!title.trim() || loading}
          className="flex-1 h-7 bg-violet-600 hover:bg-violet-700 text-white
                     text-[11px] font-semibold rounded-md transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : "Add"}
        </button>
        <button
          onClick={onClose}
          className="h-7 px-2 text-gray-400 hover:text-gray-600
                     hover:bg-[#f4f4f2] rounded-md transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
