'use client';

import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createTask } from '@/lib/api';
import type { Task, Workspace, Project, Priority } from '@/types';

interface AddTaskInputProps {
  statusId: string;
  taskCount: number;
  onTaskAdded: (task: Task) => void;
  onError: (msg: string) => void;
  activeWorkspace: Workspace | null;
  activeProject: Project | null;
}

export default function AddTaskInput({ statusId, taskCount, onTaskAdded, onError, activeWorkspace, activeProject }: AddTaskInputProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed || !activeWorkspace?.id || !activeProject?.id) return;
    setIsSubmitting(true);
    try {
      const result = await createTask(activeWorkspace.id, {
        project_id: activeProject.id,
        title: trimmed,
        status_id: statusId,
        priority: priority,
        position: taskCount * 65536,
        description: description.trim()
      });
      onTaskAdded(result.data);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setIsEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      onError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => { setTitle(''); setDescription(''); setPriority('medium'); setIsEditing(false); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') handleCancel();
  };

  if (!isEditing) {
    return (
      <Button
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="mt-3 h-10 w-full justify-start gap-2 rounded-xl border border-dashed border-[#d8d1c5] text-sm text-[#8a8a85] transition-all duration-150 hover:border-[#b7aea1] hover:bg-[#f7f3ec] hover:text-[#2a241c]"
      >
        <Plus size={14} />
        Add task
      </Button>
    );
  }

  return (
    <div className="mt-2 transition-all duration-200">
      <Input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Task name..."
        autoFocus
        disabled={isSubmitting}
        className="mb-1.5 h-9 border-[#e6dfd2] bg-[#fbfaf7] text-sm focus-visible:border-violet-400 focus-visible:ring-violet-300"
      />
      <Input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Description (optional)"
        disabled={isSubmitting}
        className="h-8 border-[#e6dfd2] bg-[#fbfaf7] text-[13px] focus-visible:border-violet-400 focus-visible:ring-violet-300"
      />
      <div className="flex items-center gap-2 mt-2">
        {/* Priority selector */}
        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)} disabled={isSubmitting}>
          <SelectTrigger className="h-7 w-[100px] border-[#e6dfd2] bg-[#fbfaf7] text-xs focus:ring-violet-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                Low
              </span>
            </SelectItem>
            <SelectItem value="medium">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                Medium
              </span>
            </SelectItem>
            <SelectItem value="high">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                High
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || !title.trim()}
          className="h-7 bg-[#1f1b17] px-3 text-xs text-white hover:bg-[#35302a]"
        >
          <Check size={11} className="mr-1" />
          {isSubmitting ? 'Adding…' : 'Add'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="h-7 px-2 text-xs text-[#8a8a85] hover:text-[#2a241c]"
        >
          <X size={11} className="mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

