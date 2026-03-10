'use client';

import { useReducer, useEffect, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import Column from './Column';
import { fetchTasks, deleteTask, updateTaskPosition } from '@/lib/api';

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

// --- Board Component ---
export default function Board() {
  const [state, dispatch] = useReducer(boardReducer, initialState);

  // Fetch tasks on mount
  useEffect(() => {
    async function load() {
      dispatch({ type: 'FETCH_START' });
      try {
        const result = await fetchTasks();
        dispatch({ type: 'FETCH_SUCCESS', payload: result.data || [] });
      } catch (err) {
        dispatch({ type: 'FETCH_ERROR', payload: err.message });
      }
    }
    load();
  }, []);

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
      // Optimistic delete
      const previousTasks = [...state.tasks];
      dispatch({ type: 'DELETE_TASK', payload: taskId });

      try {
        await deleteTask(taskId);
      } catch (err) {
        // Rollback
        dispatch({ type: 'SET_TASKS', payload: previousTasks });
        dispatch({ type: 'SET_ERROR', payload: `Failed to delete: ${err.message}` });
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

      // Dropped outside any droppable
      if (!destination) return;

      // Dropped back to same position
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      )
        return;

      const previousTasks = [...state.tasks];
      const task = state.tasks.find((t) => t.id === draggableId);
      if (!task) return;

      const newStatus = destination.droppableId;

      // Get the destination column tasks (excluding the dragged task), sorted by position
      const destColumnTasks = state.tasks
        .filter((t) => t.status === newStatus && t.id !== draggableId)
        .sort((a, b) => a.position - b.position);

      // Find the neighbors at the drop index
      const prevTask = destColumnTasks[destination.index - 1] ?? null;
      const nextTask = destColumnTasks[destination.index] ?? null;

      const prevPos = prevTask ? prevTask.position : 0;
      const nextPos = nextTask ? nextTask.position : null;

      // Compute optimistic midpoint position for immediate UI update
      const optimisticPos = nextPos !== null
        ? (prevPos + nextPos) / 2
        : prevPos + 65536;

      const updatedTask = { ...task, status: newStatus, position: optimisticPos };

      // Build merged tasks array with optimistic update
      const updatedTasks = [
        ...state.tasks.filter((t) => t.id !== draggableId),
        updatedTask,
      ];

      dispatch({ type: 'SET_TASKS', payload: updatedTasks });

      try {
        await updateTaskPosition(draggableId, newStatus, prevPos, nextPos);
      } catch (err) {
        // Rollback on failure
        dispatch({ type: 'SET_TASKS', payload: previousTasks });
        dispatch({ type: 'SET_ERROR', payload: `Failed to move task: ${err.message}` });
      }
    },
    [state.tasks]
  );


  // --- Loading Skeleton ---
  if (state.loading) {
    return (
      <div className="flex gap-5 max-w-6xl mx-auto px-6 pb-8">
        {COLUMNS.map((col) => (
          <div key={col} className="w-[300px] min-w-[300px] rounded-xl bg-[#f4f4f2] border border-[#e4e4e0] p-4 space-y-3">
            <div className="h-6 bg-[#e4e4e0] rounded-md animate-pulse w-1/2" />
            <div className="h-px bg-[#e4e4e0]" />
            <div className="h-[72px] bg-white rounded-lg border border-[#e4e4e0] animate-pulse" />
            <div className="h-[72px] bg-white/80 rounded-lg border border-[#e4e4e0] animate-pulse" />
            <div className="h-[72px] bg-white/60 rounded-lg border border-[#e4e4e0] animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Error Banner */}
      {state.error && (
        <div className="max-w-6xl mx-auto px-6 mb-4">
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
            <p className="text-sm text-red-600 font-medium">{state.error}</p>
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
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
