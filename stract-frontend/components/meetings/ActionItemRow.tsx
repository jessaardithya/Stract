'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Loader2, ChevronRight, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateActionItem, deleteActionItem, convertActionItem } from '@/lib/api';
import type { MeetingActionItem, WorkspaceMember } from '@/types';

interface ActionItemRowProps {
  item: MeetingActionItem;
  workspaceId: string;
  projectId: string;
  meetingId: string;
  members: WorkspaceMember[];
  onUpdate: (updated: MeetingActionItem) => void;
  onDelete: (itemId: string) => void;
  onOpenTask: (taskId: string) => void;
}

export function ActionItemRow({
  item,
  workspaceId,
  projectId,
  meetingId,
  members,
  onUpdate,
  onDelete,
  onOpenTask,
}: ActionItemRowProps) {
  const [isEditing, setIsEditing] = useState(item.title === '');
  const [title, setTitle] = useState(item.title);
  const [isConverting, setIsConverting] = useState(false);
  const [isTogglingDone, setIsTogglingDone] = useState(false);
  const [convertError, setConvertError] = useState('');
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const saveTitle = async () => {
    if (title.trim() === item.title) {
      setIsEditing(false);
      return;
    }
    try {
      const res = await updateActionItem(workspaceId, projectId, meetingId, item.id, { title: title.trim() });
      onUpdate(res.data);
    } catch {
      setTitle(item.title);
    }
    setIsEditing(false);
  };

  const handleAssignee = async (member: WorkspaceMember | null) => {
    setAssigneeOpen(false);
    const assigneeId = member?.id ?? '';
    try {
      const res = await updateActionItem(workspaceId, projectId, meetingId, item.id, { assignee_id: assigneeId || null });
      onUpdate(res.data);
    } catch { /* ignore */ }
  };

  const handleDueDate = async (date: Date | undefined) => {
    setDateOpen(false);
    const due = date ? format(date, 'yyyy-MM-dd') : null;
    try {
      const res = await updateActionItem(workspaceId, projectId, meetingId, item.id, { due_date: due });
      onUpdate(res.data);
    } catch { /* ignore */ }
  };

  const handleToggleDone = async () => {
    if (isTogglingDone) {
      return;
    }

    setIsTogglingDone(true);
    try {
      const res = await updateActionItem(workspaceId, projectId, meetingId, item.id, {
        is_done: !item.is_done,
      });
      onUpdate(res.data);
    } catch {
      /* ignore */
    } finally {
      setIsTogglingDone(false);
    }
  };

  const handleConvert = async () => {
    setIsConverting(true);
    setConvertError('');
    try {
      const res = await convertActionItem(workspaceId, projectId, meetingId, item.id);
      onUpdate({ ...item, converted_task_id: res.data.task_id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to convert';
      setConvertError(message);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteActionItem(workspaceId, projectId, meetingId, item.id);
      onDelete(item.id);
    } catch { /* ignore */ }
  };

  const assignee = members.find((m) => m.id === item.assignee_id);
  const dueDateDisplay = item.due_date
    ? (() => {
        const [y, mo, d] = item.due_date.split('-').map(Number);
        return format(new Date(y, mo - 1, d), 'MMM d');
      })()
    : null;

  return (
    <div
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#f9f7f4]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={handleToggleDone}
        disabled={isTogglingDone}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          item.is_done
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-[#c9c4bc] bg-white hover:border-emerald-400'
        }`}
        title={item.is_done ? 'Mark incomplete' : 'Mark complete'}
      >
        {isTogglingDone ? (
          <Loader2 size={9} className="animate-spin" />
        ) : item.is_done ? (
          <Check size={9} />
        ) : null}
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitle(item.title); setIsEditing(false); } }}
            className="w-full rounded border-0 bg-transparent p-0 text-[12.5px] text-gray-800 outline-none placeholder:text-[#8a8a85] focus:outline-none"
            placeholder="Action item…"
          />
        ) : (
          <span
            onClick={() => setIsEditing(true)}
            className={`block cursor-text truncate text-[12.5px] ${
              item.is_done ? 'text-[#8a8a85] line-through' : 'text-gray-800'
            }`}
          >
            {item.title || <span className="text-[#aaa] italic">Click to add title...</span>}
          </span>
        )}
      </div>

      {/* Assignee picker */}
      <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
        <PopoverTrigger asChild>
          <button className="shrink-0">
            <Avatar className="h-5 w-5">
              <AvatarImage src={item.assignee_avatar ?? undefined} />
              <AvatarFallback className="text-[8px] font-bold uppercase bg-[#f0ede8] text-[#8a8a85]">
                {item.assignee_name ? item.assignee_name[0] : '?'}
              </AvatarFallback>
            </Avatar>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-1.5" sideOffset={4}>
          <button
            onClick={() => handleAssignee(null)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[12px] text-[#8a8a85] hover:bg-[#f5f2ee]"
          >
            Unassign
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => handleAssignee(m)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f5f2ee]"
            >
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarImage src={m.avatar_url ?? undefined} />
                <AvatarFallback className="text-[8px] font-bold uppercase bg-violet-100 text-violet-700">{m.name?.[0] ?? m.email[0]}</AvatarFallback>
              </Avatar>
              <span className="truncate text-gray-700">{m.name || m.email}</span>
              {m.id === item.assignee_id && <Check size={11} className="ml-auto shrink-0 text-violet-500" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Due date */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <button className={`shrink-0 text-[11px] ${dueDateDisplay ? 'text-[#8a8a85]' : 'text-[#c9c4bc]'} hover:text-gray-700`}>
            {dueDateDisplay ?? 'No date'}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0" sideOffset={4}>
          <Calendar
            mode="single"
            selected={item.due_date ? (() => { const [y, m, d] = item.due_date.split('-').map(Number); return new Date(y, m - 1, d); })() : undefined}
            onSelect={handleDueDate}
            initialFocus
          />
          {item.due_date && (
            <div className="border-t px-3 pb-2">
              <button onClick={() => handleDueDate(undefined)} className="text-[11px] text-red-400 hover:text-red-500">
                Clear date
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Convert / View Task */}
      {item.converted_task_id ? (
        <button
          onClick={() => onOpenTask(item.converted_task_id!)}
          className="flex shrink-0 items-center gap-1 rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-600 hover:bg-violet-100"
        >
          View Task <ExternalLink size={9} />
        </button>
      ) : (
        <button
          onClick={handleConvert}
          disabled={isConverting}
          className="flex shrink-0 items-center gap-1 rounded border border-[#e4e4e0] bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-[#f5f2ee]"
          title={convertError || 'Convert to task'}
        >
          {isConverting ? <Loader2 size={9} className="animate-spin" /> : <ChevronRight size={9} />}
          {isConverting ? '' : 'Convert'}
        </button>
      )}

      {/* Delete */}
      {isHovered && (
        <button
          onClick={handleDelete}
          className="shrink-0 text-[#c9c4bc] transition-colors hover:text-red-400"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
