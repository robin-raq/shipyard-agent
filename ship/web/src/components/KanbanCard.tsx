import { useDraggable } from '@dnd-kit/core';
import type { KanbanIssue } from './KanbanBoard';

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
  critical: 'bg-red-100 text-red-700',
};

export default function KanbanCard({ issue }: { issue: KanbanIssue }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: issue.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg shadow-sm border p-3 cursor-grab active:cursor-grabbing"
    >
      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
        {issue.title}
      </p>
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
          PRIORITY_BADGE[issue.priority] || 'bg-gray-100 text-gray-700'
        }`}
      >
        {issue.priority}
      </span>
    </div>
  );
}
