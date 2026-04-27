'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { deleteTaskTemplate, updateTaskTemplate } from '@/lib/api';
import type { ChecklistItem, Priority, Task, TaskTemplate } from '@/types';
import ApplyTaskTemplate from './ApplyTaskTemplate';

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

function SortableChecklistItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-60')}
    >
      <div className="flex items-start gap-2">
        <button type="button" {...attributes} {...listeners} className="mt-1 text-[#a59c8f] hover:text-[#5f574b]">
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

interface TaskTemplateEditorProps {
  workspaceId: string;
  projectId: string | null;
  template: TaskTemplate;
  onChanged: (template: TaskTemplate) => void;
  onDeleted: (templateId: string) => Promise<void> | void;
  onApplied?: (task: Task) => void;
}

export default function TaskTemplateEditor({
  workspaceId,
  projectId,
  template,
  onChanged,
  onDeleted,
  onApplied,
}: TaskTemplateEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [draft, setDraft] = useState<TaskTemplate>(template);
  const saveTimerRef = useRef<number | null>(null);
  const lastSerializedRef = useRef(JSON.stringify(template));

  useEffect(() => {
    const serialized = JSON.stringify(draft);
    if (serialized === lastSerializedRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const result = await updateTaskTemplate(workspaceId, draft.id, {
          name: draft.name,
          description: draft.description,
          title: draft.title,
          task_description: draft.task_description,
          priority: draft.priority,
          label: draft.label,
          checklist: draft.checklist,
        });
        lastSerializedRef.current = JSON.stringify(result.data);
        onChanged(result.data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Unknown error');
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [draft, onChanged, workspaceId]);

  const checklistItems = useMemo(
    () => draft.checklist.map((item, index) => ({ ...item, id: `${index}-${item.title}` })),
    [draft.checklist],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = checklistItems.findIndex((item) => item.id === active.id);
    const newIndex = checklistItems.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setDraft((current) => ({
      ...current,
      checklist: arrayMove(current.checklist, oldIndex, newIndex),
    }));
  };

  const handleDeleteTemplate = async () => {
    if (!window.confirm(`Delete "${template.name}"?`)) return;
    try {
      await deleteTaskTemplate(workspaceId, template.id);
      await onDeleted(template.id);
      toast.success('Task template deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
      <div className="space-y-6 px-6 py-5">
        <section className="space-y-3">
          <Input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className="h-11 border-[#ddd7cd] bg-white text-lg font-semibold"
          />
          <Textarea
            value={draft.description ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            placeholder="Describe when this task template should be used"
            className="min-h-[84px] border-[#ddd7cd] bg-white"
          />
        </section>

        <section className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Task Details</p>
          <Input
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="Task title"
            className="border-[#ddd7cd] bg-white"
          />
          <Textarea
            value={draft.task_description ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, task_description: event.target.value }))}
            placeholder="Task description"
            className="min-h-[120px] border-[#ddd7cd] bg-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            {PRIORITIES.map((priority) => (
              <button
                key={priority}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, priority }))}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs uppercase tracking-wide',
                  draft.priority === priority
                    ? 'bg-[#1f1b17] text-white'
                    : 'border border-[#ece5d8] bg-white text-[#8f877a]',
                )}
              >
                {priority}
              </button>
            ))}
          </div>
          <Input
            value={draft.label ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
            placeholder="Label"
            className="border-[#ddd7cd] bg-white"
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Checklist</p>
            <Button
              variant="outline"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  checklist: [...current.checklist, { title: 'New checklist item' }],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={checklistItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-3">
                {checklistItems.map((item, index) => (
                  <SortableChecklistItem key={item.id} id={item.id}>
                    <div className="rounded-xl border border-[#ece5d8] bg-white p-3">
                      <div className="flex items-center gap-3">
                        <Input
                          value={draft.checklist[index]?.title ?? ''}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              checklist: current.checklist.map((check, itemIndex) =>
                                itemIndex === index ? ({ title: event.target.value } satisfies ChecklistItem) : check,
                              ),
                            }))
                          }
                          className="border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              checklist: current.checklist.filter((_, itemIndex) => itemIndex !== index),
                            }))
                          }
                          className="rounded-md p-1 text-[#a59c8f] hover:bg-[#f5efe5] hover:text-[#4f4a43]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </SortableChecklistItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </section>
      </div>

      <div className="flex items-center justify-between border-t border-[#e7e2d8] px-6 py-4">
        <Button variant="outline" onClick={handleDeleteTemplate} className="border-red-200 text-red-600 hover:bg-red-50">
          Delete Template
        </Button>
        <ApplyTaskTemplate
          workspaceId={workspaceId}
          projectId={projectId}
          template={template}
          onApplied={onApplied}
          triggerLabel="Apply Template"
        />
      </div>
    </div>
  );
}
