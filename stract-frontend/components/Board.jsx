"use client";

import { useState, useReducer, useEffect, useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DragDropContext } from "@hello-pangea/dnd";
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

function boardReducer(state, action) {
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

function showEventToast(event) {
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
  const mutationInFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!activeWorkspace?.id || !activeProject?.id) return;
    dispatch({ type: "FETCH_START" });
    try {
      const result = await getTasks(activeWorkspace.id, activeProject.id);
      dispatch({ type: "FETCH_SUCCESS", payload: result.data || [] });
    } catch (err) {
      dispatch({ type: "FETCH_ERROR", payload: err.message });
    }
  }, [activeWorkspace?.id, activeProject?.id]);

  // Re-fetch whenever active project changes
  useEffect(() => {
    dispatch({ type: "FETCH_START" });
    load();
  }, [load]);

  useRealtime((event, isSelf) => {
    showEventToast(event);
    // Always refresh for updates/moves to ensure modal changes are reflected on the board
    if (!isSelf || event.action === "updated" || event.action === "moved") {
      load();
    }
  }, mutationInFlightRef);

  const getColumnTasks = useCallback(
    (statusId) =>
      state.tasks
        .filter((t) => t.status_id === statusId)
        .sort((a, b) => a.position - b.position),
    [state.tasks],
  );

  const handleDelete = useCallback(
    async (taskId) => {
      if (!activeWorkspace?.id) return;
      const prev = [...state.tasks];
      dispatch({ type: "DELETE_TASK", payload: taskId });
      mutationInFlightRef.current = true;
      try {
        await deleteTask(activeWorkspace.id, taskId);
      } catch (err) {
        dispatch({ type: "SET_TASKS", payload: prev });
        dispatch({
          type: "SET_ERROR",
          payload: `Failed to delete: ${err.message}`,
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
    (task) => dispatch({ type: "ADD_TASK", payload: task }),
    [],
  );
  const handleRename = useCallback(
    (taskId, newTitle, newDesc) =>
      dispatch({
        type: "UPDATE_TASK",
        payload: { id: taskId, title: newTitle, description: newDesc },
      }),
    [],
  );
  const handleError = useCallback(
    (msg) => dispatch({ type: "SET_ERROR", payload: msg }),
    [],
  );

  const handleDragEnd = useCallback(
    async (result) => {
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
        await updateTaskPosition(
          activeWorkspace.id,
          draggableId,
          newStatusId,
          prevPos,
          nextPos,
        );
      } catch (err) {
        dispatch({ type: "SET_TASKS", payload: prev });
        dispatch({
          type: "SET_ERROR",
          payload: `Failed to move: ${err.message}`,
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

  // Show skeleton while booting or loading without data
  if ((state.loading || statusesLoading) && state.tasks.length === 0) {
    return (
      <div className="flex gap-5 max-w-6xl mx-auto px-6 pb-8">
        {(statuses.length > 0 ? statuses : [1, 2, 3]).map((s, idx) => (
          <div
            key={s.id || idx}
            className="flex flex-col w-[300px] min-w-[300px] rounded-xl bg-[#f4f4f2] border border-[#e4e4e0] p-4 h-60 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Active project header */}
      {activeProject && (
        <div className="max-w-6xl mx-auto px-6 pt-1 pb-2 flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: activeProject.color }}
          />
          <span className="text-sm font-medium text-[#4a4a45]">
            {activeProject.name}
          </span>
        </div>
      )}

      {state.error && (
        <div className="max-w-6xl mx-auto px-6 mb-4">
          <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
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
        <div className="flex gap-5 max-w-6xl mx-auto px-6 pb-8 overflow-x-auto items-start">
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
              mutationInFlightRef={mutationInFlightRef}
              activeWorkspace={activeWorkspace}
              activeProject={activeProject}
              onStatusUpdate={refreshStatuses}
            />
          ))}

          {/* Add Column Button */}
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
                handleError(err.message);
              }
            }}
          />
        </div>
      </DragDropContext>
    </div>
  );
}

function AddColumnButton({ onAdd }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="flex flex-col items-center justify-center w-[300px] min-w-[300px] h-[120px] rounded-xl border-2 border-dashed border-[#e4e4e0] hover:border-[#9ca3af] hover:bg-[#f4f4f2]/50 text-[#8a8a85] hover:text-gray-600 transition-all duration-150 group"
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
    <div className="w-[300px] min-w-[300px] bg-white border border-[#e4e4e0] rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
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
