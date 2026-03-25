const BASE_URL = '/api/documents';

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function getDocuments(type?: string) {
  const url = type ? `${BASE_URL}?type=${encodeURIComponent(type)}` : BASE_URL;
  const response = await fetch(url);
  return handleResponse(response);
}

export async function getDocument(id: string) {
  const response = await fetch(`${BASE_URL}/${id}`);
  return handleResponse(response);
}

export async function createDocument(data: { title: string; content: string; type: string }) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function updateDocument(id: string, data: { title?: string; content?: string }) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteDocument(id: string) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}
