import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../context/AuthContext';

export type ActionItem = {
  id: string;
  title: string;
  dueDate: string;
  status: string;
};

export function useDashboardActionItems() {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActionItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/dashboard/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard summary');
      }
      const data = await response.json();
      const items = data.summary.myWork.map((item: any) => ({
        id: item.id,
        title: item.title,
        dueDate: item.dueDate,
        status: item.status,
      }));
      setActionItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActionItems();
  }, [fetchActionItems]);

  return { actionItems, loading, error, refetch: fetchActionItems };
}
