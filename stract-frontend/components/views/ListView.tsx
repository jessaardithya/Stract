'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { getTasks, deleteTask } from '@/lib/api';
import { useStatuses } from '@/context/StatusContext';
import { useRealtime } from '@/hooks/useRealtime';
import { formatDate, dueDateStatus } from '@/utils/date';
import {
  Trash2, AlertTriangle, Calendar as CalendarIcon,
  ArrowUpDown, ChevronRight, ChevronDown
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Task } from '@/types';

const PRIORITY_CFG: Record<string, { label: string; dot: string }> = {
  low: { label: 'Low', dot: 'bg-green-500' },
  medium: { label: 'Medium', dot: 'bg-amber-400' },
  high: { label: 'High', dot: 'bg-red-500' },
};

export default function ListView() {
  const { activeWorkspace, activeProject, openTask } = useApp();
  const { statuses } = useStatuses();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortCol, setSortCol] = useState<string>('position');
  const [sortDesc, setSortDesc] = useState<boolean>(false);
  const [isGrouped, setIsGrouped] = useState<boolean>(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const mutationInFlightRef = useRef<boolean>(false);

  const load = useCallback(async () => {
    if (!activeWorkspace?.id || !activeProject?.id) return;
    setLoading(true);
    try {
      const res = await getTasks(activeWorkspace.id, activeProject.id);
      setTasks(res.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load tasks', message);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, activeProject?.id]);

  useEffect(() => { void load(); }, [load]);

  const onRealtimeEvent = useCallback((_event: { action: string; task_title?: string; to_status?: string }, isSelf: boolean) => {
    if (!isSelf) void load();
  }, [load]);

  useRealtime(onRealtimeEvent, mutationInFlightRef);

  const handleDelete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (!activeWorkspace?.id) return;

    const prev = [...tasks];
    setTasks(tasks.filter((task) => task.id !== taskId));
    mutationInFlightRef.current = true;
    try {
      await deleteTask(activeWorkspace.id, taskId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to delete', message);
      setTasks(prev);
    } finally {
      setTimeout(() => { mutationInFlightRef.current = false; }, 500);
    }
  };

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDesc) {
        setSortCol('position');
        setSortDesc(false);
      } else {
        setSortDesc(true);
      }
    } else {
      setSortCol(col);
      setSortDesc(false);
    }
  };

  const toggleGroup = (statusId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [statusId]: !prev[statusId] }));
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortCol === 'status') {
        const aName = a.status?.name || '';
        const bName = b.status?.name || '';
        cmp = aName.localeCompare(bName);
      } else if (sortCol === 'priority') {
        const pMap: Record<string, number> = { low: 1, medium: 2, high: 3 };
        cmp = (pMap[a.priority as string] || 0) - (pMap[b.priority as string] || 0);
      } else if (sortCol === 'due_date') {
        if (!a.due_date && !b.due_date) cmp = 0;
        else if (!a.due_date) cmp = 1;
        else if (!b.due_date) cmp = -1;
        else cmp = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else {
        cmp = a.position - b.position;
      }
      return sortDesc ? -cmp : cmp;
    });
  }, [sortCol, sortDesc, tasks]);

  const groupedTasks = useMemo(() => {
    if (!isGrouped) return { all: sortedTasks };

    const groups: Record<string, Task[]> = {};
    statuses.forEach((status) => { groups[status.id] = []; });

    sortedTasks.forEach((task) => {
      const statusId = task.status_id || task.status?.id;
      if (groups[statusId]) groups[statusId].push(task);
      else if (statuses[0]?.id) groups[statuses[0].id].push(task);
    });

    return groups;
  }, [isGrouped, sortedTasks, statuses]);

  const scheduledCount = tasks.filter((task) => task.start_date || task.due_date).length;

  const renderSortIcon = (col: string) => {
    if (sortCol !== col) {
      return <ArrowUpDown size={12} className="ml-1 opacity-0 transition-opacity group-hover:opacity-50" />;
    }
    return <ArrowUpDown size={12} className={`ml-1 opacity-100 transition-transform ${sortDesc ? 'rotate-180' : ''}`} />;
  };

  const renderRow = (task: Task) => (
    <div
      key={task.id}
      onClick={() => openTask(task.id)}
      className="group flex h-12 cursor-pointer items-center border-b border-[#f1eadf] text-sm transition-colors hover:bg-[#f8f4ec]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <span className="truncate font-medium text-[#1f1b17]">{task.title}</span>
      </div>

      <div className="w-[120px] px-2">
        <Badge
          variant="secondary"
          className="border-[#e8e2d8] bg-[#f7f2ea] font-medium text-[#5f574b]"
          style={task.status?.color ? {
            backgroundColor: `${task.status.color}15`,
            color: task.status.color,
            borderColor: `${task.status.color}30`,
          } : {}}
        >
          {task.status?.name || 'Unknown'}
        </Badge>
      </div>

      <div className="flex w-[100px] items-center gap-1.5 px-2">
        <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_CFG[task.priority]?.dot || 'bg-gray-400'}`} />
        <span className="text-xs capitalize text-[#746d62]">{task.priority}</span>
      </div>

      <div className="w-[120px] px-2">
        {task.assignee_id ? (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Avatar className="h-5 w-5 shrink-0 border border-[#e4e4e0]">
              <AvatarImage src={task.assignee?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-violet-100 text-[10px] font-semibold text-violet-600">
                {task.assignee?.name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-[#746d62]">
              {task.assignee?.name?.split(' ')[0] || 'Assigned'}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>

      <div className="w-[100px] px-2">
        {task.label ? (
          <span className="inline-block max-w-[85px] truncate rounded border border-[#e8e2d8] bg-[#f7f2ea] px-1.5 py-0.5 text-xs text-[#6f6659]">
            {task.label}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>

      <div className="w-[110px] px-2">
        {task.due_date ? (
          <div className={`flex items-center gap-1 text-xs ${
            dueDateStatus(task.due_date) === 'overdue'
              ? 'font-medium text-red-600'
              : dueDateStatus(task.due_date) === 'today'
                ? 'font-medium text-amber-600'
                : 'text-[#746d62]'
          }`}>
            {dueDateStatus(task.due_date) === 'overdue' ? <AlertTriangle size={11} /> : <CalendarIcon size={11} />}
            {formatDate(task.due_date)}
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </div>

      <div className="flex w-[40px] items-center justify-center px-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => void handleDelete(e, task.id)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );

  if (loading && tasks.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7]" />
        <div className="h-80 animate-pulse rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] px-5 py-5 shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f877a]">
            List
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            {activeProject && (
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: activeProject.color }} />
            )}
            <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-[#1f1b17]">
              {activeProject?.name || 'Project list'}
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#746d62]">
            {activeProject?.description?.trim() ||
              'Scan tasks faster, sort the backlog, and review work across the whole project in one place.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5e564a]">
            {tasks.length} task{tasks.length === 1 ? '' : 's'}
          </span>
          <span className="rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-xs font-medium text-[#5e564a]">
            {scheduledCount} scheduled
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsGrouped(!isGrouped)}
            className={`h-8 rounded-full border-[#e6dfd2] bg-white px-3 text-xs text-[#5e564a] hover:bg-[#f7f2ea] ${isGrouped ? 'border-[#cfc5b6] bg-[#f7f2ea]' : ''}`}
          >
            {isGrouped ? 'Grouped by status' : 'Group by status'}
          </Button>
        </div>
      </section>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[18px] border border-dashed border-[#d9d2c6] bg-[#fbfaf7] px-4 py-20 text-center shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
          <h3 className="text-base font-semibold text-[#1f1b17]">No tasks yet</h3>
          <p className="mb-4 mt-1 max-w-sm text-sm text-[#746d62]">
            Add your first task to get started tracking your work in this project.
          </p>
          <Button onClick={() => { window.location.href = '/'; }}>Go to Board to Add</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
          <div className="flex h-11 select-none items-center border-b border-[#e7e2d8] bg-[#f6f1e8] text-xs font-semibold uppercase tracking-wider text-[#8f877a]">
            <div className="group flex flex-1 cursor-pointer items-center px-4 hover:text-[#1f1b17]" onClick={() => toggleSort('title')}>
              Title {renderSortIcon('title')}
            </div>
            <div className="group flex w-[120px] cursor-pointer items-center px-2 hover:text-[#1f1b17]" onClick={() => toggleSort('status')}>
              Status {renderSortIcon('status')}
            </div>
            <div className="group flex w-[100px] cursor-pointer items-center px-2 hover:text-[#1f1b17]" onClick={() => toggleSort('priority')}>
              Priority {renderSortIcon('priority')}
            </div>
            <div className="w-[120px] px-2">Assignee</div>
            <div className="w-[100px] px-2">Label</div>
            <div className="group flex w-[110px] cursor-pointer items-center px-2 hover:text-[#1f1b17]" onClick={() => toggleSort('due_date')}>
              Due Date {renderSortIcon('due_date')}
            </div>
            <div className="w-[40px] px-2" />
          </div>

          <div className="flex flex-col bg-white">
            {isGrouped ? (
              statuses.map((status) => {
                const groupTasks = (groupedTasks as Record<string, Task[]>)[status.id] || [];
                if (!groupTasks.length) return null;
                const isCollapsed = collapsedGroups[status.id];
                return (
                  <div key={status.id}>
                    <div
                      className="flex cursor-pointer items-center gap-2 border-b border-[#efe8dc] bg-[#f8f4ec] px-4 py-2 hover:bg-[#f4efe6]"
                      onClick={() => toggleGroup(status.id)}
                    >
                      {isCollapsed ? <ChevronRight size={14} className="text-[#8f877a]" /> : <ChevronDown size={14} className="text-[#8f877a]" />}
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#5f574b]">{status.name}</span>
                      <span className="text-xs text-[#9d9589]">{groupTasks.length}</span>
                    </div>
                    {!isCollapsed && groupTasks.map((task) => renderRow(task))}
                  </div>
                );
              })
            ) : (
              (groupedTasks as { all: Task[] }).all.map((task) => renderRow(task))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
