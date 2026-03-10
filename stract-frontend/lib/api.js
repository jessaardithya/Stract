const API_BASE = 'http://localhost:8080/api/v1';

function getHeaders() {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function fetchTasks() {
  const res = await fetch(`${API_BASE}/tasks`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function createTask(title, status, position) {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ title, status, position }),
  });
  return handleResponse(res);
}

export async function deleteTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function updateTaskPosition(id, status, prevPos, nextPos) {
  const body = { status, prev_pos: prevPos };
  // Only include next_pos when defined — backend interprets absence as "dropped at bottom"
  if (nextPos !== null && nextPos !== undefined) {
    body.next_pos = nextPos;
  }
  const res = await fetch(`${API_BASE}/tasks/${id}/position`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function updateTask(id, title) {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ title }),
  });
  return handleResponse(res);
}


