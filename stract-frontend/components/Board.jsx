'use client';

import { useReducer, useEffect, useCallback, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import Column from './Column';
import { fetchTasks, deleteTask, updateTaskPosition } from '@/lib/api';
import { useRealtime } from '@/hooks/useRealtime';

const COLUMNS = ['todo', 'in-progress', 'done'];

// --- Reducer ---
const initialState = {
  tasks: [],
  loading: true,
  error: null,
};

function boardReducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };

    case 'FETCH_SUCCESS':
      return { ...state, loading: false, tasks: action.payload };

    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };

    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };

    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.payload) };

    case 'RENAME_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? { ...t, title: action.payload.title } : t
        ),
      };

    case 'SET_TASKS':
      return { ...state, tasks: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// Toast message factory matching the spec's templates
function showEventToast(event) {
  const title = event.task_title ? `'${event.task_title}'` : 'Task';
  const to = event.to ? event.to.replace('-', ' ') : '';

  switch (event.action) {
    case 'created':
      toast.success(`${title} added to ${to}`);
      break;
    case 'moved':
      toast(`${title} moved to ${to}`);
      break;
    case 'deleted':
      toast.error(`${title} deleted`);
      break;
    case 'updated':
      toast(`${title} renamed`);
      break;
    default:
      break;
  }
}

// --- Board Component ---
export default function Board() {
  const [state, dispatch] = useReducer(boardReducer, initialState);
  // Track in-flight mutations to suppress self-triggered refetches on SSE
  const mutationInFlightRef = useRef(false);

  // Fetch tasks on mount
  const load = useCallback(async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const result = await fetchTasks();
      dispatch({ type: 'FETCH_SUCCESS', payload: result.data || [] });
    } catch (err) {
      dispatch({ type: 'FETCH_ERROR', payload: err.message });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // --- SSE real-time sync ---
  useRealtime((event, isSelf) => {
    // Always show toast (even for self-triggered)
    showEventToast(event);

    // Only refetch if triggered by another tab
    if (!isSelf) {
      load();
    }
  }, mutationInFlightRef);

  // Partition tasks by status
  const getColumnTasks = useCallback(
    (status) =>
      state.tasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.position - b.position),
    [state.tasks]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (taskId) => {
      const previousTasks = [...state.tasks];
      dispatch({ type: 'DELETE_TASK', payload: taskId });
      mutationInFlightRef.current = true;
      try {
        await deleteTask(taskId);
      } catch (err) {
        dispatch({ type: 'SET_TASKS', payload: previousTasks });
        dispatch({ type: 'SET_ERROR', payload: `Failed to delete: ${err.message}` });
      } finally {
        setTimeout(() => { mutationInFlightRef.current = false; }, 500);
      }
    },
    [state.tasks]
  );

  // Handle add
  const handleTaskAdded = useCallback((task) => {
    dispatch({ type: 'ADD_TASK', payload: task });
  }, []);

  // Handle rename
  const handleRename = useCallback((taskId, newTitle) => {
    dispatch({ type: 'RENAME_TASK', payload: { id: taskId, title: newTitle } });
  }, []);

  // Handle error
  const handleError = useCallback((message) => {
    dispatch({ type: 'SET_ERROR', payload: message });
  }, []);

  // Handle drag end — midpoint algorithm
  const handleDragEnd = useCallback(
    async (result) => {
      const { source, destination, draggableId } = result;

      if (!destination) return;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      )
        return;

      const previousTasks = [...state.tasks];
      const task = state.tasks.find((t) => t.id === draggableId);
      if (!task) return;

      const newStatus = destination.droppableId;

      const destColumnTasks = state.tasks
        .filter((t) => t.status === newStatus && t.id !== draggableId)
        .sort((a, b) => a.position - b.position);

      const prevTask = destColumnTasks[destination.index - 1] ?? null;
      const nextTask = destColumnTasks[destination.index] ?? null;

      const prevPos = prevTask ? prevTask.position : 0;
      const nextPos = nextTask ? nextTask.position : null;

      const optimisticPos = nextPos !== null
        ? (prevPos + nextPos) / 2
        : prevPos + 65536;

      const updatedTask = { ...task, status: newStatus, position: optimisticPos };
      const updatedTasks = [
        ...state.tasks.filter((t) => t.id !== draggableId),
        updatedTask,
      ];

      dispatch({ type: 'SET_TASKS', payload: updatedTasks });

      mutationInFlightRef.current = true;
      try {
        await updateTaskPosition(draggableId, newStatus, prevPos, nextPos);
      } catch (err) {
        dispatch({ type: 'SET_TASKS', payload: previousTasks });
        dispatch({ type: 'SET_ERROR', payload: `Failed to move task: ${err.message}` });
      } finally {
        setTimeout(() => { mutationInFlightRef.current = false; }, 500);
      }
    },
    [state.tasks]
  );

  // --- Loading Skeleton ---
  if (state.loading) {
    return (
      <div className="flex gap-5 max-w-6xl mx-auto px-6 pb-8">
        {COLUMNS.map((col) => (
          <div key={col} className="flex flex-col w-[300px] min-w-[300px] rounded-xl bg-[#f4f4f2] border border-[#e4e4e0] p-4 h-60 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Error banner */}
      {state.error && (
        <div className="max-w-6xl mx-auto px-6 mb-4">
          <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
            <span>{state.error}</span>
            <button
              onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
              className="text-red-400 hover:text-red-600 text-xs font-semibold ml-4 underline underline-offset-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-5 max-w-6xl mx-auto px-6 pb-8 overflow-x-auto">
          {COLUMNS.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={getColumnTasks(status)}
              onDelete={handleDelete}
              onRename={handleRename}
              onTaskAdded={handleTaskAdded}
              onError={handleError}
              mutationInFlightRef={mutationInFlightRef}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
