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

export default function TaskCard({ task, index, onDelete, onRename }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) setEditTitle(task.title);
  }, [task.title, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === task.title) {
      setEditTitle(task.title);
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      const result = await updateTask(task.id, trimmed);
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
    if (e.key === 'Escape') {
      setEditTitle(task.title);
      setIsEditing(false);
    }
  };

  // --- Age indicator ---
  const ageLabel = (() => {
    if (!task.last_moved_at) return null;
    const days = differenceInDays(new Date(), new Date(task.last_moved_at));
    if (days < 1) return null;
    const label = formatDistanceToNow(new Date(task.last_moved_at), { addSuffix: true });
    if (days > 7) return { label, color: 'text-red-400', Icon: Flame };
    if (days > 3) return { label, color: 'text-amber-500', Icon: null };
    return { label, color: 'text-[#8a8a85]', Icon: null };
  })();

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-2"
        >
          <Card className={`
            group bg-white border border-[#e4e4e0] rounded-lg shadow-sm p-0
            cursor-grab active:cursor-grabbing
            transition-all duration-150
            ${snapshot.isDragging
              ? 'shadow-xl border-[#c9c9c4] rotate-1 opacity-90 scale-[1.02]'
              : 'hover:shadow-md hover:border-[#c9c9c4]'
            }
          `}>
            <CardContent className="p-3">
              {/* Title row */}
              <div className="flex items-start justify-between gap-2">
                {isEditing ? (
                  <Input
                    ref={inputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    disabled={isSaving}
                    className="h-7 text-sm font-medium py-0 px-1.5 border-[#e4e4e0] focus-visible:ring-violet-300 focus-visible:border-violet-400 -ml-0.5"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p
                    onDoubleClick={handleStartEdit}
                    title="Double-click to edit"
                    className="text-sm font-medium text-gray-800 leading-snug flex-1 min-w-0 cursor-text"
                  >
                    {task.title}
                  </p>
                )}

                {!isEditing && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                    <Tooltip>
                      <TooltipTrigger
                        onClick={handleStartEdit}
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
                    {/* Age indicator */}
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
                  </div>
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
