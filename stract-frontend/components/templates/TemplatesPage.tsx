'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  createProjectTemplate,
  createTaskTemplate,
  getProjectTemplate,
  getProjectTemplates,
  getTaskTemplate,
  getTaskTemplates,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import type {
  ProjectTemplate,
  ProjectTemplateListItem,
  Task,
  TaskTemplate,
  TaskTemplateListItem,
} from '@/types';
import ProjectTemplatesList from './ProjectTemplatesList';
import ProjectTemplateEditor from './ProjectTemplateEditor';
import TaskTemplatesList from './TaskTemplatesList';
import TaskTemplateEditor from './TaskTemplateEditor';

type TemplateTab = 'projects' | 'tasks';

export default function TemplatesPage() {
  const { activeWorkspace, activeProject } = useApp();
  const [tab, setTab] = useState<TemplateTab>('projects');
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplateListItem[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplateListItem[]>([]);
  const [projectLoading, setProjectLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeProjectTemplate, setActiveProjectTemplate] = useState<ProjectTemplate | null>(null);
  const [activeTaskTemplate, setActiveTaskTemplate] = useState<TaskTemplate | null>(null);

  useEffect(() => {
    if (!activeWorkspace?.id) return;

    void (async () => {
      setProjectLoading(true);
      try {
        const result = await getProjectTemplates(activeWorkspace.id);
        const items = result.data || [];
        setProjectTemplates(items);
        setSelectedProjectId((current) => current ?? items[0]?.id ?? null);
      } finally {
        setProjectLoading(false);
      }
    })();

    void (async () => {
      setTaskLoading(true);
      try {
        const result = await getTaskTemplates(activeWorkspace.id);
        const items = result.data || [];
        setTaskTemplates(items);
        setSelectedTaskId((current) => current ?? items[0]?.id ?? null);
      } finally {
        setTaskLoading(false);
      }
    })();
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!activeWorkspace?.id || !selectedProjectId) {
      setActiveProjectTemplate(null);
      return;
    }
    void getProjectTemplate(activeWorkspace.id, selectedProjectId).then((result) => setActiveProjectTemplate(result.data));
  }, [activeWorkspace?.id, selectedProjectId]);

  useEffect(() => {
    if (!activeWorkspace?.id || !selectedTaskId) {
      setActiveTaskTemplate(null);
      return;
    }
    void getTaskTemplate(activeWorkspace.id, selectedTaskId).then((result) => setActiveTaskTemplate(result.data));
  }, [activeWorkspace?.id, selectedTaskId]);

  const projectEmpty = useMemo(
    () => 'No project templates yet — create one to speed up project setup',
    [],
  );
  const taskEmpty = useMemo(
    () => 'No task templates yet — create one to reuse common task structures',
    [],
  );

  if (!activeWorkspace) {
    return (
      <div className="rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] px-8 py-16 text-center shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
        <h2 className="text-xl font-semibold text-[#1f1b17]">Choose a workspace first</h2>
        <p className="mt-2 text-sm text-[#746d62]">Templates are scoped to the active workspace.</p>
      </div>
    );
  }

  const createNewProjectTemplate = async () => {
    const result = await createProjectTemplate(activeWorkspace.id, { name: 'New Project Template' });
    setProjectTemplates((current) => [
      {
        id: result.data.id,
        name: result.data.name,
        description: result.data.description,
        color: result.data.color,
        status_count: result.data.statuses.length,
        task_count: result.data.tasks.length,
        creator_id: result.data.creator_id,
        created_at: result.data.created_at,
      },
      ...current,
    ]);
    setSelectedProjectId(result.data.id);
    setActiveProjectTemplate(result.data);
  };

  const createNewTaskTemplate = async () => {
    const result = await createTaskTemplate(activeWorkspace.id, {
      name: 'New Task Template',
      title: 'New task',
      checklist: [],
    });
    setTaskTemplates((current) => [
      {
        id: result.data.id,
        name: result.data.name,
        description: result.data.description,
        title: result.data.title,
        priority: result.data.priority,
        label: result.data.label,
        checklist_count: result.data.checklist.length,
        created_at: result.data.created_at,
      },
      ...current,
    ]);
    setSelectedTaskId(result.data.id);
    setActiveTaskTemplate(result.data);
  };

  const syncProjectTemplate = (template: ProjectTemplate) => {
    setActiveProjectTemplate(template);
    setProjectTemplates((current) =>
      current.map((item) =>
        item.id === template.id
          ? {
              ...item,
              name: template.name,
              description: template.description,
              color: template.color,
              status_count: template.statuses.length,
              task_count: template.tasks.length,
            }
          : item,
      ),
    );
  };

  const syncTaskTemplate = (template: TaskTemplate) => {
    setActiveTaskTemplate(template);
    setTaskTemplates((current) =>
      current.map((item) =>
        item.id === template.id
          ? {
              ...item,
              name: template.name,
              description: template.description,
              title: template.title,
              priority: template.priority,
              label: template.label,
              checklist_count: template.checklist.length,
            }
          : item,
      ),
    );
  };

  const handleProjectDeleted = async (templateId: string) => {
    const next = projectTemplates.filter((item) => item.id !== templateId);
    setProjectTemplates(next);
    const nextSelected = next[0]?.id ?? null;
    setSelectedProjectId(nextSelected);
    setActiveProjectTemplate(null);
  };

  const handleTaskDeleted = async (templateId: string) => {
    const next = taskTemplates.filter((item) => item.id !== templateId);
    setTaskTemplates(next);
    const nextSelected = next[0]?.id ?? null;
    setSelectedTaskId(nextSelected);
    setActiveTaskTemplate(null);
  };

  const handleTaskApplied = (_task: Task) => {
    // Board/List/Timeline will own optimistic insertion. On the templates page
    // we only need the apply flow itself to succeed.
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] px-5 py-5 shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f877a]">Templates</p>
          <h1 className="mt-1.5 text-[2rem] font-semibold tracking-[-0.05em] text-[#1f1b17]">
            {activeWorkspace.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#746d62]">
            Save project structures and repeatable tasks once, then apply them anywhere in this workspace.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-[#e6dfd2] bg-white p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTab('projects')}
            className={tab === 'projects' ? 'rounded-full bg-[#1f1b17] text-white hover:bg-[#1f1b17]' : 'rounded-full text-[#5e564a] hover:bg-[#f5f2ec]'}
          >
            Project Templates
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTab('tasks')}
            className={tab === 'tasks' ? 'rounded-full bg-[#1f1b17] text-white hover:bg-[#1f1b17]' : 'rounded-full text-[#5e564a] hover:bg-[#f5f2ec]'}
          >
            Task Templates
          </Button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[18px] border border-[#e7e2d8] bg-[#fbfaf7] p-4 shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {tab === 'projects' ? 'Project Templates' : 'Task Templates'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void (tab === 'projects' ? createNewProjectTemplate() : createNewTaskTemplate())}
            >
              <Plus className="h-4 w-4" />
              New Template
            </Button>
          </div>

          {tab === 'projects' ? (
            projectTemplates.length === 0 && !projectLoading ? (
              <div className="rounded-xl border border-dashed border-[#d9d2c6] bg-white px-4 py-8 text-sm text-[#746d62]">
                {projectEmpty}
              </div>
            ) : (
              <ProjectTemplatesList
                templates={projectTemplates}
                selectedId={selectedProjectId}
                loading={projectLoading}
                onSelect={setSelectedProjectId}
              />
            )
          ) : taskTemplates.length === 0 && !taskLoading ? (
            <div className="rounded-xl border border-dashed border-[#d9d2c6] bg-white px-4 py-8 text-sm text-[#746d62]">
              {taskEmpty}
            </div>
          ) : (
            <TaskTemplatesList
              templates={taskTemplates}
              selectedId={selectedTaskId}
              loading={taskLoading}
              onSelect={setSelectedTaskId}
            />
          )}
        </aside>

        <section>
          {tab === 'projects' ? (
            activeProjectTemplate ? (
              <ProjectTemplateEditor
                key={activeProjectTemplate.id}
                workspaceId={activeWorkspace.id}
                template={activeProjectTemplate}
                onChanged={syncProjectTemplate}
                onDeleted={handleProjectDeleted}
              />
            ) : (
              <div className="rounded-[18px] border border-dashed border-[#d9d2c6] bg-[#fbfaf7] px-8 py-16 text-center text-[#746d62] shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
                {projectEmpty}
              </div>
            )
          ) : activeTaskTemplate ? (
              <TaskTemplateEditor
                key={activeTaskTemplate.id}
                workspaceId={activeWorkspace.id}
                projectId={activeProject?.id ?? null}
                template={activeTaskTemplate}
              onChanged={syncTaskTemplate}
              onDeleted={handleTaskDeleted}
              onApplied={handleTaskApplied}
            />
          ) : (
            <div className="rounded-[18px] border border-dashed border-[#d9d2c6] bg-[#fbfaf7] px-8 py-16 text-center text-[#746d62] shadow-[0_18px_40px_-32px_rgba(28,24,17,0.22)]">
              {taskEmpty}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
