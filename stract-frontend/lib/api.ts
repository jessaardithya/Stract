import { supabase } from '@/lib/supabase';
import type {
  Activity,
  AnalyticsSummary,
  ApiResponse,
  PendingInvitation,
  Priority,
  Project,
  ProjectStatus,
  Subtask,
  Task,
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

export const getPendingInvitations = (): Promise<ApiResponse<PendingInvitation[]>> =>
  apiFetch('/api/v1/invitations/pending');

export const acceptInvitation = (token: string): Promise<ApiResponse<Workspace>> =>
  apiFetch(`/api/v1/invitations/${token}/accept`, { method: 'POST' });

export const getMyActivity = (): Promise<ApiResponse<UserActivity[]>> =>
  apiFetch('/api/v1/users/me/activity');

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
