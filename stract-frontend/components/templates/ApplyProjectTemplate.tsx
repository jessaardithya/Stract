'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useApp } from '@/context/AppContext';
import { applyProjectTemplate } from '@/lib/api';
import type { Project, ProjectTemplate } from '@/types';

const PRESET_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

interface ApplyProjectTemplateProps {
  workspaceId: string;
  template: ProjectTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: (project: Project) => Promise<void> | void;
}

export default function ApplyProjectTemplate({
  workspaceId,
  template,
  open,
  onOpenChange,
  onApplied,
}: ApplyProjectTemplateProps) {
  const router = useRouter();
  const { refreshProjects, setActiveProject, appendProject } = useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!template || !open) return;
    setName(template.name);
    setColor(template.color);
  }, [template, open]);

  const handleApply = async () => {
    if (!template || !name.trim()) return;
    setSubmitting(true);
    try {
      const result = await applyProjectTemplate(workspaceId, template.id, {
        name: name.trim(),
        color,
      });
      appendProject(result.data);
      await refreshProjects();
      setActiveProject(result.data);
      await onApplied?.(result.data);
      onOpenChange(false);
      router.push('/');
      toast.success('Project created from template');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#e4e4e0] bg-[#fffdf9] sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create project from template</DialogTitle>
          <DialogDescription>
            {template ? `Template: ${template.name}` : 'Choose a template to continue'}
          </DialogDescription>
        </DialogHeader>

        {template ? (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-[#ece5d8] bg-white px-4 py-3 text-sm text-[#5f574b]">
              Includes {template.statuses.length} statuses and {template.tasks.length} tasks.
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Project name
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="border-[#ddd7cd] bg-white"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Color
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-105"
                    style={{
                      backgroundColor: preset,
                      borderColor: color === preset ? '#1f1b17' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleApply()}
            disabled={!template || !name.trim() || submitting}
            className="bg-[#1f1b17] text-white hover:bg-[#312a21]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Project →'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
