import { useMemo } from 'react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';

export interface KanbanIssue {
  id: string;
  title: string;
  content: string;
  status: string;
  priority: string;
  assignee_id?: string;
}

interface KanbanBoardProps {
  issues: KanbanIssue[];
  onStatusChange: (id: string, newStatus: string) => Promise<void>;
}

const KANBAN_COLUMNS = [
  { id: 'triage', label: 'Triage' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'done', label: 'Done' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function KanbanBoard({ issues, onStatusChange }: KanbanBoardProps) {
  const groupedIssues = useMemo(() => {
    const groups: Record<string, KanbanIssue[]> = {};
    for (const col of KANBAN_COLUMNS) {
      groups[col.id] = [];
    }
    for (const issue of issues) {
      if (groups[issue.status]) {
        groups[issue.status].push(issue);
      } else {
        // Unknown status goes to triage
        groups['triage'].push(issue);
      }
    }
    return groups;
  }, [issues]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const issueId = String(active.id);
    const newStatus = String(over.id);

    // Find current status
    const currentIssue = issues.find((i) => i.id === issueId);
    if (currentIssue && currentIssue.status !== newStatus) {
      onStatusChange(issueId, newStatus);
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex overflow-x-auto gap-4 p-4 h-[calc(100vh-280px)]">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.label}
            issues={groupedIssues[col.id]}
            count={groupedIssues[col.id].length}
          />
        ))}
      </div>
    </DndContext>
  );
}
