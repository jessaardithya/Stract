import { supabase } from '@/lib/supabase';
import type {
  Activity,
  AnalyticsSummary,
  ApiResponse,
  CreatedInvitation,
  FormField,
  FormListItem,
  FormSubmission,
  MeetingActionItem,
  MeetingListItem,
  MeetingNote,
  PendingInvitation,
  Priority,
  ProjectTemplate,
  ProjectTemplateListItem,
  ProjectTemplateStatus,
  ProjectTemplateTask,
  ProjectForm,
  PublicFormData,
  Project,
  ProjectStatus,
  ChecklistItem,
  Subtask,
  Task,
  TaskTemplate,
  TaskTemplateListItem,
  UserActivity,
  Workspace,
  WorkspaceMember,
  WorkspaceReports,
} from '@/types';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';

const authHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
  };
};

const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers = await authHeaders();
  const url = path.startsWith('http') ? path : `${API_BASE}${path.replace(/^\/api\/v1/, '')}`;
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    await supabase.auth.signOut();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
};

// Workspaces
export const getWorkspaces = (): Promise<ApiResponse<Workspace[]>> =>
  apiFetch('/api/v1/workspaces');

export const createWorkspace = (data: Pick<Workspace, 'name' | 'slug' | 'description'>): Promise<ApiResponse<Workspace>> =>
  apiFetch('/api/v1/workspaces', { method: 'POST', body: JSON.stringify(data) });

export const updateWorkspace = (workspaceId: string, data: Partial<Pick<Workspace, 'name' | 'slug' | 'description'>>): Promise<ApiResponse<Workspace>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteWorkspace = (workspaceId: string): Promise<void> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}`, { method: 'DELETE' });

export const getWorkspaceMembers = (workspaceId: string): Promise<WorkspaceMember[]> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/members`);

export const removeWorkspaceMember = (workspaceId: string, memberId: string): Promise<ApiResponse<{ message: string }>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, { method: 'DELETE' });

export const getPendingInvitations = (): Promise<ApiResponse<PendingInvitation[]>> =>
  apiFetch('/api/v1/invitations/pending');

export const acceptInvitation = (token: string): Promise<ApiResponse<Workspace>> =>
  apiFetch(`/api/v1/invitations/${token}/accept`, { method: 'POST' });

export const getMyActivity = (): Promise<ApiResponse<UserActivity[]>> =>
  apiFetch('/api/v1/users/me/activity');

export const createInvitation = (
  workspaceId: string,
  data?: { expires_in_days?: number; invited_email?: string }
): Promise<ApiResponse<CreatedInvitation>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/invitations`, {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  });

// Templates
export const getProjectTemplates = (workspaceId: string): Promise<ApiResponse<ProjectTemplateListItem[]>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects`);

export const createProjectTemplate = (
  workspaceId: string,
  data: { name: string; description?: string | null; color?: string }
): Promise<ApiResponse<ProjectTemplate>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getProjectTemplate = (
  workspaceId: string,
  templateId: string
): Promise<ApiResponse<ProjectTemplate>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects/${templateId}`);

export const updateProjectTemplate = (
  workspaceId: string,
  templateId: string,
  data: Partial<Pick<ProjectTemplate, 'name' | 'description' | 'color'>>
): Promise<ApiResponse<ProjectTemplate>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteProjectTemplate = (workspaceId: string, templateId: string): Promise<void> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects/${templateId}`, {
    method: 'DELETE',
  });

export const addTemplateStatus = (
  workspaceId: string,
  templateId: string,
  data: Pick<ProjectTemplateStatus, 'name' | 'color'>
): Promise<ApiResponse<ProjectTemplateStatus>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects/${templateId}/statuses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateTemplateStatus = (
  workspaceId: string,
  templateId: string,
  statusId: string,
  data: Partial<Pick<ProjectTemplateStatus, 'name' | 'color' | 'position'>>
): Promise<ApiResponse<ProjectTemplateStatus>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects/${templateId}/statuses/${statusId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteTemplateStatus = (
  workspaceId: string,
  templateId: string,
  statusId: string
): Promise<void> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects/${templateId}/statuses/${statusId}`, {
    method: 'DELETE',
  });

export const addTemplateTask = (
  workspaceId: string,
  templateId: string,
  data: {
    title: string;
    description?: string | null;
    priority?: Priority;
    status_id?: string | null;
    position?: number;
  }
): Promise<ApiResponse<ProjectTemplateTask>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects/${templateId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateTemplateTask = (
  workspaceId: string,
  templateId: string,
  taskId: string,
  data: Partial<{
    title: string;
    description: string | null;
    priority: Priority;
    status_id: string | null;
    position: number;
  }>
): Promise<ApiResponse<ProjectTemplateTask>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects/${templateId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteTemplateTask = (
  workspaceId: string,
  templateId: string,
  taskId: string
): Promise<void> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects/${templateId}/tasks/${taskId}`, {
    method: 'DELETE',
  });

export const applyProjectTemplate = (
  workspaceId: string,
  templateId: string,
  data: { name: string; color?: string }
): Promise<ApiResponse<Project>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/projects/${templateId}/apply`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getTaskTemplates = (workspaceId: string): Promise<ApiResponse<TaskTemplateListItem[]>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/tasks`);

export const createTaskTemplate = (
  workspaceId: string,
  data: {
    name: string;
    description?: string | null;
    title: string;
    task_description?: string | null;
    priority?: Priority;
    label?: string | null;
    checklist?: ChecklistItem[];
  }
): Promise<ApiResponse<TaskTemplate>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getTaskTemplate = (
  workspaceId: string,
  templateId: string
): Promise<ApiResponse<TaskTemplate>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/tasks/${templateId}`);

export const updateTaskTemplate = (
  workspaceId: string,
  templateId: string,
  data: Partial<{
    name: string;
    description: string | null;
    title: string;
    task_description: string | null;
    priority: Priority;
    label: string | null;
    checklist: ChecklistItem[];
  }>
): Promise<ApiResponse<TaskTemplate>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/tasks/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteTaskTemplate = (workspaceId: string, templateId: string): Promise<void> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/tasks/${templateId}`, {
    method: 'DELETE',
  });

export const applyTaskTemplate = (
  workspaceId: string,
  templateId: string,
  data: {
    project_id: string;
    status_id: string;
    assignee_id?: string | null;
    due_date?: string | null;
  }
): Promise<ApiResponse<Task>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/templates/tasks/${templateId}/apply`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// Projects
export const getProjects = (workspaceId: string): Promise<ApiResponse<Project[]>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects`);

export const createProject = (
  workspaceId: string,
  data: Pick<Project, 'name' | 'color'> & { description?: string }
): Promise<ApiResponse<Project>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects`, {
    method: 'POST', body: JSON.stringify(data)
  });

export const updateProject = (
  workspaceId: string,
  projectId: string,
  data: Partial<Pick<Project, 'name' | 'color' | 'description'>>
): Promise<ApiResponse<Project>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`, {
    method: 'PATCH', body: JSON.stringify(data)
  });

export const deleteProject = (
  workspaceId: string,
  projectId: string
): Promise<ApiResponse<Project>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`, {
    method: 'DELETE'
  });

// Statuses
export const getStatuses = (
  workspaceId: string,
  projectId: string
): Promise<ApiResponse<ProjectStatus[]>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/statuses`);

export const createStatus = (
  workspaceId: string,
  projectId: string,
  data: Pick<ProjectStatus, 'name' | 'color' | 'position'>
): Promise<ApiResponse<ProjectStatus>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/statuses`, {
    method: 'POST', body: JSON.stringify(data)
  });

export const updateStatus = (
  workspaceId: string,
  projectId: string,
  statusId: string,
  data: Partial<Pick<ProjectStatus, 'name' | 'color' | 'position'>>
): Promise<ApiResponse<ProjectStatus>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/statuses/${statusId}`, {
    method: 'PATCH', body: JSON.stringify(data)
  });

export const deleteStatus = (
  workspaceId: string,
  projectId: string,
  statusId: string
): Promise<void> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/statuses/${statusId}`, {
    method: 'DELETE'
  });

// Tasks
export const getTasks = (
  workspaceId: string,
  projectId: string,
  filters?: Record<string, string>
): Promise<ApiResponse<Task[]>> => {
  const params = new URLSearchParams({ project_id: projectId, ...filters });
  return apiFetch(`/api/v1/workspaces/${workspaceId}/tasks?${params}`);
};

export const getTask = (
  workspaceId: string,
  taskId: string
): Promise<ApiResponse<Task>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}`);

export const createTask = (
  workspaceId: string,
  data: Pick<Task, 'title' | 'project_id' | 'status_id' | 'priority' | 'position' | 'description'>
): Promise<ApiResponse<Task>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks`, {
    method: 'POST', body: JSON.stringify(data)
  });

export const updateTask = (
  workspaceId: string,
  taskId: string,
  data: Partial<{
    title: string;
    description: string | null;
    status_id: string;
    priority: Priority;
    label: string | null;
    due_date: string | null;
    start_date: string | null;
    assignee_id: string | null;
  }>
): Promise<ApiResponse<Task>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, {
    method: 'PATCH', body: JSON.stringify(data)
  });

export const updateTaskPosition = (
  workspaceId: string,
  taskId: string,
  data: { status_id: string; prev_pos: number; next_pos: number | null }
): Promise<ApiResponse<Task>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}/position`, {
    method: 'PATCH', body: JSON.stringify(data)
  });

export const deleteTask = (
  workspaceId: string,
  taskId: string
): Promise<void> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}`, {
    method: 'DELETE'
  });

// Members
export const getMembers = (
  workspaceId: string
): Promise<ApiResponse<WorkspaceMember[]>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/members`);

// Labels
export const getLabels = (
  workspaceId: string
): Promise<ApiResponse<string[]>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/labels`);

// Subtasks
export const getSubtasks = (
  workspaceId: string,
  taskId: string
): Promise<ApiResponse<Subtask[]>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}/subtasks`);

export const createSubtask = (
  workspaceId: string,
  taskId: string,
  data: Pick<Subtask, 'title'>
): Promise<ApiResponse<Subtask>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}/subtasks`, {
    method: 'POST', body: JSON.stringify(data)
  });

export const updateSubtask = (
  workspaceId: string,
  taskId: string,
  subtaskId: string,
  data: Partial<Pick<Subtask, 'title' | 'is_done'>>
): Promise<ApiResponse<Subtask>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: 'PATCH', body: JSON.stringify(data)
  });

export const deleteSubtask = (
  workspaceId: string,
  taskId: string,
  subtaskId: string
): Promise<void> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: 'DELETE'
  });

// Activity
export const getActivity = (
  workspaceId: string,
  taskId: string
): Promise<ApiResponse<Activity[]>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}/activity`);

export const createComment = (
  workspaceId: string,
  taskId: string,
  body: string
): Promise<ApiResponse<Activity>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/tasks/${taskId}/activity`, {
    method: 'POST', body: JSON.stringify({ body })
  });

// Analytics
export const getAnalytics = (
  workspaceId: string,
  projectId: string
): Promise<AnalyticsSummary> =>
  apiFetch<AnalyticsSummary | ApiResponse<AnalyticsSummary>>(
    `/api/v1/workspaces/${workspaceId}/analytics/summary?project_id=${projectId}`,
  ).then((result) => ('data' in result ? result.data : result));

export const getWorkspaceReports = (
  workspaceId: string
): Promise<WorkspaceReports> =>
  apiFetch<WorkspaceReports>(`/api/v1/workspaces/${workspaceId}/analytics/reports`);

// Meetings
export const getMeetings = (
  workspaceId: string,
  projectId: string
): Promise<ApiResponse<MeetingListItem[]>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/meetings`);

export const createMeeting = (
  workspaceId: string,
  projectId: string
): Promise<ApiResponse<MeetingNote>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/meetings`, { method: 'POST', body: '{}' });

export const getMeeting = (
  workspaceId: string,
  projectId: string,
  meetingId: string
): Promise<ApiResponse<MeetingNote>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/meetings/${meetingId}`);

export const updateMeeting = (
  workspaceId: string,
  projectId: string,
  meetingId: string,
  data: Partial<Pick<MeetingNote, 'title' | 'meeting_date' | 'location' | 'attendees' | 'agenda' | 'notes' | 'decisions'>>
): Promise<ApiResponse<MeetingNote>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/meetings/${meetingId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteMeeting = (
  workspaceId: string,
  projectId: string,
  meetingId: string
): Promise<void> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/meetings/${meetingId}`, { method: 'DELETE' });

export const createActionItem = (
  workspaceId: string,
  projectId: string,
  meetingId: string,
  data: { title: string; assignee_id?: string | null; due_date?: string | null }
): Promise<ApiResponse<MeetingActionItem>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/meetings/${meetingId}/action-items`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateActionItem = (
  workspaceId: string,
  projectId: string,
  meetingId: string,
  itemId: string,
  data: Partial<{ title: string; is_done: boolean; assignee_id: string | null; due_date: string | null }>
): Promise<ApiResponse<MeetingActionItem>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/meetings/${meetingId}/action-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteActionItem = (
  workspaceId: string,
  projectId: string,
  meetingId: string,
  itemId: string
): Promise<void> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/meetings/${meetingId}/action-items/${itemId}`, {
    method: 'DELETE',
  });

export const convertActionItem = (
  workspaceId: string,
  projectId: string,
  meetingId: string,
  itemId: string
): Promise<ApiResponse<{ task_id: string; task_title: string }>> =>
  apiFetch(`/api/v1/workspaces/${workspaceId}/projects/${projectId}/meetings/${meetingId}/action-items/${itemId}/convert`, {
    method: 'POST',
    body: '{}',
  });

// ─── Forms ───────────────────────────────────────────────────────────────────

const formBase = (workspaceId: string, projectId: string) =>
  `/workspaces/${workspaceId}/projects/${projectId}/forms`;

export const getForms = (workspaceId: string, projectId: string): Promise<ApiResponse<FormListItem[]>> =>
  apiFetch(`${formBase(workspaceId, projectId)}`);

export const createForm = (workspaceId: string, projectId: string): Promise<ApiResponse<ProjectForm>> =>
  apiFetch(`${formBase(workspaceId, projectId)}`, { method: 'POST', body: '{}' });

export const getForm = (workspaceId: string, projectId: string, formId: string): Promise<ApiResponse<ProjectForm>> =>
  apiFetch(`${formBase(workspaceId, projectId)}/${formId}`);

export const updateForm = (
  workspaceId: string,
  projectId: string,
  formId: string,
  data: Partial<Pick<ProjectForm, 'title' | 'description' | 'is_public' | 'auto_create' | 'is_active' | 'default_status_id' | 'default_priority'>>,
): Promise<ApiResponse<ProjectForm>> =>
  apiFetch(`${formBase(workspaceId, projectId)}/${formId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteForm = (workspaceId: string, projectId: string, formId: string): Promise<ApiResponse<{ message: string }>> =>
  apiFetch(`${formBase(workspaceId, projectId)}/${formId}`, { method: 'DELETE' });

// Fields
export const createFormField = (
  workspaceId: string,
  projectId: string,
  formId: string,
  data: { label: string; field_type: string; placeholder?: string; options?: string[]; is_required?: boolean; position?: number },
): Promise<ApiResponse<FormField>> =>
  apiFetch(`${formBase(workspaceId, projectId)}/${formId}/fields`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateFormField = (
  workspaceId: string,
  projectId: string,
  formId: string,
  fieldId: string,
  data: { label?: string; placeholder?: string; options?: string[] | null; is_required?: boolean; position?: number },
): Promise<ApiResponse<FormField>> =>
  apiFetch(`${formBase(workspaceId, projectId)}/${formId}/fields/${fieldId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteFormField = (
  workspaceId: string,
  projectId: string,
  formId: string,
  fieldId: string,
): Promise<void> =>
  apiFetch(`${formBase(workspaceId, projectId)}/${formId}/fields/${fieldId}`, { method: 'DELETE' });

// Public form (no auth header)
const publicHeaders = { 'Content-Type': 'application/json' };

export const getPublicForm = async (slug: string): Promise<ApiResponse<PublicFormData>> => {
  const res = await fetch(`${API_BASE}/forms/${slug}`, { headers: publicHeaders });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || 'Form not found');
  }
  return res.json() as Promise<ApiResponse<PublicFormData>>;
};

export const submitForm = async (
  slug: string,
  data: { answers: Record<string, string>; submitter_name?: string; submitter_email?: string },
): Promise<{ submission_id: string; message: string; auto_created: boolean; task_id?: string }> => {
  const res = await fetch(`${API_BASE}/forms/${slug}/submit`, {
    method: 'POST',
    headers: publicHeaders,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || 'Submission failed');
  }
  return res.json();
};

// Submissions management (auth)
export const getSubmissions = (
  workspaceId: string,
  projectId: string,
  formId: string,
  status?: string,
): Promise<ApiResponse<FormSubmission[]>> => {
  const qs = status ? `?status=${status}` : '';
  return apiFetch(`${formBase(workspaceId, projectId)}/${formId}/submissions${qs}`);
};

export const approveSubmission = (
  workspaceId: string,
  projectId: string,
  formId: string,
  submissionId: string,
): Promise<ApiResponse<{ task_id: string; submission_id: string }>> =>
  apiFetch(`${formBase(workspaceId, projectId)}/${formId}/submissions/${submissionId}/approve`, {
    method: 'POST',
    body: '{}',
  });

export const rejectSubmission = (
  workspaceId: string,
  projectId: string,
  formId: string,
  submissionId: string,
): Promise<ApiResponse<{ message: string }>> =>
  apiFetch(`${formBase(workspaceId, projectId)}/${formId}/submissions/${submissionId}/reject`, {
    method: 'POST',
    body: '{}',
  });
