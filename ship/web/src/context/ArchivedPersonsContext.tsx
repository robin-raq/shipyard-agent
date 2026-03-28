import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { authFetch } from './AuthContext';

interface ArchivedPerson {
  id: string;
  name: string;
  email: string;
  archivedAt: string;
  archivedBy: string;
}

interface ArchivedPersonsContextType {
  archivedPersons: ArchivedPerson[];
  filteredArchivedPersons: ArchivedPerson[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  unarchivePerson: (id: string) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const ArchivedPersonsContext = createContext<ArchivedPersonsContextType | null>(null);

export function useArchivedPersons() {
  const ctx = useContext(ArchivedPersonsContext);
  if (!ctx) throw new Error('useArchivedPersons must be used within ArchivedPersonsProvider');
  return ctx;
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export function ArchivedPersonsProvider({ children }: { children: ReactNode }) {
  const [archivedPersons, setArchivedPersons] = useState<ArchivedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchArchivedPersons = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authFetch('/api/persons/archived');
      const data = await handleResponse(response);
      setArchivedPersons(data.archivedPersons || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch archived persons';
      setError(errorMessage);
      setArchivedPersons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedPersons();
  }, []);

  const unarchivePerson = async (id: string) => {
    try {
      const response = await authFetch(`/api/persons/${id}/unarchive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      await handleResponse(response);
      
      // Remove the unarchived person from the list
      setArchivedPersons((prev) => prev.filter((person) => person.id !== id));
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unarchive person';
      setError(errorMessage);
      throw err;
    }
  };

  const deletePerson = async (id: string) => {
    try {
      const response = await authFetch(`/api/persons/${id}`, {
        method: 'DELETE',
      });
      await handleResponse(response);
      
      // Remove the deleted person from the list
      setArchivedPersons((prev) => prev.filter((person) => person.id !== id));
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete person';
      setError(errorMessage);
      throw err;
    }
  };

  const refresh = async () => {
    await fetchArchivedPersons();
  };

  // Memoized filtered list based on search term
  const filteredArchivedPersons = useMemo(() => {
    if (!searchTerm.trim()) {
      return archivedPersons;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return archivedPersons.filter(
      (person) =>
        person.name.toLowerCase().includes(lowerSearchTerm) ||
        person.email.toLowerCase().includes(lowerSearchTerm)
    );
  }, [archivedPersons, searchTerm]);

  return (
    <ArchivedPersonsContext.Provider
      value={{
        archivedPersons,
        filteredArchivedPersons,
        loading,
        error,
        searchTerm,
        setSearchTerm,
        unarchivePerson,
        deletePerson,
        refresh,
      }}
    >
      {children}
    </ArchivedPersonsContext.Provider>
  );
}
