"use client";

import { useState, useReducer, useEffect, useCallback, useRef } from "react";
import { CalendarDays, Columns3, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import Column from "./Column";
import {
  getTasks,
  deleteTask,
  updateTaskPosition,
  createStatus,
} from "@/lib/api";
import { useRealtime } from "@/hooks/useRealtime";
import { useApp } from "@/context/AppContext";
import { useStatuses } from "@/context/StatusContext";
import type { Task } from "@/types";

type BoardState = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
};

type BoardAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; payload: Task[] }
  | { type: "FETCH_ERROR"; payload: string }
  | { type: "ADD_TASK"; payload: Task }
  | { type: "DELETE_TASK"; payload: string }
  | { type: "UPDATE_TASK"; payload: Partial<Task> & { id: string } }
  | { type: "SET_TASKS"; payload: Task[] }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" };

function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: null };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, tasks: action.payload };
    case "FETCH_ERROR":
      return { ...state, loading: false, error: action.payload };
    case "ADD_TASK":
      return { ...state, tasks: [...state.tasks, action.payload] };
    case "DELETE_TASK":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload),
      };
    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload } : t,
        ),
      };
    case "SET_TASKS":
      return { ...state, tasks: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

function showEventToast(event: { action: string; task_title?: string; to_status?: string }) {
  const title = event.task_title ? `'${event.task_title}'` : "Task";
  const to = event.to_status ? event.to_status : "";
  switch (event.action) {
    case "created":
      toast.success(`${title} added to ${to}`);
      break;
    case "moved":
      toast(`${title} moved to ${to}`);
      break;
    case "deleted":
      toast.error(`${title} deleted`);
      break;
    case "updated":
      toast(`${title} renamed`);
      break;
  }
}

export default function Board() {
  const { activeWorkspace, activeProject } = useApp();
  const [state, dispatch] = useReducer(boardReducer, {
    tasks: [],
    loading: true,
    error: null,
  });
  const mutationInFlightRef = useRef<boolean>(false);

  const load = useCallback(async () => {
    if (!activeWorkspace?.id || !activeProject?.id) return;
    dispatch({ type: "FETCH_START" });
    try {
      const result = await getTasks(activeWorkspace.id, activeProject.id);
      dispatch({ type: "FETCH_SUCCESS", payload: result.data || [] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      dispatch({ type: "FETCH_ERROR", payload: message });
    }
  }, [activeWorkspace?.id, activeProject?.id]);

  // Re-fetch whenever active project changes
  useEffect(() => {
    dispatch({ type: "FETCH_START" });
    load();
  }, [load]);

  const onRealtimeEvent = useCallback((event: { action: string; task_title?: string; to_status?: string }, isSelf: boolean) => {
    showEventToast(event);
    // Always refresh for updates/moves to ensure modal changes are reflected on the board
    if (!isSelf || event.action === "updated" || event.action === "moved") {
      load();
    }
  }, [load]);

  useRealtime(onRealtimeEvent, mutationInFlightRef);

  const getColumnTasks = useCallback(
    (statusId: string) =>
      state.tasks
        .filter((t) => t.status_id === statusId)
        .sort((a, b) => a.position - b.position),
    [state.tasks],
  );

  const handleDelete = useCallback(
    async (taskId: string) => {
      if (!activeWorkspace?.id) return;
      const prev = [...state.tasks];
      dispatch({ type: "DELETE_TASK", payload: taskId });
      mutationInFlightRef.current = true;
      try {
        await deleteTask(activeWorkspace.id, taskId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        dispatch({ type: "SET_TASKS", payload: prev });
        dispatch({
          type: "SET_ERROR",
          payload: `Failed to delete: ${message}`,
        });
      } finally {
        setTimeout(() => {
          mutationInFlightRef.current = false;
        }, 500);
      }
    },
    [state.tasks, activeWorkspace?.id],
  );

  const handleTaskAdded = useCallback(
    (task: Task) => dispatch({ type: "ADD_TASK", payload: task }),
    [],
  );
  const handleRename = useCallback(
    (taskId: string, newTitle: string, newDesc: string | null) =>
      dispatch({
        type: "UPDATE_TASK",
        payload: { id: taskId, title: newTitle, description: newDesc },
      }),
    [],
  );
  const handleError = useCallback(
    (msg: string) => dispatch({ type: "SET_ERROR", payload: msg }),
    [],
  );

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      )
        return;
      if (!activeWorkspace?.id) return;

      const prev = [...state.tasks];
      const task = state.tasks.find((t) => t.id === draggableId);
      if (!task) return;

      const newStatusId = destination.droppableId;
      const destTasks = state.tasks
        .filter((t) => t.status_id === newStatusId && t.id !== draggableId)
        .sort((a, b) => a.position - b.position);
      const prevTask = destTasks[destination.index - 1] ?? null;
      const nextTask = destTasks[destination.index] ?? null;
      const prevPos = prevTask ? prevTask.position : 0;
      const nextPos = nextTask ? nextTask.position : null;
      const optimisticPos =
        nextPos !== null ? (prevPos + nextPos) / 2 : prevPos + 65536;

      dispatch({
        type: "SET_TASKS",
        payload: [
          ...state.tasks.filter((t) => t.id !== draggableId),
          { ...task, status_id: newStatusId, position: optimisticPos },
        ],
      });
      mutationInFlightRef.current = true;
      try {
        await updateTaskPosition(activeWorkspace.id, draggableId, {
          status_id: newStatusId,
          prev_pos: prevPos,
          next_pos: nextPos,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        dispatch({ type: "SET_TASKS", payload: prev });
        dispatch({
          type: "SET_ERROR",
          payload: `Failed to move: ${message}`,
        });
      } finally {
        setTimeout(() => {
          mutationInFlightRef.current = false;
        }, 500);
      }
    },
    [state.tasks, activeWorkspace?.id],
  );

  const { statuses, loading: statusesLoading, refreshStatuses } = useStatuses();
  const scheduledCount = state.tasks.filter((task) => task.start_date || task.due_date).length;

  // Show skeleton while booting or loading without data
  if ((state.loading || statusesLoading) && state.tasks.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7]" />
        <div className="flex gap-4 overflow-hidden">
          {(statuses.length > 0 ? statuses : [1, 2, 3]).map((s, idx) => (
            <div
              key={typeof s === "number" ? idx : s.id}
              className="h-72 w-[320px] min-w-[320px] animate-pulse rounded-[20px] border border-[#e7e2d8] bg-[#fbfaf7]"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeProject && (
        <section className="flex flex-col gap-3 rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] px-5 py-5 shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)] md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f877a]">
              Board
            </p>
            <div className="mt-1.5 flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: activeProject.color }}
              />
              <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-[#1f1b17]">
                {activeProject.name}
              </h1>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#746d62]">
              {activeProject.description?.trim() ||
                "Manage tasks across custom stages, keep work moving, and add structure without losing momentum."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5e564a]">
              <Columns3 className="h-3.5 w-3.5" />
              {statuses.length} column{statuses.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5e564a]">
              <CalendarDays className="h-3.5 w-3.5" />
              {scheduledCount} scheduled
            </span>
            <span className="rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5e564a]">
              {state.tasks.length} total task{state.tasks.length === 1 ? "" : "s"}
            </span>
          </div>
        </section>
      )}

      {state.error && (
        <div>
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <span>{state.error}</span>
            <button
              onClick={() => dispatch({ type: "CLEAR_ERROR" })}
              className="text-red-400 hover:text-red-600 text-xs font-semibold ml-4 underline underline-offset-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <section className="rounded-[20px] border border-[#e7e2d8] bg-[#fbfaf7] p-3 shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max items-start gap-4">
              {statuses.map((status) => (
                <Column
                  key={status.id}
                  statusId={status.id}
                  statusName={status.name}
                  statusColor={status.color}
                  tasks={getColumnTasks(status.id)}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  onTaskAdded={handleTaskAdded}
                  onError={handleError}
                  activeWorkspace={activeWorkspace!}
                  activeProject={activeProject!}
                  onStatusUpdate={refreshStatuses}
                />
              ))}

              <AddColumnButton
                onAdd={async (name) => {
                  if (!activeWorkspace?.id || !activeProject?.id) return;
                  try {
                    await createStatus(activeWorkspace.id, activeProject.id, {
                      name,
                      color: "#9ca3af",
                      position: statuses.length * 65536,
                    });
                    refreshStatuses();
                  } catch (err) {
                    const message = err instanceof Error ? err.message : "Unknown error";
                    handleError(message);
                  }
                }}
              />
            </div>
          </div>
        </section>
      </DragDropContext>
    </div>
  );
}

function AddColumnButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [name, setName] = useState<string>("");

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="flex h-[122px] w-[320px] min-w-[320px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#d8d1c5] bg-white/70 text-[#8a8a85] transition-all duration-150 group hover:border-[#b7aea1] hover:bg-white"
      >
        <Plus
          size={20}
          className="mb-2 group-hover:scale-110 transition-transform"
        />
        <span className="text-sm font-medium">Add column</span>
      </button>
    );
  }

  return (
    <div className="w-[320px] min-w-[320px] animate-in slide-in-from-top-2 fade-in rounded-[20px] border border-[#e7e2d8] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)] duration-200">
      <Input
        autoFocus
        placeholder="Column name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onAdd(name.trim());
            setName("");
            setIsEditing(false);
          }
          if (e.key === "Escape") setIsEditing(false);
        }}
        className="text-sm mb-3 h-9 focus-visible:ring-violet-300"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            if (name.trim()) {
              onAdd(name.trim());
              setName("");
              setIsEditing(false);
            }
          }}
          className="h-8 bg-[#1a1a1a] hover:bg-[#333] text-white"
        >
          Add column
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(false)}
          className="h-8 text-[#8a8a85]"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

