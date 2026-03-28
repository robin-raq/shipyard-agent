import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDocuments, fetchDocument, createDocument, updateDocument, deleteDocument } from '../api/documents';
import * as AuthContext from '../context/AuthContext';

// Mock authFetch
vi.mock('../context/AuthContext', () => ({
  authFetch: vi.fn(),
}));

const mockDocument = {
  id: '1',
  title: 'Test Document',
  content: 'This is test content',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

const mockDocuments = [mockDocument];

describe('Documents API (with authFetch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchDocuments', () => {
    it('should fetch all documents using authFetch', async () => {
      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocuments,
      });

      const result = await fetchDocuments();

      expect(AuthContext.authFetch).toHaveBeenCalledWith('/api/docs');
      expect(result).toEqual(mockDocuments);
    });

    it('should handle filters', async () => {
      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocuments,
      });

      await fetchDocuments({ status: 'published', tag: 'important' });

      expect(AuthContext.authFetch).toHaveBeenCalledWith('/api/docs?status=published&tag=important');
    });

    it('should throw on error', async () => {
      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' }),
      });

      await expect(fetchDocuments()).rejects.toThrow('Server error');
    });
  });

  describe('fetchDocument', () => {
    it('should fetch a single document using authFetch', async () => {
      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      });

      const result = await fetchDocument('1');

      expect(AuthContext.authFetch).toHaveBeenCalledWith('/api/docs/1');
      expect(result).toEqual(mockDocument);
    });

    it('should throw on 404', async () => {
      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Document not found' }),
      });

      await expect(fetchDocument('999')).rejects.toThrow('Document not found');
    });
  });

  describe('createDocument', () => {
    it('should create a document using authFetch', async () => {
      const input = { title: 'New Doc', content: 'New content' };
      const created = { id: '2', ...input };

      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => created,
      });

      const result = await createDocument(input);

      expect(AuthContext.authFetch).toHaveBeenCalledWith(
        '/api/docs',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
      );
      expect(result).toEqual(created);
    });

    it('should throw on validation error', async () => {
      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Title is required' }),
      });

      await expect(createDocument({ title: '', content: 'test' })).rejects.toThrow('Title is required');
    });
  });

  describe('updateDocument', () => {
    it('should update a document using authFetch', async () => {
      const updates = { title: 'Updated' };
      const updated = { ...mockDocument, ...updates };

      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => updated,
      });

      const result = await updateDocument('1', updates);

      expect(AuthContext.authFetch).toHaveBeenCalledWith(
        '/api/docs/1',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
      );
      expect(result).toEqual(updated);
    });

    it('should throw on 404', async () => {
      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Document not found' }),
      });

      await expect(updateDocument('999', { title: 'test' })).rejects.toThrow('Document not found');
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document using authFetch', async () => {
      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Deleted' }),
      });

      const result = await deleteDocument('1');

      expect(AuthContext.authFetch).toHaveBeenCalledWith(
        '/api/docs/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toEqual({ message: 'Deleted' });
    });

    it('should throw on error', async () => {
      (AuthContext.authFetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Failed to delete' }),
      });

      await expect(deleteDocument('1')).rejects.toThrow('Failed to delete');
    });
  });
});
