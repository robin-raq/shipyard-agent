import { useDroppable } from '@dnd-kit/core';
import KanbanCard from './KanbanCard';
import type { KanbanIssue } from './KanbanBoard';

interface KanbanColumnProps {
  id: string;
  title: string;
  issues: KanbanIssue[];
  count: number;
}

export default function KanbanColumn({ id, title, issues, count }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] bg-gray-50 rounded-lg p-3 flex-shrink-0 flex flex-col ${
        isOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 text-xs font-medium">
          {count}
        </span>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto">
        {issues.map((issue) => (
          <KanbanCard key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
}
