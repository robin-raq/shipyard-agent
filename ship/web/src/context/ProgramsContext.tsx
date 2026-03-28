import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { authFetch } from './AuthContext';

// Data Models
interface Program {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface ProgramAssociation {
  id: number;
  program_id: number;
  user_id: number;
  role: 'admin' | 'member';
}

interface Issue {
  id: string;
  title: string;
  content?: string;
  status?: string;
  priority?: string;
  project_id?: string;
  program_id?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

interface Project {
  id: string;
  title: string;
  description?: string;
  status?: string;
  program_id?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

// Context Type
interface ProgramsContextType {
  programs: Program[];
  filteredPrograms: Program[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  total: number;
  setSearchTerm: (term: string) => void;
  fetchPrograms: (params?: { search?: string; limit?: number; offset?: number }) => Promise<void>;
  fetchProgram: (id: number) => Promise<Program>;
  createProgram: (data: { name: string; description?: string }) => Promise<Program>;
  updateProgram: (id: number, data: { name?: string; description?: string }) => Promise<Program>;
  deleteProgram: (id: number) => Promise<void>;
  fetchProgramAssociations: (programId: number) => Promise<ProgramAssociation[]>;
  createProgramAssociation: (programId: number, data: { user_id: number; role: 'admin' | 'member' }) => Promise<ProgramAssociation>;
  updateProgramAssociation: (programId: number, associationId: number, data: { role: 'admin' | 'member' }) => Promise<ProgramAssociation>;
  deleteProgramAssociation: (programId: number, associationId: number) => Promise<void>;
  fetchProgramIssues: (programId: number, params?: { status?: string; priority?: string }) => Promise<Issue[]>;
  createProgramIssue: (programId: number, data: { title: string; content?: string; status?: string; priority?: string; project_id?: string }) => Promise<Issue>;
  updateProgramIssue: (programId: number, issueId: string, data: { title?: string; content?: string; status?: string; priority?: string }) => Promise<Issue>;
  deleteProgramIssue: (programId: number, issueId: string) => Promise<Issue>;
  fetchProgramProjects: (programId: number, params?: { status?: string }) => Promise<Project[]>;
  createProgramProject: (programId: number, data: { title: string; description?: string; status?: string }) => Promise<Project>;
  updateProgramProject: (programId: number, projectId: string, data: { title?: string; description?: string; status?: string }) => Promise<Project>;
  deleteProgramProject: (programId: number, projectId: string) => Promise<Project>;
  refresh: () => Promise<void>;
}

const ProgramsContext = createContext<ProgramsContextType | null>(null);

export function usePrograms() {
  const ctx = useContext(ProgramsContext);
  if (!ctx) throw new Error('usePrograms must be used within ProgramsProvider');
  return ctx;
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export function ProgramsProvider({ children }: { children: ReactNode }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [total, setTotal] = useState(0);

  const fetchPrograms = async (params?: { search?: string; limit?: number; offset?: number }) => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.set('search', params.search);
      if (params?.limit !== undefined) queryParams.set('limit', params.limit.toString());
      if (params?.offset !== undefined) queryParams.set('offset', params.offset.toString());
      
      const url = `/api/programs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await authFetch(url);
      const data = await handleResponse(response);
      
      setPrograms(data.programs || []);
      setTotal(data.total || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch programs';
      setError(errorMessage);
      setPrograms([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchProgram = async (id: number): Promise<Program> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${id}`);
      const program = await handleResponse(response);
      return program;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch program';
      setError(errorMessage);
      throw err;
    }
  };

  const createProgram = async (data: { name: string; description?: string }): Promise<Program> => {
    try {
      setError(null);
      const response = await authFetch('/api/programs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const program = await handleResponse(response);
      
      // Add the new program to the list
      setPrograms((prev) => [program, ...prev]);
      setTotal((prev) => prev + 1);
      
      return program;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create program';
      setError(errorMessage);
      throw err;
    }
  };

  const updateProgram = async (id: number, data: { name?: string; description?: string }): Promise<Program> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const updatedProgram = await handleResponse(response);
      
      // Update the program in the list
      setPrograms((prev) =>
        prev.map((program) => (program.id === id ? updatedProgram : program))
      );
      
      return updatedProgram;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update program';
      setError(errorMessage);
      throw err;
    }
  };

  const deleteProgram = async (id: number): Promise<void> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${id}`, {
        method: 'DELETE',
      });
      await handleResponse(response);
      
      // Remove the deleted program from the list
      setPrograms((prev) => prev.filter((program) => program.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete program';
      setError(errorMessage);
      throw err;
    }
  };

  const fetchProgramAssociations = async (programId: number): Promise<ProgramAssociation[]> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${programId}/associations`);
      const associations = await handleResponse(response);
      return associations;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch program associations';
      setError(errorMessage);
      throw err;
    }
  };

  const createProgramAssociation = async (
    programId: number,
    data: { user_id: number; role: 'admin' | 'member' }
  ): Promise<ProgramAssociation> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${programId}/associations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const association = await handleResponse(response);
      return association;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create program association';
      setError(errorMessage);
      throw err;
    }
  };

  const updateProgramAssociation = async (
    programId: number,
    associationId: number,
    data: { role: 'admin' | 'member' }
  ): Promise<ProgramAssociation> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${programId}/associations/${associationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const association = await handleResponse(response);
      return association;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update program association';
      setError(errorMessage);
      throw err;
    }
  };

  const deleteProgramAssociation = async (programId: number, associationId: number): Promise<void> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${programId}/associations/${associationId}`, {
        method: 'DELETE',
      });
      await handleResponse(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete program association';
      setError(errorMessage);
      throw err;
    }
  };

  const fetchProgramIssues = async (
    programId: number,
    params?: { status?: string; priority?: string }
  ): Promise<Issue[]> => {
    try {
      setError(null);
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.set('status', params.status);
      if (params?.priority) queryParams.set('priority', params.priority);
      
      const url = `/api/programs/${programId}/issues${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await authFetch(url);
      const issues = await handleResponse(response);
      return issues;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch program issues';
      setError(errorMessage);
      throw err;
    }
  };

  const createProgramIssue = async (
    programId: number,
    data: { title: string; content?: string; status?: string; priority?: string; project_id?: string }
  ): Promise<Issue> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${programId}/issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const issue = await handleResponse(response);
      return issue;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create program issue';
      setError(errorMessage);
      throw err;
    }
  };

  const updateProgramIssue = async (
    programId: number,
    issueId: string,
    data: { title?: string; content?: string; status?: string; priority?: string }
  ): Promise<Issue> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${programId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const issue = await handleResponse(response);
      return issue;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update program issue';
      setError(errorMessage);
      throw err;
    }
  };

  const deleteProgramIssue = async (programId: number, issueId: string): Promise<Issue> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${programId}/issues/${issueId}`, {
        method: 'DELETE',
      });
      const issue = await handleResponse(response);
      return issue;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete program issue';
      setError(errorMessage);
      throw err;
    }
  };

  const fetchProgramProjects = async (
    programId: number,
    params?: { status?: string }
  ): Promise<Project[]> => {
    try {
      setError(null);
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.set('status', params.status);
      
      const url = `/api/programs/${programId}/projects${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await authFetch(url);
      const projects = await handleResponse(response);
      return projects;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch program projects';
      setError(errorMessage);
      throw err;
    }
  };

  const createProgramProject = async (
    programId: number,
    data: { title: string; description?: string; status?: string }
  ): Promise<Project> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${programId}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const project = await handleResponse(response);
      return project;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create program project';
      setError(errorMessage);
      throw err;
    }
  };

  const updateProgramProject = async (
    programId: number,
    projectId: string,
    data: { title?: string; description?: string; status?: string }
  ): Promise<Project> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${programId}/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const project = await handleResponse(response);
      return project;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update program project';
      setError(errorMessage);
      throw err;
    }
  };

  const deleteProgramProject = async (programId: number, projectId: string): Promise<Project> => {
    try {
      setError(null);
      const response = await authFetch(`/api/programs/${programId}/projects/${projectId}`, {
        method: 'DELETE',
      });
      const project = await handleResponse(response);
      return project;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete program project';
      setError(errorMessage);
      throw err;
    }
  };

  const refresh = async () => {
    await fetchPrograms();
  };

  // Memoized filtered list based on search term
  const filteredPrograms = useMemo(() => {
    if (!searchTerm.trim()) {
      return programs;
    }
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return programs.filter(
      (program) =>
        program.name.toLowerCase().includes(lowerSearchTerm) ||
        program.description.toLowerCase().includes(lowerSearchTerm)
    );
  }, [programs, searchTerm]);

  return (
    <ProgramsContext.Provider
      value={{
        programs,
        filteredPrograms,
        loading,
        error,
        searchTerm,
        total,
        setSearchTerm,
        fetchPrograms,
        fetchProgram,
        createProgram,
        updateProgram,
        deleteProgram,
        fetchProgramAssociations,
        createProgramAssociation,
        updateProgramAssociation,
        deleteProgramAssociation,
        fetchProgramIssues,
        createProgramIssue,
        updateProgramIssue,
        deleteProgramIssue,
        fetchProgramProjects,
        createProgramProject,
        updateProgramProject,
        deleteProgramProject,
        refresh,
      }}
    >
      {children}
    </ProgramsContext.Provider>
  );
}
