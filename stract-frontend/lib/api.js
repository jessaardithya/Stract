import { supabase } from './supabase';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';

async function apiFetch(endpoint, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (res.status === 401) {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
  return data;
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export function getWorkspaces() {
  return apiFetch('/workspaces');
}

export function createWorkspace(data) {
  return apiFetch('/workspaces', { method: 'POST', body: JSON.stringify(data) });
}

export function updateWorkspace(id, data) {
  return apiFetch(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteWorkspace(id) {
  return apiFetch(`/workspaces/${id}`, { method: 'DELETE' });
}

// ── Projects ─────────────────────────────────────────────────────────────────

export function getProjects(workspaceId) {
  return apiFetch(`/workspaces/${workspaceId}/projects`);
}

export function createProject(workspaceId, data) {
  return apiFetch(`/workspaces/${workspaceId}/projects`, { method: 'POST', body: JSON.stringify(data) });
}

export function updateProject(workspaceId, id, data) {
  return apiFetch(`/workspaces/${workspaceId}/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function deleteProject(workspaceId, id) {
  return apiFetch(`/workspaces/${workspaceId}/projects/${id}`, { method: 'DELETE' });
}

// ── Tasks (workspace-scoped) ──────────────────────────────────────────────────

export function getTask(workspaceId, taskId) {
  return apiFetch(`/workspaces/${workspaceId}/tasks/${taskId}`);
}


export function getTasks(workspaceId, projectId, filters = {}) {
  const params = new URLSearchParams({ project_id: projectId, ...filters });
  return apiFetch(`/workspaces/${workspaceId}/tasks?${params}`);
}

export function createTask(workspaceId, projectId, title, status, priority = 'medium', description = '') {
  return apiFetch(`/workspaces/${workspaceId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ title, status, project_id: projectId, priority, description }),
  });
}

export function updateTask(workspaceId, id, data) {
  return apiFetch(`/workspaces/${workspaceId}/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function updateTaskPosition(workspaceId, id, status, prevPos, nextPos) {
  const body = { status, prev_pos: prevPos };
  if (nextPos !== null && nextPos !== undefined) body.next_pos = nextPos;
  return apiFetch(`/workspaces/${workspaceId}/tasks/${id}/position`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteTask(workspaceId, id) {
  return apiFetch(`/workspaces/${workspaceId}/tasks/${id}`, { method: 'DELETE' });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export function getAnalytics(workspaceId, projectId) {
  return apiFetch(`/workspaces/${workspaceId}/analytics/summary?project_id=${projectId}`);
}

// Legacy — used by SSE hook (non-workspace-scoped)
export function fetchAnalytics() {
  return apiFetch(`/analytics/summary`);
}

// ── Members & Labels ──────────────────────────────────────────────────────────

export function getMembers(workspaceId) {
  return apiFetch(`/workspaces/${workspaceId}/members`);
}

export function getLabels(workspaceId) {
  return apiFetch(`/workspaces/${workspaceId}/labels`);
}
