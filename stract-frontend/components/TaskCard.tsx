'use client';

import { useState, useRef, useEffect } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import type { Task } from '@/types';
import { Trash2, Calendar, Pencil, Flame, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { differenceInDays, formatDistanceToNow } from 'date-fns';
import { updateTask } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import { formatDate, dueDateStatus } from '@/utils/date';

const PRIORITY_CONFIG = {
  high:   { dot: 'bg-red-500',   label: 'High'   },
  medium: { dot: 'bg-amber-500', label: 'Medium' },
  low:    { dot: 'bg-gray-400',  label: 'Low'    },
};

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string, description: string | null) => void;
  index: number;
}

export default function TaskCard({ task, index, onDelete, onRename }: TaskCardProps) {
  const { activeWorkspace, openTask } = useApp();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>(task.title);
  const [editDescription, setEditDescription] = useState<string>(task.description || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
    }
  }, [task.title, task.description, isEditing]);

  useEffect(() => { if (isEditing) inputRef.current?.select(); }, [isEditing]);

  const handleSave = async () => {
    const trimmed = editTitle.trim();
    const trimmedDesc = editDescription.trim();
    if (!trimmed || (trimmed === task.title && trimmedDesc === (task.description || ''))) {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setIsEditing(false);
      return;
    }
    if (!activeWorkspace?.id) return;
    setIsSaving(true);
    try {
      const result = await updateTask(activeWorkspace.id, task.id, { title: trimmed, description: trimmedDesc });
      onRename(task.id, result.data.title, result.data.description);
      setIsEditing(false);
    } catch {
      setEditTitle(task.title);
      setEditDescription(task.description || '');
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setEditTitle(task.title); setIsEditing(false); }
  };

  // Priority dot
  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

  // Age indicator
  const ageLabel = (() => {
    if (!task.last_moved_at) return null;
    const days = differenceInDays(new Date(), new Date(task.last_moved_at));
    if (days < 1) return null;
    const label = formatDistanceToNow(new Date(task.last_moved_at), { addSuffix: true });
    if (days > 7)  return { label, color: 'text-red-400', Icon: Flame };
    if (days > 3)  return { label, color: 'text-amber-500', Icon: null };
    return           { label, color: 'text-[#8a8a85]', Icon: null };
  })();

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="mb-2">
          <Card 
            onClick={() => { if (!isEditing) openTask(task.id); }}
            className={`
              group rounded-[16px] border border-[#e7e2d8] bg-[#fcfbf8] p-0
              cursor-pointer active:cursor-grabbing transition-all duration-150
              ${snapshot.isDragging
                ? 'scale-[1.02] rotate-1 border-[#c9c1b4] shadow-xl opacity-90'
                : 'hover:border-[#c9c1b4] hover:bg-white hover:shadow-[0_14px_30px_-24px_rgba(28,24,17,0.32)]'}
            `}>
            <CardContent className="p-3.5">
              {/* Title row with priority dot */}
              <div className="flex items-start justify-between gap-2">
                {isEditing ? (
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5 -ml-0.5">
                    <Input
                      ref={inputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isSaving}
                      className="h-7 border-[#e6dfd2] px-1.5 py-0 text-sm font-medium focus-visible:ring-violet-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleSave}
                      disabled={isSaving}
                      placeholder="Add description..."
                      rows={2}
                      className="w-full resize-none rounded-md border border-[#e6dfd2] bg-white px-1.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-50"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 w-full">
                      <Tooltip>
                        <TooltipTrigger className="flex shrink-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityCfg.dot}`} />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">{priorityCfg.label} priority</TooltipContent>
                      </Tooltip>
                      <p
                        onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                        className="min-w-0 flex-1 cursor-text truncate text-sm font-semibold leading-snug text-[#1f1b17]"
                      >
                        {task.title}
                      </p>
                    </div>
                    {task.description && (
                      <p
                        onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                        className="line-clamp-2 cursor-text pl-3 text-xs leading-relaxed text-[#7c7367]"
                      >
                        {task.description}
                      </p>
                    )}
                  </div>
                )}

                {!isEditing && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Tooltip>
                      <TooltipTrigger
                        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-[#8a8a85] transition-colors hover:bg-violet-50 hover:text-violet-500"
                      >
                        <Pencil size={12} />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Edit title</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-[#8a8a85] transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={12} />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Delete task</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* Metadata row */}
              {!isEditing && (
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex items-center gap-2">
                    {ageLabel ? (
                      <span className={`flex items-center gap-0.5 text-[11px] ${ageLabel.color}`}>
                        {ageLabel.Icon && <ageLabel.Icon size={11} />}
                        {ageLabel.label}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 text-[#8a8a85]">
                        <Calendar size={11} />
                        <span className="text-[11px]">Just now</span>
                      </div>
                    )}
                    
                    {task.due_date && (
                      <div className={`flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-sm border ${
                        dueDateStatus(task.due_date) === 'overdue' ? 'border-red-200 bg-red-50 text-red-600' : 
                        dueDateStatus(task.due_date) === 'today' ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-transparent text-[#8a8a85]'
                      }`}>
                         {dueDateStatus(task.due_date) === 'overdue' ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                         <span>{formatDate(task.due_date)}</span>
                      </div>
                    )}
                  </div>
                  
                  {task.assignee_id ? (
                    <Avatar className="h-5 w-5 border border-[#e4e4e0]">
                      <AvatarImage src={task.assignee?.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[9px] bg-violet-100 text-violet-600 font-semibold">
                         {task.assignee?.name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Avatar className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <AvatarFallback className="text-[10px] bg-gray-100 text-gray-400 font-semibold border-dashed border border-gray-300">+</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}

