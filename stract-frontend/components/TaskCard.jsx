'use client';

import { useState, useRef, useEffect } from 'react';
import { Draggable } from '@hello-pangea/dnd';
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

export default function TaskCard({ task, index, onDelete, onRename }) {
  const { activeWorkspace, openTask } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

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
    setIsSaving(true);
    try {
      const result = await updateTask(activeWorkspace?.id, task.id, { title: trimmed, description: trimmedDesc });
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

  const handleKeyDown = (e) => {
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
              group bg-white border border-[#e4e4e0] rounded-lg shadow-sm p-0
              cursor-pointer active:cursor-grabbing transition-all duration-150
              ${snapshot.isDragging
                ? 'shadow-xl border-[#c9c9c4] rotate-1 opacity-90 scale-[1.02]'
                : 'hover:shadow-md hover:border-[#c9c9c4]'}
            `}>
            <CardContent className="p-3">
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
                      className="h-7 text-sm font-medium py-0 px-1.5 border-[#e4e4e0] focus-visible:ring-violet-300"
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
                      className="w-full resize-none text-xs rounded-md border border-[#e4e4e0] bg-white px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-50"
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
                        className="text-sm font-medium text-gray-800 leading-snug flex-1 min-w-0 cursor-text truncate"
                      >
                        {task.title}
                      </p>
                    </div>
                    {task.description && (
                      <p
                        onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                        className="text-xs text-[#8a8a85] line-clamp-2 leading-relaxed pl-3 cursor-text"
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
                        className="inline-flex items-center justify-center rounded-lg h-6 w-6 text-[#8a8a85] hover:text-violet-500 hover:bg-violet-50 transition-colors"
                      >
                        <Pencil size={12} />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Edit title</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                        className="inline-flex items-center justify-center rounded-lg h-6 w-6 text-[#8a8a85] hover:text-red-500 hover:bg-red-50 transition-colors"
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
                        dueDateStatus(task.due_date) === 'overdue' ? 'border-red-200 text-red-600 bg-red-50' : 
                        dueDateStatus(task.due_date) === 'today' ? 'border-amber-200 text-amber-600 bg-amber-50' : 'border-transparent text-[#8a8a85]'
                      }`}>
                         {dueDateStatus(task.due_date) === 'overdue' ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                         <span>{formatDate(task.due_date)}</span>
                      </div>
                    )}
                  </div>
                  
                  {task.assignee_id ? (
                    <Avatar className="h-5 w-5 border border-[#e4e4e0]">
                      <AvatarImage src={task.assignee?.avatar_url} />
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
