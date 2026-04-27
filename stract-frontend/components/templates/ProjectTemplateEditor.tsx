'use client';

import { useMemo, useState } from 'react';
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
import {
  addTemplateStatus,
  addTemplateTask,
  deleteProjectTemplate,
  deleteTemplateStatus,
  deleteTemplateTask,
  updateProjectTemplate,
  updateTemplateStatus,
  updateTemplateTask,
} from '@/lib/api';
import type { Priority, ProjectTemplate, ProjectTemplateTask } from '@/types';
import ApplyProjectTemplate from './ApplyProjectTemplate';

const PRESET_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];
const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

function SortableTemplateTask({
  task,
  children,
}: {
  task: ProjectTemplateTask;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-60')}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-1 text-[#a59c8f] hover:text-[#5f574b]"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

interface ProjectTemplateEditorProps {
  workspaceId: string;
  template: ProjectTemplate;
  onChanged: (template: ProjectTemplate) => void;
  onDeleted: (templateId: string) => Promise<void> | void;
}

export default function ProjectTemplateEditor({
  workspaceId,
  template,
  onChanged,
  onDeleted,
}: ProjectTemplateEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? '');
  const [applyOpen, setApplyOpen] = useState(false);

  const orderedStatuses = useMemo(
    () => [...template.statuses].sort((a, b) => a.position - b.position),
    [template.statuses],
  );

  const tasksByStatus = useMemo(() => {
    const groups = new Map<string | null, ProjectTemplateTask[]>();
    template.tasks.forEach((task) => {
      const key = task.status_id;
      const list = groups.get(key) ?? [];
      list.push(task);
      groups.set(key, list);
    });
    groups.forEach((value) => value.sort((a, b) => a.position - b.position));
    return groups;
  }, [template.tasks]);

  const saveMeta = async (patch: Partial<Pick<ProjectTemplate, 'name' | 'description' | 'color'>>) => {
    try {
      const result = await updateProjectTemplate(workspaceId, template.id, patch);
      onChanged(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    }
  };

  const replaceTask = (nextTask: ProjectTemplateTask) => {
    onChanged({
      ...template,
      tasks: template.tasks.map((task) => (task.id === nextTask.id ? nextTask : task)),
    });
  };

  const handleTaskDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTask = template.tasks.find((task) => task.id === active.id);
    const overTask = template.tasks.find((task) => task.id === over.id);
    if (!activeTask || !overTask || activeTask.status_id !== overTask.status_id) return;

    const currentTasks = (tasksByStatus.get(activeTask.status_id) ?? []).slice();
    const oldIndex = currentTasks.findIndex((task) => task.id === active.id);
    const newIndex = currentTasks.findIndex((task) => task.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(currentTasks, oldIndex, newIndex);
    const previous = reordered[newIndex - 1];
    const next = reordered[newIndex + 1];
    const newPosition = next
      ? ((previous?.position ?? 0) + next.position) / 2
      : (previous?.position ?? 0) + 65536;

    try {
      const result = await updateTemplateTask(workspaceId, template.id, activeTask.id, {
        position: newPosition,
      });
      replaceTask(result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!window.confirm(`Delete "${template.name}"?`)) return;
    try {
      await deleteProjectTemplate(workspaceId, template.id);
      await onDeleted(template.id);
      toast.success('Project template deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(message);
    }
  };

  return (
    <div className="rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
      <div className="border-b border-[#e7e2d8] px-6 py-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Template metadata</p>
        <div className="mt-3 flex flex-col gap-4">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (name.trim() && name !== template.name) {
                void saveMeta({ name: name.trim() });
              }
            }}
            className="h-11 border-[#ddd7cd] bg-white text-lg font-semibold"
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => {
              if (description !== (template.description ?? '')) {
                void saveMeta({ description });
              }
            }}
            className="min-h-[84px] border-[#ddd7cd] bg-white"
            placeholder="Add a short description for when to use this template"
          />
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => void saveMeta({ color })}
                className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-105"
                style={{
                  backgroundColor: color,
                  borderColor: template.color === color ? '#1f1b17' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Column preview</p>
            <p className="mt-1 text-sm text-[#746d62]">Define statuses and starter tasks for new projects created from this template.</p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              void addTemplateStatus(workspaceId, template.id, { name: 'New Status', color: '#6b7280' })
                .then((result) => onChanged({ ...template, statuses: [...template.statuses, result.data] }))
                .catch((err) => toast.error(err instanceof Error ? err.message : 'Unknown error'))
            }
          >
            <Plus className="h-4 w-4" />
            Add Status
          </Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleTaskDragEnd(event)}>
          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max items-start gap-4">
              {orderedStatuses.map((status) => {
                const tasks = tasksByStatus.get(status.id) ?? [];
                return (
                  <div key={status.id} className="w-[290px] rounded-[18px] border border-[#e7e2d8] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Input
                          defaultValue={status.name}
                          onBlur={(event) => {
                            const value = event.target.value.trim();
                            if (value && value !== status.name) {
                              void updateTemplateStatus(workspaceId, template.id, status.id, { name: value })
                                .then((result) =>
                                  onChanged({
                                    ...template,
                                    statuses: template.statuses.map((item) =>
                                      item.id === result.data.id ? result.data : item,
                                    ),
                                  }),
                                )
                                .catch((err) => toast.error(err instanceof Error ? err.message : 'Unknown error'));
                            }
                          }}
                          className="h-8 border-none bg-transparent px-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() =>
                                void updateTemplateStatus(workspaceId, template.id, status.id, { color })
                                  .then((result) =>
                                    onChanged({
                                      ...template,
                                      statuses: template.statuses.map((item) =>
                                        item.id === result.data.id ? result.data : item,
                                      ),
                                    }),
                                  )
                                  .catch((err) => toast.error(err instanceof Error ? err.message : 'Unknown error'))
                              }
                              className="h-5 w-5 rounded-full border"
                              style={{ backgroundColor: color, borderColor: status.color === color ? '#1f1b17' : 'transparent' }}
                            />
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`Delete status "${status.name}"?`)) return;
                          void deleteTemplateStatus(workspaceId, template.id, status.id)
                            .then(() =>
                              onChanged({
                                ...template,
                                statuses: template.statuses.filter((item) => item.id !== status.id),
                              }),
                            )
                            .catch((err) => toast.error(err instanceof Error ? err.message : 'Unknown error'));
                        }}
                        className="rounded-md p-1 text-[#a59c8f] hover:bg-[#f5efe5] hover:text-[#4f4a43]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
                      <div className="mt-4 flex flex-col gap-3">
                        {tasks.map((task) => (
                          <SortableTemplateTask key={task.id} task={task}>
                            <div className="rounded-xl border border-[#ece5d8] bg-[#fcfbf8] p-3">
                              <Input
                                defaultValue={task.title}
                                onBlur={(event) => {
                                  const value = event.target.value.trim();
                                  if (value && value !== task.title) {
                                    void updateTemplateTask(workspaceId, template.id, task.id, { title: value })
                                      .then((result) => replaceTask(result.data))
                                      .catch((err) => toast.error(err instanceof Error ? err.message : 'Unknown error'));
                                  }
                                }}
                                className="h-8 border-none bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
                              />
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  {PRIORITIES.map((priority) => (
                                    <button
                                      key={priority}
                                      type="button"
                                      onClick={() =>
                                        void updateTemplateTask(workspaceId, template.id, task.id, { priority })
                                          .then((result) => replaceTask(result.data))
                                          .catch((err) => toast.error(err instanceof Error ? err.message : 'Unknown error'))
                                      }
                                      className={cn(
                                        'rounded-full px-2 py-1 text-[10px] uppercase tracking-wide',
                                        task.priority === priority
                                          ? 'bg-[#1f1b17] text-white'
                                          : 'border border-[#ece5d8] bg-white text-[#8f877a]',
                                      )}
                                    >
                                      {priority}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteTemplateTask(workspaceId, template.id, task.id)
                                      .then(() =>
                                        onChanged({
                                          ...template,
                                          tasks: template.tasks.filter((item) => item.id !== task.id),
                                        }),
                                      )
                                      .catch((err) => toast.error(err instanceof Error ? err.message : 'Unknown error'))
                                  }
                                  className="rounded-md p-1 text-[#a59c8f] hover:bg-white hover:text-[#4f4a43]"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </SortableTemplateTask>
                        ))}
                      </div>
                    </SortableContext>

                    <button
                      type="button"
                      onClick={() =>
                        void addTemplateTask(workspaceId, template.id, {
                          title: 'New task',
                          status_id: status.id,
                        })
                          .then((result) => onChanged({ ...template, tasks: [...template.tasks, result.data] }))
                          .catch((err) => toast.error(err instanceof Error ? err.message : 'Unknown error'))
                      }
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d9d2c6] px-3 py-3 text-sm text-[#8f877a] hover:border-[#bdb4a4] hover:text-[#5f574b]"
                    >
                      <Plus className="h-4 w-4" />
                      Add Task
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </DndContext>
      </div>

      <div className="flex items-center justify-between border-t border-[#e7e2d8] px-6 py-4">
        <Button variant="outline" onClick={handleDeleteTemplate} className="border-red-200 text-red-600 hover:bg-red-50">
          Delete Template
        </Button>
        <Button onClick={() => setApplyOpen(true)} className="bg-[#1f1b17] text-white hover:bg-[#312a21]">
          Apply Template
        </Button>
      </div>

      <ApplyProjectTemplate
        workspaceId={workspaceId}
        template={template}
        open={applyOpen}
        onOpenChange={setApplyOpen}
      />
    </div>
  );
}
