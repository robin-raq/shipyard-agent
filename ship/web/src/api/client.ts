async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

import { authFetch } from '../context/AuthContext';

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
export async function updateIssueStatus(id: string, status: string) {
  const response = await authFetch(`/api/issues/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });
  return handleResponse(response);
}

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

export async function createTeam(data: { name: string; description: string }) {
  const response = await fetch('/api/teams', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateTeam(id: string, data: { name?: string; description?: string }) {
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

// Ships API
export async function getShips() {
  const response = await fetch('/api/ships');
  return handleResponse(response);
}

export async function getShip(id: string) {
  const response = await fetch(`/api/ships/${id}`);
  return handleResponse(response);
}

export async function createShip(data: { name: string; description?: string; status?: string }) {
  const response = await fetch('/api/ships', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateShip(id: string, data: { name?: string; description?: string; status?: string }) {
  const response = await fetch(`/api/ships/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteShip(id: string) {
  const response = await fetch(`/api/ships/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

// Standups API
export async function getStandups(filters?: { date?: string; user_id?: string; from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (filters?.date) params.set('date', filters.date);
  if (filters?.user_id) params.set('user_id', filters.user_id);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  const query = params.toString();
  const response = await authFetch(`/api/standups${query ? '?' + query : ''}`);
  return handleResponse(response);
}

export async function getStandupStatus() {
  const response = await authFetch('/api/standups/status');
  return handleResponse(response);
}

export async function createStandup(data: { yesterday: string; today: string; blockers: string }) {
  const response = await authFetch('/api/standups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateStandup(id: string, data: { yesterday?: string; today?: string; blockers?: string }) {
  const response = await authFetch(`/api/standups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteStandup(id: string) {
  const response = await authFetch(`/api/standups/${id}`, { method: 'DELETE' });
  return handleResponse(response);
}

// Programs API
export async function getPrograms(options?: { search?: string; limit?: number; offset?: number }) {
  let url = '/api/programs';
  if (options) {
    const params = new URLSearchParams();
    if (options.search) params.append('search', options.search);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
  }
  const response = await fetch(url);
  return handleResponse(response);
}

export async function getProgram(id: string) {
  const response = await fetch(`/api/programs/${id}`);
  return handleResponse(response);
}

export async function createProgram(data: { name: string; description?: string }) {
  const response = await fetch('/api/programs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateProgram(id: string, data: { name?: string; description?: string }) {
  const response = await fetch(`/api/programs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteProgram(id: string) {
  const response = await fetch(`/api/programs/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

// Weekly Plans API
export async function getWeeklyPlans(filters?: { week_id?: string; user_id?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.week_id) params.set('week_id', filters.week_id);
  if (filters?.user_id) params.set('user_id', filters.user_id);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  const response = await authFetch(`/api/weekly-plans${query ? '?' + query : ''}`);
  return handleResponse(response);
}

export async function createWeeklyPlan(data: { week_id?: string; plan_content: string }) {
  const response = await authFetch('/api/weekly-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateWeeklyPlan(id: string, data: { plan_content: string }) {
  const response = await authFetch(`/api/weekly-plans/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function submitWeeklyPlan(id: string) {
  const response = await authFetch(`/api/weekly-plans/${id}/submit`, { method: 'PATCH' });
  return handleResponse(response);
}

export async function deleteWeeklyPlan(id: string) {
  const response = await authFetch(`/api/weekly-plans/${id}`, { method: 'DELETE' });
  return handleResponse(response);
}

// Weekly Retros API
export async function getWeeklyRetros(filters?: { week_id?: string; user_id?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.week_id) params.set('week_id', filters.week_id);
  if (filters?.user_id) params.set('user_id', filters.user_id);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  const response = await authFetch(`/api/weekly-retros${query ? '?' + query : ''}`);
  return handleResponse(response);
}

export async function createWeeklyRetro(data: { week_id?: string; plan_id?: string; went_well: string; to_improve: string; action_items: string }) {
  const response = await authFetch('/api/weekly-retros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function submitWeeklyRetro(id: string) {
  const response = await authFetch(`/api/weekly-retros/${id}/submit`, { method: 'PATCH' });
  return handleResponse(response);
}

export async function deleteWeeklyRetro(id: string) {
  const response = await authFetch(`/api/weekly-retros/${id}`, { method: 'DELETE' });
  return handleResponse(response);
}

// Reviews API
export async function getPendingReviews() {
  const response = await authFetch('/api/reviews/pending');
  return handleResponse(response);
}

export async function getReviews(filters?: { entity_type?: string; entity_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.entity_type) params.set('entity_type', filters.entity_type);
  if (filters?.entity_id) params.set('entity_id', filters.entity_id);
  const query = params.toString();
  const response = await authFetch(`/api/reviews${query ? '?' + query : ''}`);
  return handleResponse(response);
}

export async function createReview(data: { entity_type: string; entity_id: string; decision: string; comment?: string }) {
  const response = await authFetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}
