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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Column({ statusId, statusName, statusColor, tasks, onDelete, onRename, onTaskAdded, onError, activeWorkspace, activeProject, onStatusUpdate }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(statusName);
  const renameInputRef = useRef(null);

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
      toast.error(err.message);
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
      toast.error(err.message);
    }
  };

  return (
    <div className="flex flex-col w-[300px] min-w-[300px] rounded-xl bg-[#f4f4f2] border border-[#e4e4e0] p-4 max-h-[calc(100vh-160px)]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor || '#9ca3af' }} />
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
              className="h-7 text-sm font-medium px-1 bg-white border-[#e4e4e0] focus-visible:ring-violet-300"
            />
          ) : (
            <span 
              className="text-sm font-medium text-gray-700 truncate cursor-pointer hover:text-gray-900" 
              onDoubleClick={() => setIsRenaming(true)}
            >
              {statusName}
            </span>
          )}
          <Badge variant="secondary" className="text-xs font-semibold px-1.5 min-w-[22px] h-5 flex items-center justify-center">
            {tasks.length}
          </Badge>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="h-7 w-7 flex items-center justify-center text-[#8a8a85] hover:text-gray-700 hover:bg-[#e4e4e0]/60 rounded-lg transition-colors">
            <MoreHorizontal size={15} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-white border-[#e4e4e0]">
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

      <Separator className="my-3 bg-[#e4e4e0]" />

      {/* Droppable area */}
      <Droppable droppableId={statusId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 overflow-y-auto min-h-[80px] -mx-1 px-1 rounded-lg transition-colors duration-150
              ${snapshot.isDraggingOver ? 'bg-blue-50 ring-1 ring-blue-200' : ''}
            `}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center py-8">
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
