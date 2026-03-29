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

// Backlinks API (Shared contract)
export type EntityType = 'issue' | 'project' | 'document' | 'ship' | 'program' | 'comment';

export interface Backlink {
  id: string;
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  createdAt: string;
}

export async function getBacklinks(entityType: string, entityId: string): Promise<Backlink[]> {
  const params = new URLSearchParams();
  if (entityType) params.set('entity_type', entityType);
  if (entityId) params.set('entity_id', entityId);
  const query = params.toString();
  const response = await authFetch(`/api/backlinks${query ? '?' + query : ''}`);
  const data = await handleResponse(response);
  if (Array.isArray(data)) return data as Backlink[];
  if (data && Array.isArray(data.backlinks)) return data.backlinks as Backlink[];
  return [];
}

export async function createBacklink(data: { sourceType: EntityType; sourceId: string; targetType: EntityType; targetId: string }): Promise<Backlink> {
  const response = await authFetch('/api/backlinks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const res = await handleResponse(response);
  return (res.backlink ?? res) as Backlink;
}

export async function deleteBacklink(id: string): Promise<void> {
  const response = await authFetch(`/api/backlinks/${id}`, { method: 'DELETE' });
  if (response.status === 204) return; // Contract: 204 No Content
  await handleResponse(response);
}

// Admin Users API (Shared contract)
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  title: string;
  department: string;
  createdAt: string;
  deletedAt: string | null;
  updatedAt: string | null;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const response = await authFetch('/api/admin/users');
  const data = await handleResponse(response);
  return (data.users ?? []) as AdminUser[];
}

export async function updateUserRole(id: string, role: string): Promise<AdminUser> {
  const response = await authFetch(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const data = await handleResponse(response);
  return data.user as AdminUser;
}

export async function deactivateUser(id: string): Promise<void> {
  const response = await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  await handleResponse(response);
}

// === API Tokens (Shared contract) ===
export interface GetApiTokensResponse {
  tokens: Array<{
    id: string;
    name: string;
    tokenPrefix: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
  }>;
}

export interface PostApiTokenRequest {
  name: string;
  expiresInDays?: number;
}

export interface PostApiTokenResponse {
  id: string;
  name: string;
  token: string; // Plaintext token shown once
  tokenPrefix: string;
  expiresAt: string | null;
}

export async function fetchApiTokens(): Promise<GetApiTokensResponse> {
  const response = await authFetch('/api/api-tokens');
  return handleResponse(response);
}

export async function generateApiToken(request: PostApiTokenRequest): Promise<PostApiTokenResponse> {
  const response = await authFetch('/api/api-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse(response);
}

export async function revokeApiToken(id: string): Promise<void> {
  const response = await authFetch(`/api/api-tokens/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    // Will throw with parsed error message
    await handleResponse(response);
  }
}

// === Iterations API (Shared contract) ===
export const ITERATION_STATUSES = ['planned', 'active', 'completed'] as const;
export type IterationStatus = typeof ITERATION_STATUSES[number];

export interface Iteration {
  id: string;
  name: string;
  teamId: string;
  startDate: string;
  endDate: string;
  goal: string;
  status: IterationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface GetIterationsResponse {
  iterations: Iteration[];
}

export interface GetIterationResponse {
  iteration: Iteration;
}

export interface CreateIterationRequest {
  name: string;
  teamId: string;
  startDate: string;
  endDate: string;
  goal: string;
}

export interface CreateIterationResponse {
  iteration: Iteration;
}

export interface UpdateIterationRequest {
  name?: string;
  teamId?: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
  status?: IterationStatus;
}

export interface UpdateIterationResponse {
  iteration: Iteration;
}

export interface ActivateIterationResponse {
  iteration: Iteration;
}

export interface CompleteIterationResponse {
  iteration: Iteration;
}

export interface DeleteIterationResponse {
  success: boolean;
}

export async function fetchIterations(teamId?: string, status?: string): Promise<GetIterationsResponse> {
  const params = new URLSearchParams();
  if (teamId) params.set('team_id', teamId);
  if (status) params.set('status', status);
  const query = params.toString();
  const response = await authFetch(`/api/iterations${query ? `?${query}` : ''}`);
  return handleResponse(response);
}

export async function fetchCurrentIteration(): Promise<GetIterationResponse> {
  const response = await authFetch('/api/iterations/current');
  return handleResponse(response);
}

export async function fetchIterationById(id: string): Promise<GetIterationResponse> {
  const response = await authFetch(`/api/iterations/${id}`);
  return handleResponse(response);
}

export async function createIteration(data: CreateIterationRequest): Promise<CreateIterationResponse> {
  const response = await authFetch('/api/iterations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateIteration(id: string, data: UpdateIterationRequest): Promise<UpdateIterationResponse> {
  const response = await authFetch(`/api/iterations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function activateIteration(id: string): Promise<ActivateIterationResponse> {
  const response = await authFetch(`/api/iterations/${id}/activate`, { method: 'PATCH' });
  return handleResponse(response);
}

export async function completeIteration(id: string): Promise<CompleteIterationResponse> {
  const response = await authFetch(`/api/iterations/${id}/complete`, { method: 'PATCH' });
  return handleResponse(response);
}

export async function deleteIteration(id: string): Promise<DeleteIterationResponse> {
  const response = await authFetch(`/api/iterations/${id}`, { method: 'DELETE' });
  return handleResponse(response);
}

// === Associations API ===
export interface Association {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationship: string;
  createdAt: string;
}

export async function getAssociations(entityType: string, entityId: string): Promise<Association[]> {
  const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId });
  const response = await authFetch(`/api/associations?${params}`);
  const data = await handleResponse(response);
  return (Array.isArray(data) ? data : data.associations ?? []) as Association[];
}

export async function createAssociation(data: {
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationship: string;
}): Promise<Association> {
  const response = await authFetch('/api/associations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const res = await handleResponse(response);
  return (res.association ?? res) as Association;
}

export async function deleteAssociation(id: string): Promise<void> {
  const response = await authFetch(`/api/associations/${id}`, { method: 'DELETE' });
  if (response.status === 204) return;
  await handleResponse(response);
}

// === Invitations API ===
export const INVITATION_ROLES = ['admin', 'member', 'viewer'] as const;

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface GetInvitationByTokenResponse {
  email: string;
  role: string;
  status: string;
  expiresAt: string | null;
}

export async function getInvitations(): Promise<{ invitations: Invitation[] }> {
  const response = await authFetch('/api/invitations');
  return handleResponse(response);
}

export async function createInvitation(data: { email: string; role: string }): Promise<Invitation> {
  const response = await authFetch('/api/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function revokeInvitation(id: string): Promise<void> {
  const response = await authFetch(`/api/invitations/${id}/revoke`, { method: 'PATCH' });
  await handleResponse(response);
}

export async function getInvitationByToken(token: string): Promise<GetInvitationByTokenResponse> {
  const response = await fetch(`/api/invitations/token/${token}`);
  return handleResponse(response);
}

export async function acceptInvitation(token: string, data: { username: string; password: string }): Promise<void> {
  const response = await fetch(`/api/invitations/token/${token}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await handleResponse(response);
}

// === Activity API ===
export async function getActivities(filters?: { limit?: number; offset?: number; entity_type?: string }): Promise<{ activities: any[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  if (filters?.entity_type) params.set('entity_type', filters.entity_type);
  const query = params.toString();
  const response = await authFetch(`/api/activities${query ? '?' + query : ''}`);
  return handleResponse(response);
}

// === My Week API ===
export interface MyWeekResponse {
  week?: { id: string; start_date: string; end_date: string; title: string };
  standup?: { id: string; standup_date: string; [key: string]: any };
  plan?: { id: string; plan_content: string; status: string; [key: string]: any };
  retro?: { id: string; went_well: string; to_improve: string; action_items: string; [key: string]: any };
}

export async function getMyWeek(weekId?: string): Promise<MyWeekResponse> {
  const params = weekId ? `?week_id=${weekId}` : '';
  const response = await authFetch(`/api/my-week${params}`);
  return handleResponse(response);
}

// === Profile API ===
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  phone: string;
  location: string;
  title: string;
  department: string;
  role: string;
  createdAt: string;
}

export async function getProfile(): Promise<UserProfile> {
  const response = await authFetch('/api/profile');
  return handleResponse(response);
}

export async function updateProfile(data: {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  phone?: string;
  location?: string;
}): Promise<UserProfile> {
  const response = await authFetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

// === Sprint Reviews API ===
export interface SprintReview {
  id: string;
  weekId: string;
  summary: string;
  accomplishments: string;
  challenges: string;
  nextSteps: string;
  teamRating: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function getSprintReviews(): Promise<SprintReview[]> {
  const response = await authFetch('/api/sprint-reviews');
  const data = await handleResponse(response);
  return (Array.isArray(data) ? data : data.reviews ?? []) as SprintReview[];
}

export async function createSprintReview(data: {
  weekId: string;
  summary: string;
  accomplishments?: string;
  challenges?: string;
  nextSteps?: string;
  teamRating?: number;
}): Promise<SprintReview> {
  const response = await authFetch('/api/sprint-reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function submitSprintReview(id: string): Promise<SprintReview> {
  const response = await authFetch(`/api/sprint-reviews/${id}/submit`, { method: 'PATCH' });
  return handleResponse(response);
}

export async function deleteSprintReview(id: string): Promise<void> {
  const response = await authFetch(`/api/sprint-reviews/${id}`, { method: 'DELETE' });
  if (response.status === 204) return;
  await handleResponse(response);
}

// === Status Overview API ===
export interface StatusOverview {
  projectCount: number;
  teamCount: number;
  activeUsersToday: number;
  pendingReviews: number;
  issuesByStatus: Record<string, number>;
  issuesByPriority: Record<string, number>;
}

export async function getStatusOverview(): Promise<StatusOverview> {
  const response = await authFetch('/api/status-overview');
  return handleResponse(response);
}
