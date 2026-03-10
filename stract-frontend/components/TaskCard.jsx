'use client';

import { useState, useRef, useEffect } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Trash2, Calendar, Pencil, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { differenceInDays, formatDistanceToNow } from 'date-fns';
import { updateTask } from '@/lib/api';
import { useApp } from '@/context/AppContext';

const PRIORITY_CONFIG = {
  high:   { dot: 'bg-red-500',   label: 'High'   },
  medium: { dot: 'bg-amber-500', label: 'Medium' },
  low:    { dot: 'bg-gray-400',  label: 'Low'    },
};

export default function TaskCard({ task, index, onDelete, onRename }) {
  const { activeWorkspace } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { if (!isEditing) setEditTitle(task.title); }, [task.title, isEditing]);
  useEffect(() => { if (isEditing) inputRef.current?.select(); }, [isEditing]);

  const handleSave = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === task.title) { setEditTitle(task.title); setIsEditing(false); return; }
    setIsSaving(true);
    try {
      const result = await updateTask(activeWorkspace?.id, task.id, trimmed);
      onRename(task.id, result.data.title);
      setIsEditing(false);
    } catch {
      setEditTitle(task.title);
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
          <Card className={`
            group bg-white border border-[#e4e4e0] rounded-lg shadow-sm p-0
            cursor-grab active:cursor-grabbing transition-all duration-150
            ${snapshot.isDragging
              ? 'shadow-xl border-[#c9c9c4] rotate-1 opacity-90 scale-[1.02]'
              : 'hover:shadow-md hover:border-[#c9c9c4]'}
          `}>
            <CardContent className="p-3">
              {/* Title row with priority dot */}
              <div className="flex items-start justify-between gap-2">
                {isEditing ? (
                  <Input
                    ref={inputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    disabled={isSaving}
                    className="h-7 text-sm font-medium py-0 px-1.5 border-[#e4e4e0] focus-visible:ring-violet-300 -ml-0.5"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
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
                )}

                {!isEditing && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                          className="inline-flex items-center justify-center rounded-lg h-6 w-6 text-[#8a8a85] hover:text-violet-500 hover:bg-violet-50 transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Edit title</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                          className="inline-flex items-center justify-center rounded-lg h-6 w-6 text-[#8a8a85] hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Delete task</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* Metadata row */}
              {!isEditing && (
                <div className="flex items-center justify-between mt-2.5">
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
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px] bg-violet-100 text-violet-600 font-semibold">J</AvatarFallback>
                  </Avatar>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}
