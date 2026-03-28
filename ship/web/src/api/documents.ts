import { authFetch } from '../context/AuthContext';

/**
 * Handle API response - check if ok, parse JSON, or throw error
 */
async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch all documents with optional filters
 */
export async function fetchDocuments(filters?: { status?: string; tag?: string }) {
  let url = '/api/docs';
  if (filters) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.tag) params.append('tag', filters.tag);
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
  }
  const response = await authFetch(url);
  return handleResponse(response);
}

/**
 * Fetch a single document by ID
 */
export async function fetchDocument(id: string) {
  const response = await authFetch(`/api/docs/${id}`);
  return handleResponse(response);
}

/**
 * Create a new document
 */
export async function createDocument(input: { title: string; content: string }) {
  const response = await authFetch('/api/docs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return handleResponse(response);
}

/**
 * Update an existing document
 */
export async function updateDocument(id: string, input: { title?: string; content?: string }) {
  const response = await authFetch(`/api/docs/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  return handleResponse(response);
}

/**
 * Delete a document by ID
 */
export async function deleteDocument(id: string) {
  const response = await authFetch(`/api/docs/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}
