'use client';

import { Droppable } from '@hello-pangea/dnd';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import TaskCard from './TaskCard';
import AddTaskInput from './AddTaskInput';
import { updateStatus, deleteStatus } from '@/lib/api';
import { useState, useRef, useEffect } from 'react';
import type { Task, Workspace, Project } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ColumnProps {
  statusId: string;
  statusName: string;
  statusColor: string;
  tasks: Task[];
  onDelete: (id: string) => void;
  onRename: (id: string, title: string, desc: string | null) => void;
  onTaskAdded: (t: Task) => void;
  onError: (msg: string) => void;
  activeWorkspace: Workspace;
  activeProject: Project;
  onStatusUpdate: () => void;
}

export default function Column({ statusId, statusName, statusColor, tasks, onDelete, onRename, onTaskAdded, onError, activeWorkspace, activeProject, onStatusUpdate }: ColumnProps) {
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>(statusName);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  const handleStatusRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === statusName) {
      setIsRenaming(false);
      setNewName(statusName);
      return;
    }
    try {
      await updateStatus(activeWorkspace.id, activeProject.id, statusId, { name: trimmed });
      onStatusUpdate();
      setIsRenaming(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
      setNewName(statusName);
      setIsRenaming(false);
    }
  };

  const handleStatusDelete = async () => {
    if (tasks.length > 0) {
      toast.error("Cannot delete a column that contains tasks.");
      return;
    }
    if (!confirm(`Are you sure you want to delete the '${statusName}' column?`)) return;
    try {
      await deleteStatus(activeWorkspace.id, activeProject.id, statusId);
      onStatusUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    }
  };

  return (
    <div className="flex max-h-[calc(100vh-220px)] w-[320px] min-w-[320px] flex-col rounded-[20px] border border-[#e7e2d8] bg-white p-4">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor || '#9ca3af' }} />
          {isRenaming ? (
            <Input
              ref={renameInputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleStatusRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStatusRename();
                if (e.key === 'Escape') { setIsRenaming(false); setNewName(statusName); }
              }}
              className="h-8 border-[#e6dfd2] bg-[#fbfaf7] px-2 text-sm font-medium focus-visible:ring-violet-300"
            />
          ) : (
            <span 
              className="cursor-pointer truncate text-sm font-semibold text-[#2a241c] hover:text-black" 
              onDoubleClick={() => setIsRenaming(true)}
            >
              {statusName}
            </span>
          )}
          <Badge variant="secondary" className="flex h-5 min-w-[22px] items-center justify-center bg-[#f4efe6] px-1.5 text-xs font-semibold text-[#6c6457]">
            {tasks.length}
          </Badge>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a8a85] transition-colors hover:bg-[#f5f2ec] hover:text-[#2a241c]">
            <MoreHorizontal size={15} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 border-[#e4e4e0] bg-white">
            <DropdownMenuItem onClick={() => setIsRenaming(true)} className="text-xs">
              Rename Column
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#e4e4e0]" />
            <DropdownMenuItem onClick={handleStatusDelete} className="text-xs text-red-600 focus:text-red-600 focus:bg-red-50">
              Delete Column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator className="my-3 bg-[#efe8dc]" />

      {/* Droppable area */}
      <Droppable droppableId={statusId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              -mx-1 min-h-[80px] flex-1 overflow-y-auto rounded-[14px] px-1 transition-colors duration-150
              ${snapshot.isDraggingOver ? 'bg-[#f4f7ff] ring-1 ring-blue-200' : ''}
            `}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center py-10">
                <p className="text-xs text-[#8a8a85]">No tasks yet</p>
              </div>
            )}

            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add task */}
      <AddTaskInput
        statusId={statusId}
        taskCount={tasks.length}
        onTaskAdded={onTaskAdded}
        onError={onError}
        activeWorkspace={activeWorkspace}
        activeProject={activeProject}
      />
    </div>
  );
}

