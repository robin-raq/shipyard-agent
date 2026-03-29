import React, { useEffect, useMemo, useState } from 'react';

// Shared contract (local copy)
interface User {
  id: string;
  username: string;
  email: string;
  title: string;
  department: string;
  reportsTo: string | null;
}

interface UserNode extends User {
  children?: UserNode[];
}

interface OrgChartResponse {
  tree: UserNode[];
  departments: string[];
}

type ViewMode = 'tree' | 'list';

type TreeNodeProps = {
  node: UserNode;
  depth?: number;
};

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function TreeNode({ node, depth = 0 }: TreeNodeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  return (
    <div className={classNames('pl-3 border-l border-gray-200', depth === 0 && 'border-none pl-0')}>
      <div className="flex items-start gap-3 py-2">
        <div className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
          {node.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">{node.username}</div>
          <div className="text-xs text-gray-600">{node.title || '—'}</div>
          <div className="text-xs text-gray-500">{node.department || '—'}</div>
        </div>
      </div>
      {hasChildren && (
        <div className="ml-4">
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const [view, setView] = useState<ViewMode>('tree');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<UserNode[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/org-chart', { credentials: 'include' });
        if (!res.ok) throw new Error(`Failed to fetch org chart (${res.status})`);
        const json = (await res.json()) as OrgChartResponse;
        if (!cancelled) {
          setTree(Array.isArray(json?.tree) ? json.tree : []);
          setDepartments(Array.isArray(json?.departments) ? json.departments : []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load org chart');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const flatList = useMemo(() => {
    const list: UserNode[] = [];
    function walk(nodes: UserNode[]) {
      for (const n of nodes) {
        list.push(n);
        if (n.children && n.children.length) walk(n.children);
      }
    }
    walk(tree);
    return list;
  }, [tree]);

  const usersById = useMemo(() => {
    const m = new Map<string, UserNode>();
    for (const u of flatList) m.set(u.id, u);
    return m;
  }, [flatList]);

  const filteredList = useMemo(() => {
    if (!deptFilter) return flatList;
    return flatList.filter((u) => (u.department || '') === deptFilter);
  }, [flatList, deptFilter]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Org Chart</h1>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => setView('tree')}
              className={classNames(
                'px-3 py-1.5 text-sm border border-gray-300 first:rounded-l-md last:rounded-r-none',
                view === 'tree' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              Tree
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={classNames(
                'px-3 py-1.5 text-sm border border-gray-300 -ml-px last:rounded-r-md',
                view === 'list' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              List
            </button>
          </div>
          <div className="hidden sm:block">
            <button
              type="button"
              onClick={() => {
                // manual refresh
                setLoading(true);
                setError(null);
                fetch('/api/org-chart', { credentials: 'include' })
                  .then((r) => {
                    if (!r.ok) throw new Error(`Failed to fetch org chart (${r.status})`);
                    return r.json();
                  })
                  .then((json: OrgChartResponse) => {
                    setTree(Array.isArray(json?.tree) ? json.tree : []);
                    setDepartments(Array.isArray(json?.departments) ? json.departments : []);
                  })
                  .catch((e) => setError(e?.message || 'Failed to load org chart'))
                  .finally(() => setLoading(false));
              }}
              className="text-sm text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {view === 'list' && (
        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-gray-600">
            Department
            <select
              className="ml-2 rounded border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Content */}
      <div className="mt-6">
        {loading && <div className="text-gray-600 text-sm">Loading...</div>}
        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}
        {!loading && !error && (
          <>
            {view === 'tree' ? (
              <div className="space-y-2">
                {tree.length === 0 && (
                  <div className="text-sm text-gray-600">No data</div>
                )}
                {tree.map((root) => (
                  <TreeNode key={root.id} node={root} />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredList.map((u) => {
                      const manager = u.reportsTo ? usersById.get(u.reportsTo) : null;
                      return (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">{u.username}</div>
                                <div className="text-xs text-gray-500">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700">{u.title || '—'}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{u.department || '—'}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{manager?.username || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
