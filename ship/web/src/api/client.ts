async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// Docs API
export async function getDocs() {
  const response = await fetch('/api/docs');
  return handleResponse(response);
}

export async function getDoc(id: string) {
  const response = await fetch(`/api/docs/${id}`);
  return handleResponse(response);
}

export async function createDoc(data: { title: string; content: string }) {
  const response = await fetch('/api/docs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateDoc(id: string, data: { title?: string; content?: string }) {
  const response = await fetch(`/api/docs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteDoc(id: string) {
  const response = await fetch(`/api/docs/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

// Issues API
export async function getIssues(filters?: { status?: string; priority?: string }) {
  let url = '/api/issues';
  if (filters) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
  }
  const response = await fetch(url);
  return handleResponse(response);
}

export async function getIssue(id: string) {
  const response = await fetch(`/api/issues/${id}`);
  return handleResponse(response);
}

export async function createIssue(data: { title: string; content: string; status?: string; priority?: string }) {
  const response = await fetch('/api/issues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateIssue(id: string, data: { title?: string; content?: string; status?: string; priority?: string }) {
  const response = await fetch(`/api/issues/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteIssue(id: string) {
  const response = await fetch(`/api/issues/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

// Projects API
export async function getProjects() {
  const response = await fetch('/api/projects');
  return handleResponse(response);
}

export async function getProject(id: string) {
  const response = await fetch(`/api/projects/${id}`);
  return handleResponse(response);
}

export async function createProject(data: { title: string; content: string; status?: string }) {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateProject(id: string, data: { title?: string; content?: string; status?: string }) {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteProject(id: string) {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

// Weeks API
export async function getWeeks() {
  const response = await fetch('/api/weeks');
  return handleResponse(response);
}

export async function getWeek(id: string) {
  const response = await fetch(`/api/weeks/${id}`);
  return handleResponse(response);
}

export async function createWeek(data: { title: string; content: string }) {
  const response = await fetch('/api/weeks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateWeek(id: string, data: { title?: string; content?: string }) {
  const response = await fetch(`/api/weeks/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteWeek(id: string) {
  const response = await fetch(`/api/weeks/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

// Teams API
export async function getTeams() {
  const response = await fetch('/api/teams');
  return handleResponse(response);
}

export async function getTeam(id: string) {
  const response = await fetch(`/api/teams/${id}`);
  return handleResponse(response);
}

export async function createTeam(data: { name: string; content: string }) {
  const response = await fetch('/api/teams', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateTeam(id: string, data: { name?: string; content?: string }) {
  const response = await fetch(`/api/teams/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteTeam(id: string) {
  const response = await fetch(`/api/teams/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}
