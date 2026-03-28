import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocs, getDoc, createDoc, updateDoc, deleteDoc } from '../api/client';

// Mock data
const mockDocument = {
  id: '1',
  title: 'Test Document',
  content: 'This is test content',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

const mockDocuments = [
  mockDocument,
  {
    id: '2',
    title: 'Second Document',
    content: 'More test content',
    created_at: '2024-01-16T10:00:00Z',
    updated_at: '2024-01-16T10:00:00Z',
  },
  {
    id: '3',
    title: 'Third Document',
    content: 'Even more content',
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-17T10:00:00Z',
  },
];

describe('Documents API', () => {
  beforeEach(() => {
    // Mock global.fetch before each test
    global.fetch = vi.fn();
  });

  describe('fetchDocuments (getDocs)', () => {
    it('should fetch all documents successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocuments,
      });

      const result = await getDocs();

      expect(global.fetch).toHaveBeenCalledWith('/api/docs');
      expect(result).toEqual(mockDocuments);
    });

    it('should handle fetch errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' }),
      });

      await expect(getDocs()).rejects.toThrow('Server error');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(getDocs()).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(getDocs()).rejects.toThrow('Request failed');
    });
  });

  describe('fetchDocument (getDoc)', () => {
    it('should fetch a single document by id', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      });

      const result = await getDoc('1');

      expect(global.fetch).toHaveBeenCalledWith('/api/docs/1');
      expect(result).toEqual(mockDocument);
    });

    it('should handle 404 when document not found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Document not found' }),
      });

      await expect(getDoc('999')).rejects.toThrow('Document not found');
    });

    it('should handle invalid document id', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid document ID' }),
      });

      await expect(getDoc('invalid')).rejects.toThrow('Invalid document ID');
    });
  });

  describe('createDocument (createDoc)', () => {
    it('should create a new document successfully', async () => {
      const newDocument = {
        title: 'New Document',
        content: 'New content',
      };

      const createdDocument = {
        id: '4',
        ...newDocument,
        created_at: '2024-01-18T10:00:00Z',
        updated_at: '2024-01-18T10:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createdDocument,
      });

      const result = await createDoc(newDocument);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/docs',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newDocument),
        })
      );
      expect(result).toEqual(createdDocument);
    });

    it('should handle validation errors (missing title)', async () => {
      const invalidDocument = {
        title: '',
        content: 'Content without title',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Title is required' }),
      });

      await expect(createDoc(invalidDocument)).rejects.toThrow('Title is required');
    });

    it('should handle validation errors (missing content)', async () => {
      const invalidDocument = {
        title: 'Title without content',
        content: '',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Content is required' }),
      });

      await expect(createDoc(invalidDocument)).rejects.toThrow('Content is required');
    });

    it('should handle server errors during creation', async () => {
      const newDocument = {
        title: 'New Document',
        content: 'New content',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Failed to create document' }),
      });

      await expect(createDoc(newDocument)).rejects.toThrow('Failed to create document');
    });
  });

  describe('updateDocument (updateDoc)', () => {
    it('should update a document successfully', async () => {
      const updates = {
        title: 'Updated Title',
        content: 'Updated content',
      };

      const updatedDocument = {
        ...mockDocument,
        ...updates,
        updated_at: '2024-01-19T10:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedDocument,
      });

      const result = await updateDoc('1', updates);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/docs/1',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        })
      );
      expect(result).toEqual(updatedDocument);
    });

    it('should support partial updates (title only)', async () => {
      const updates = {
        title: 'Only Title Updated',
      };

      const updatedDocument = {
        ...mockDocument,
        ...updates,
        updated_at: '2024-01-19T10:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedDocument,
      });

      const result = await updateDoc('1', updates);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/docs/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates),
        })
      );
      expect(result).toEqual(updatedDocument);
    });

    it('should support partial updates (content only)', async () => {
      const updates = {
        content: 'Only Content Updated',
      };

      const updatedDocument = {
        ...mockDocument,
        ...updates,
        updated_at: '2024-01-19T10:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedDocument,
      });

      const result = await updateDoc('1', updates);

      expect(result).toEqual(updatedDocument);
    });

    it('should handle 404 when updating non-existent document', async () => {
      const updates = {
        title: 'Updated Title',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Document not found' }),
      });

      await expect(updateDoc('999', updates)).rejects.toThrow('Document not found');
    });

    it('should handle validation errors during update', async () => {
      const updates = {
        title: '',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Title cannot be empty' }),
      });

      await expect(updateDoc('1', updates)).rejects.toThrow('Title cannot be empty');
    });
  });

  describe('deleteDocument (deleteDoc)', () => {
    it('should delete a document successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Document deleted successfully' }),
      });

      const result = await deleteDoc('1');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/docs/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toEqual({ message: 'Document deleted successfully' });
    });

    it('should handle 404 when deleting non-existent document', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Document not found' }),
      });

      await expect(deleteDoc('999')).rejects.toThrow('Document not found');
    });

    it('should handle server errors during deletion', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Failed to delete document' }),
      });

      await expect(deleteDoc('1')).rejects.toThrow('Failed to delete document');
    });

    it('should handle network errors during deletion', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(deleteDoc('1')).rejects.toThrow('Network error');
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP error without JSON body', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => {
          throw new Error('No JSON body');
        },
      });

      await expect(getDocs()).rejects.toThrow('Request failed');
    });

    it('should use HTTP status text when no error message provided', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({}),
      });

      await expect(getDocs()).rejects.toThrow('HTTP 401: Unauthorized');
    });

    it('should handle empty error response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => null,
      });

      // When json() returns null, accessing .message throws an error
      await expect(getDocs()).rejects.toThrow();
    });
  });

  describe('Request Headers', () => {
    it('should include Content-Type header for POST requests', async () => {
      const newDocument = {
        title: 'Test',
        content: 'Test content',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', ...newDocument }),
      });

      await createDoc(newDocument);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/docs',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should include Content-Type header for PUT requests', async () => {
      const updates = {
        title: 'Updated',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockDocument, ...updates }),
      });

      await updateDoc('1', updates);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/docs/1',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('Response Parsing', () => {
    it('should correctly parse JSON response for getDocs', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocuments,
      });

      const result = await getDocs();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('content');
    });

    it('should correctly parse JSON response for getDoc', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocument,
      });

      const result = await getDoc('1');

      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('title', 'Test Document');
      expect(result).toHaveProperty('content', 'This is test content');
    });

    it('should correctly parse JSON response for createDoc', async () => {
      const newDocument = {
        title: 'New',
        content: 'Content',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '4', ...newDocument }),
      });

      const result = await createDoc(newDocument);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title', 'New');
      expect(result).toHaveProperty('content', 'Content');
    });
  });
});
