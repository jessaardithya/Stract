'use client';

import { Droppable } from '@hello-pangea/dnd';
import { MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import TaskCard from './TaskCard';
import AddTaskInput from './AddTaskInput';

const COLUMN_CONFIG = {
  'todo': {
    label: 'Todo',
    dot: 'bg-[#9ca3af]',
    dotBorder: 'border-[#9ca3af]',
  },
  'in-progress': {
    label: 'In Progress',
    dot: 'bg-[#3b82f6]',
    dotBorder: 'border-[#3b82f6]',
  },
  'done': {
    label: 'Done',
    dot: 'bg-[#10b981]',
    dotBorder: 'border-[#10b981]',
  },
};

export default function Column({ status, tasks, onDelete, onRename, onTaskAdded, onError, activeWorkspace, activeProject }) {
  const cfg = COLUMN_CONFIG[status] || COLUMN_CONFIG['todo'];

  return (
    <div className="flex flex-col w-[300px] min-w-[300px] rounded-xl bg-[#f4f4f2] border border-[#e4e4e0] p-4 max-h-[calc(100vh-160px)]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
          <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
          <Badge variant="secondary" className="text-xs font-semibold px-1.5 min-w-[22px] h-5 flex items-center justify-center">
            {tasks.length}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#8a8a85] hover:text-gray-700 hover:bg-[#e4e4e0]/60">
          <MoreHorizontal size={15} />
        </Button>
      </div>

      <Separator className="my-3 bg-[#e4e4e0]" />

      {/* Droppable area */}
      <Droppable droppableId={status}>
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
        status={status}
        taskCount={tasks.length}
        onTaskAdded={onTaskAdded}
        onError={onError}
        activeWorkspace={activeWorkspace}
        activeProject={activeProject}
      />
    </div>
  );
}
