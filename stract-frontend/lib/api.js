const API_BASE = 'http://localhost:8080/api/v1';

function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
  return data;
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export function getWorkspaces() {
  return fetch(`${API_BASE}/workspaces`, { headers: getHeaders() }).then(handleResponse);
}

export function createWorkspace(data) {
  return fetch(`${API_BASE}/workspaces`, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
  }).then(handleResponse);
}

// ── Projects ─────────────────────────────────────────────────────────────────

export function getProjects(workspaceId) {
  return fetch(`${API_BASE}/workspaces/${workspaceId}/projects`, { headers: getHeaders() }).then(handleResponse);
}

export function createProject(workspaceId, data) {
  return fetch(`${API_BASE}/workspaces/${workspaceId}/projects`, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
  }).then(handleResponse);
}

export function updateProject(workspaceId, id, data) {
  return fetch(`${API_BASE}/workspaces/${workspaceId}/projects/${id}`, {
    method: 'PATCH', headers: getHeaders(), body: JSON.stringify(data),
  }).then(handleResponse);
}

export function deleteProject(workspaceId, id) {
  return fetch(`${API_BASE}/workspaces/${workspaceId}/projects/${id}`, {
    method: 'DELETE', headers: getHeaders(),
  }).then(handleResponse);
}

// ── Tasks (workspace-scoped) ──────────────────────────────────────────────────

export function getTasks(workspaceId, projectId, filters = {}) {
  const params = new URLSearchParams({ project_id: projectId, ...filters });
  return fetch(`${API_BASE}/workspaces/${workspaceId}/tasks?${params}`, { headers: getHeaders() }).then(handleResponse);
}

export function createTask(workspaceId, projectId, title, status, priority = 'medium') {
  return fetch(`${API_BASE}/workspaces/${workspaceId}/tasks`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title, status, project_id: projectId, priority }),
  }).then(handleResponse);
}

export function updateTask(workspaceId, id, title) {
  return fetch(`${API_BASE}/workspaces/${workspaceId}/tasks/${id}`, {
    method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ title }),
  }).then(handleResponse);
}

export function updateTaskPosition(workspaceId, id, status, prevPos, nextPos) {
  const body = { status, prev_pos: prevPos };
  if (nextPos !== null && nextPos !== undefined) body.next_pos = nextPos;
  return fetch(`${API_BASE}/workspaces/${workspaceId}/tasks/${id}/position`, {
    method: 'PATCH', headers: getHeaders(), body: JSON.stringify(body),
  }).then(handleResponse);
}

export function deleteTask(workspaceId, id) {
  return fetch(`${API_BASE}/workspaces/${workspaceId}/tasks/${id}`, {
    method: 'DELETE', headers: getHeaders(),
  }).then(handleResponse);
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export function getAnalytics(workspaceId, projectId) {
  return fetch(`${API_BASE}/workspaces/${workspaceId}/analytics/summary?project_id=${projectId}`, {
    headers: getHeaders(),
  }).then(handleResponse);
}

// Legacy — used by SSE hook (non-workspace-scoped)
export function fetchAnalytics() {
  return fetch(`${API_BASE}/analytics/summary`, { headers: getHeaders() }).then(handleResponse);
}
