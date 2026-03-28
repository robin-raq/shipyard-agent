import { useState } from 'react';
import { useDashboardActionItems } from '../hooks/useDashboardActionItems';
import AccountabilityBanner from '../components/AccountabilityBanner';
import type { AccountabilityItem } from '../components/AccountabilityBanner';

interface DashboardSummary {
  total_programs?: number;
  active_programs?: number;
  total_issues?: number;
  overdue_issues?: number;
  total_projects?: number;
  active_projects?: number;
}

interface Program {
  id: number;
  name: string;
  description: string;
  status?: string;
  created_at: string;
  updated_at: string;
}

interface ProgramsResponse {
  programs: Program[];
  total: number;
}

interface AccountabilityResponse {
  overdue_items?: AccountabilityItem[];
  items?: AccountabilityItem[];
}

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const { actionItems: overdueItems, loading, error } = useDashboardActionItems();

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      
      {/* Accountability Banner */}
      {overdueItems.length > 0 && (
        <AccountabilityBanner
          items={overdueItems.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
            due_date: item.dueDate,
          }))}
        />
      )}
      
      <div className="space-y-6">
        {/* Programs Overview Section */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Programs Overview</h2>
          <div className="bg-white p-4 rounded-lg shadow">
            {/* Program Count */}
            <div className="mb-4">
              <div className="text-2xl font-bold text-gray-900">
                {summary?.total_programs ?? 0}
              </div>
              <div className="text-sm text-gray-600">Total Programs</div>
            </div>

            {/* Active Programs List */}
            {programs.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Programs</h3>
                <ul className="space-y-2">
                  {programs.map((program) => (
                    <li
                      key={program.id}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{program.name}</div>
                        {program.description && (
                          <div className="text-sm text-gray-600 truncate">{program.description}</div>
                        )}
                      </div>
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        active
                      </span>
                    </li>
                  ))}
                </ul>
                {(summary?.total_programs ?? 0) > 5 && (
                  <div className="mt-3 text-sm text-blue-600 hover:text-blue-800">
                    <a href="/programs">View All Programs →</a>
                  </div>
                )}
              </div>
            )}

            {programs.length === 0 && (
              <p className="text-gray-600 text-sm">No active programs found.</p>
            )}
          </div>
        </section>

        {/* Accountability Section */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Accountability</h2>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {summary?.total_issues ?? 0}
                </div>
                <div className="text-sm text-gray-600">Total Issues</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {summary?.overdue_issues ?? 0}
                </div>
                <div className="text-sm text-gray-600">Overdue Issues</div>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Activity Section */}
        <section>
          <h2 className="text-xl font-semibold mb-3">Recent Activity</h2>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-600">Recent activity feed will be displayed here.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
