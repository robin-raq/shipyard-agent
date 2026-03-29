import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardActionItems } from '../hooks/useDashboardActionItems';
import type { AccountabilityItem } from '../components/AccountabilityBanner';

// Mock data based on API contract
const mockActionItems: AccountabilityItem[] = [
  {
    id: 'item-1',
    title: 'Overdue Task 1',
    description: 'This task is overdue',
    due_date: '2024-01-15T10:00:00Z',
    status: 'overdue',
    priority: 'high',
    assignee: 'John Doe',
  },
  {
    id: 'item-2',
    title: 'Overdue Task 2',
    description: 'Another overdue task',
    due_date: '2024-01-20T14:30:00Z',
    status: 'overdue',
    priority: 'medium',
    assignee: 'Jane Smith',
  },
  {
    id: 'item-3',
    title: 'Critical Issue',
    description: 'Critical issue requiring attention',
    due_date: '2024-01-25T09:15:00Z',
    status: 'overdue',
    priority: 'critical',
    assignee: 'Bob Johnson',
  },
];

describe('useDashboardActionItems', () => {
  // Store original fetch
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should return initial state with empty actionItems, loading true, no error, and refetch function', () => {
      (global.fetch as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useDashboardActionItems());

      expect(result.current.actionItems).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe('function');
    });

    it('should have all required properties in return value', () => {
      (global.fetch as any).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useDashboardActionItems());

      expect(result.current).toHaveProperty('actionItems');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
    });
  });

  describe('Fetching Action Items', () => {
    it('should fetch action items on mount from /api/accountability', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overdue_items: mockActionItems }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual(mockActionItems);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith('/api/accountability');
    });

    it('should fetch from /api/dashboard/summary on mount', async () => {
      const mockSummaryResponse = {
        total_programs: 10,
        active_programs: 7,
        total_issues: 25,
        overdue_issues: 5,
        total_projects: 15,
        active_projects: 12,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSummaryResponse,
      });

      const { result } = renderHook(() => useDashboardActionItems());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify the fetch was called with the correct endpoint
      expect(global.fetch).toHaveBeenCalledWith('/api/dashboard/summary');
    });

    it('should handle response with "items" property instead of "overdue_items"', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockActionItems }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual(mockActionItems);
      expect(result.current.error).toBeNull();
    });

    it('should handle empty action items array', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overdue_items: [] }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should handle response with neither "overdue_items" nor "items"', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should set loading to false after successful fetch', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overdue_items: mockActionItems }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network error');
      (global.fetch as any).mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual([]);
      expect(result.current.error).toBe('Network error');
    });

    it('should handle non-ok response status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual([]);
      expect(result.current.error).toBeDefined();
    });

    it('should handle 404 not found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Accountability endpoint not found' }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual([]);
      expect(result.current.error).toBeDefined();
    });

    it('should handle 401 unauthorized', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Unauthorized access' }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual([]);
      expect(result.current.error).toBeDefined();
    });

    it('should handle JSON parse errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual([]);
      expect(result.current.error).toBe('Invalid JSON');
    });

    it('should set loading to false even when error occurs', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Fetch failed'));

      const { result } = renderHook(() => useDashboardActionItems());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Refetch Functionality', () => {
    it('should refetch action items when refetch is called', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ overdue_items: [mockActionItems[0]] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ overdue_items: mockActionItems }),
        });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual([mockActionItems[0]]);

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.actionItems).toEqual(mockActionItems);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should set loading to true during refetch', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ overdue_items: mockActionItems }),
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    json: async () => ({ overdue_items: mockActionItems }),
                  }),
                100
              )
            )
        );

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.refetch();
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should clear previous error on successful refetch', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Initial error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ overdue_items: mockActionItems }),
        });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.error).toBe('Initial error');
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.actionItems).toEqual(mockActionItems);
    });

    it('should handle errors during refetch', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ overdue_items: mockActionItems }),
        })
        .mockRejectedValueOnce(new Error('Refetch failed'));

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual(mockActionItems);

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBe('Refetch failed');
      expect(result.current.actionItems).toEqual([]);
    });

    it('should be callable multiple times', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ overdue_items: mockActionItems }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refetch();
      });

      await act(async () => {
        await result.current.refetch();
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(global.fetch).toHaveBeenCalledTimes(4); // Initial + 3 refetches
    });
  });

  describe('Data Transformation', () => {
    it('should preserve action item structure', async () => {
      const singleItem = mockActionItems[0];
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overdue_items: [singleItem] }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems[0]).toEqual(singleItem);
      expect(result.current.actionItems[0].id).toBe(singleItem.id);
      expect(result.current.actionItems[0].title).toBe(singleItem.title);
      expect(result.current.actionItems[0].description).toBe(singleItem.description);
      expect(result.current.actionItems[0].due_date).toBe(singleItem.due_date);
      expect(result.current.actionItems[0].status).toBe(singleItem.status);
      expect(result.current.actionItems[0].priority).toBe(singleItem.priority);
      expect(result.current.actionItems[0].assignee).toBe(singleItem.assignee);
    });

    it('should handle action items with missing optional fields', async () => {
      const minimalItem: AccountabilityItem = {
        id: 'minimal-1',
        title: 'Minimal Task',
        due_date: '2024-01-15T10:00:00Z',
        status: 'overdue',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overdue_items: [minimalItem] }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems[0]).toEqual(minimalItem);
    });

    it('should maintain order of action items from API', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overdue_items: mockActionItems }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems[0].id).toBe('item-1');
      expect(result.current.actionItems[1].id).toBe('item-2');
      expect(result.current.actionItems[2].id).toBe('item-3');
    });
  });

  describe('Authentication Integration', () => {
    it('should use authFetch for API calls', async () => {
      // Mock localStorage for session token
      const mockToken = 'test-session-token';
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      getItemSpy.mockReturnValue(mockToken);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overdue_items: mockActionItems }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify fetch was called (authFetch should be used internally)
      expect(global.fetch).toHaveBeenCalledWith('/api/accountability');

      getItemSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual([]);
    });

    it('should handle undefined response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => undefined,
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toEqual([]);
    });

    it('should handle very large arrays of action items', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
        title: `Task ${i}`,
        due_date: '2024-01-15T10:00:00Z',
        status: 'overdue' as const,
      }));

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overdue_items: largeArray }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.actionItems).toHaveLength(1000);
    });

    it('should handle concurrent refetch calls', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ overdue_items: mockActionItems }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Call refetch multiple times without awaiting
      act(() => {
        result.current.refetch();
        result.current.refetch();
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should still have valid data
      expect(result.current.actionItems).toEqual(mockActionItems);
    });
  });

  describe('Memory and Cleanup', () => {
    it('should not update state after unmount', async () => {
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ overdue_items: mockActionItems }),
                }),
              100
            )
          )
      );

      const { result, unmount } = renderHook(() => useDashboardActionItems());

      expect(result.current.loading).toBe(true);

      // Unmount before fetch completes
      unmount();

      // Wait for fetch to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // No error should be thrown (component should handle cleanup)
    });
  });

  describe('Type Safety', () => {
    it('should return correctly typed actionItems array', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overdue_items: mockActionItems }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // TypeScript should infer correct types
      const items: AccountabilityItem[] = result.current.actionItems;
      expect(Array.isArray(items)).toBe(true);
    });

    it('should return correctly typed error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Test error'));

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // TypeScript should infer error as string | null
      const error: string | null = result.current.error;
      expect(typeof error).toBe('string');
    });

    it('should return correctly typed loading', async () => {
      (global.fetch as any).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useDashboardActionItems());

      // TypeScript should infer loading as boolean
      const loading: boolean = result.current.loading;
      expect(typeof loading).toBe('boolean');
    });

    it('should return correctly typed refetch function', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overdue_items: mockActionItems }),
      });

      const { result } = renderHook(() => useDashboardActionItems());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // TypeScript should infer refetch as a function
      const refetch: () => Promise<void> = result.current.refetch;
      expect(typeof refetch).toBe('function');
    });
  });
});
