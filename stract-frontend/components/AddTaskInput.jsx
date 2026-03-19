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

export default function AddTaskInput({ statusId, onTaskAdded, onError, activeWorkspace, activeProject }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed || !activeWorkspace?.id || !activeProject?.id) return;
    setIsSubmitting(true);
    try {
      const result = await createTask(activeWorkspace.id, activeProject.id, trimmed, statusId, priority, description.trim());
      onTaskAdded(result.data);
      setTitle('');
      setDescription('');
      setPriority('medium');
      setIsEditing(false);
    } catch (err) {
      onError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => { setTitle(''); setDescription(''); setPriority('medium'); setIsEditing(false); };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') handleCancel();
  };

  if (!isEditing) {
    return (
      <Button
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="w-full mt-2 h-9 justify-start text-sm text-[#8a8a85] hover:text-gray-700 hover:bg-[#ebebE8] border border-dashed border-[#c9c9c4] hover:border-[#9ca3af] rounded-lg gap-2 transition-all duration-150"
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
        className="text-sm bg-white h-9 border-[#e4e4e0] focus-visible:ring-violet-300 focus-visible:border-violet-400 mb-1.5"
      />
      <Input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Description (optional)"
        disabled={isSubmitting}
        className="text-[13px] bg-white h-8 border-[#e4e4e0] focus-visible:ring-violet-300 focus-visible:border-violet-400"
      />
      <div className="flex items-center gap-2 mt-2">
        {/* Priority selector */}
        <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
          <SelectTrigger className="h-7 text-xs w-[100px] border-[#e4e4e0] focus:ring-violet-300">
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
          className="h-7 text-xs px-3 bg-[#1a1a1a] hover:bg-[#333] text-white"
        >
          <Check size={11} className="mr-1" />
          {isSubmitting ? 'Adding…' : 'Add'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="h-7 text-xs px-2 text-[#8a8a85] hover:text-gray-700"
        >
          <X size={11} className="mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
