'use client';

import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createTask } from '@/lib/api';

export default function AddTaskInput({ status, taskCount, onTaskAdded, onError }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setIsSubmitting(true);
    try {
      const result = await createTask(trimmed, status, taskCount * 1000);
      onTaskAdded(result.data);
      setTitle('');
      setIsEditing(false);
    } catch (err) {
      onError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => { setTitle(''); setIsEditing(false); };
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
        className="text-sm bg-white h-9 border-[#e4e4e0] focus-visible:ring-violet-300 focus-visible:border-violet-400"
      />
      <div className="flex items-center gap-2 mt-2">
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
