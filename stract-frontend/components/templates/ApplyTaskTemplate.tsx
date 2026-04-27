'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { LayoutTemplate, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStatuses } from '@/context/StatusContext';
import { applyTaskTemplate, getMembers, getTaskTemplate, getTaskTemplates } from '@/lib/api';
import type { Task, TaskTemplate, TaskTemplateListItem, WorkspaceMember } from '@/types';

interface ApplyTaskTemplateProps {
  workspaceId: string;
  projectId: string | null;
  template?: TaskTemplate | null;
  triggerLabel?: string;
  onApplied?: (task: Task) => void;
}

export default function ApplyTaskTemplate({
  workspaceId,
  projectId,
  template,
  triggerLabel = 'Templates',
  onApplied,
}: ApplyTaskTemplateProps) {
  const { statuses } = useStatuses();
  const [open, setOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplateListItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(template ?? null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [statusId, setStatusId] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('unassigned');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setSelectedTemplate(template);
      return;
    }

    let cancelled = false;
    const loadTemplates = async () => {
      setPickerLoading(true);
      try {
        const result = await getTaskTemplates(workspaceId);
        if (!cancelled) {
          setTemplates(result.data || []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(message);
      } finally {
        if (!cancelled) {
          setPickerLoading(false);
        }
      }
    };

    void loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [open, template, workspaceId]);

  useEffect(() => {
    if (!open || !workspaceId) return;
    void getMembers(workspaceId)
      .then((result) => setMembers(result.data || []))
      .catch(() => setMembers([]));
  }, [open, workspaceId]);

  useEffect(() => {
    if (!statusId && statuses[0]?.id) {
      setStatusId(statuses[0].id);
    }
  }, [statusId, statuses]);

  const selectedSummary = useMemo(() => {
    if (selectedTemplate) return selectedTemplate;
    return null;
  }, [selectedTemplate]);

  const chooseTemplate = async (templateId: string) => {
    try {
      const result = await getTaskTemplate(workspaceId, templateId);
      setSelectedTemplate(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    }
  };

  const handleApply = async () => {
    if (!selectedTemplate || !projectId || !statusId) return;
    setSubmitting(true);
    try {
      const result = await applyTaskTemplate(workspaceId, selectedTemplate.id, {
        project_id: projectId,
        status_id: statusId,
        assignee_id: assigneeId === 'unassigned' ? null : assigneeId,
        due_date: dueDate || null,
      });
      onApplied?.(result.data);
      toast.success('Task created from template');
      setOpen(false);
      if (!template) {
        setSelectedTemplate(null);
      }
      setDueDate('');
      setAssigneeId('unassigned');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!projectId}
        className="h-8 rounded-full border-[#e6dfd2] bg-white px-3 text-xs text-[#5e564a] hover:bg-[#f7f2ea]"
      >
        <LayoutTemplate className="h-3.5 w-3.5" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[#e4e4e0] bg-[#fffdf9] sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Apply task template</DialogTitle>
            <DialogDescription>
              {selectedSummary
                ? `Template: ${selectedSummary.name}`
                : 'Choose a template to create a task with predefined details.'}
            </DialogDescription>
          </DialogHeader>

          {!selectedSummary ? (
            <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
              {pickerLoading ? (
                <div className="text-sm text-[#746d62]">Loading templates…</div>
              ) : templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d9d2c6] bg-[#fbfaf7] px-4 py-8 text-sm text-[#746d62]">
                  No task templates yet.
                </div>
              ) : (
                templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void chooseTemplate(item.id)}
                    className="rounded-xl border border-[#e4e4e0] bg-white px-4 py-3 text-left transition-colors hover:border-[#d4cfc4] hover:bg-[#fffaf3]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1f1b17]">{item.name}</p>
                        <p className="mt-1 text-sm text-[#5f574b]">{item.title}</p>
                      </div>
                      <span className="rounded-full border border-[#ece5d8] bg-[#faf7f1] px-2 py-1 text-[11px] text-[#8f877a]">
                        {item.checklist_count} checklist items
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="rounded-xl border border-[#ece5d8] bg-white px-4 py-3 text-sm text-[#5f574b]">
                Will create 1 task, {selectedSummary.checklist.length} subtasks.
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Add to status
                </label>
                <Select value={statusId} onValueChange={setStatusId}>
                  <SelectTrigger className="w-full border-[#ddd7cd] bg-white">
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {statuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Assignee
                </label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="w-full border-[#ddd7cd] bg-white">
                    <SelectValue placeholder="Optional assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name || member.email}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Due date
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="border-[#ddd7cd] bg-white"
                />
                {dueDate && (
                  <p className="text-xs text-[#8f877a]">Due {format(new Date(dueDate), 'MMM d, yyyy')}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedSummary && !template ? (
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Back
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            )}
            {selectedSummary ? (
              <Button
                onClick={() => void handleApply()}
                disabled={!projectId || !statusId || submitting}
                className="bg-[#1f1b17] text-white hover:bg-[#312a21]"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Task →'}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
