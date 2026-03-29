import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAssociations,
  createAssociation,
  deleteAssociation,
  type Association,
} from '../api/client';

// Keep these in sync with the shared contract
const ENTITY_TYPES = ['issue', 'project', 'document', 'ship', 'program', 'team'] as const;
const RELATIONSHIP_TYPES = ['related', 'blocks', 'blocked_by', 'parent', 'child', 'implements', 'depends_on'] as const;

type EntityType = typeof ENTITY_TYPES[number] | string;

type RelationshipType = typeof RELATIONSHIP_TYPES[number] | string;

export interface AssociationsListProps {
  entityType: EntityType; // current entity type (singular contract value preferred)
  entityId: string; // current entity id
  className?: string;
  title?: string;
}

function normalizeEntityType(t: string): typeof ENTITY_TYPES[number] | string {
  const lower = t.toLowerCase();
  // Accept plural route names and map to contract values
  if (lower === 'docs' || lower === 'doc' || lower === 'documents') return 'document';
  if (lower === 'issues' || lower === 'issue') return 'issue';
  if (lower === 'projects' || lower === 'project') return 'project';
  if (lower === 'ships' || lower === 'ship') return 'ship';
  if (lower === 'programs' || lower === 'program') return 'program';
  if (lower === 'teams' || lower === 'team') return 'team';
  return lower as any;
}

export default function AssociationsList({ entityType, entityId, className = '', title = 'Associations' }: AssociationsListProps) {
  const normalizedType = useMemo(() => normalizeEntityType(entityType), [entityType]);

  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [targetType, setTargetType] = useState<typeof ENTITY_TYPES[number]>('issue');
  const [targetId, setTargetId] = useState('');
  const [relationship, setRelationship] = useState<typeof RELATIONSHIP_TYPES[number]>('related');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAssociations(String(normalizedType), entityId);
      setAssociations(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load associations');
    } finally {
      setLoading(false);
    }
  }, [normalizedType, entityId]);

  useEffect(() => {
    if (!entityId || !normalizedType) return;
    refresh();
  }, [entityId, normalizedType, refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this association?')) return;
    try {
      await deleteAssociation(id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove association');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetType || !targetId || !relationship) return;
    try {
      setSubmitting(true);
      setError(null);
      await createAssociation({
        sourceType: String(normalizedType),
        sourceId: entityId,
        targetType,
        targetId,
        relationship,
      });
      setTargetId('');
      setRelationship('related');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add association');
    } finally {
      setSubmitting(false);
    }
  };

  const renderAssociationLine = (assoc: Association) => {
    const isSource = assoc.sourceType?.toLowerCase() === String(normalizedType) && assoc.sourceId === entityId;
    const otherType = isSource ? assoc.targetType : assoc.sourceType;
    const otherId = isSource ? assoc.targetId : assoc.sourceId;
    const arrow = isSource ? '→' : '←';

    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="inline-flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-xs font-medium capitalize">
                {assoc.sourceType}
              </span>
              <span className="text-gray-500">{assoc.sourceId.slice(0, 8)}…</span>
            </span>
            <span className="text-gray-400">{arrow}</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold">
              {assoc.relationship}
            </span>
            <span className="text-gray-400">{arrow}</span>
            <span className="inline-flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-xs font-medium capitalize">
                {assoc.targetType}
              </span>
              <span className="text-gray-500">{assoc.targetId.slice(0, 8)}…</span>
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Created {new Date(assoc.createdAt).toLocaleString()}
          </div>
        </div>
        <div className="shrink-0">
          <button
            onClick={() => handleDelete(assoc.id)}
            className="text-red-700 hover:text-red-900 text-sm font-medium"
            aria-label={`Remove association ${assoc.id}`}
          >
            Remove
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className={`mt-8 ${className}`} aria-label={title}>
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {!loading && (
          <span className="text-sm text-gray-600">{associations.length} total</span>
        )}
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg" role="alert">
          {error}
        </div>
      )}

      {/* Add new association */}
      <form onSubmit={handleAdd} className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end" role="form" aria-label="Add association">
        <div>
          <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-1">
            Relationship
          </label>
          <select
            id="relationship"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as typeof RELATIONSHIP_TYPES[number])}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {RELATIONSHIP_TYPES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="target-type" className="block text-sm font-medium text-gray-700 mb-1">
            Target Type
          </label>
          <select
            id="target-type"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as typeof ENTITY_TYPES[number])}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 capitalize"
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="target-id" className="block text-sm font-medium text-gray-700 mb-1">
            Target ID
          </label>
          <input
            id="target-id"
            type="text"
            required
            placeholder="Target entity ID (UUID)"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
        </div>
        <div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {submitting ? 'Adding...' : 'Add Association'}
          </button>
        </div>
      </form>

      {/* List */}
      {loading ? (
        <div className="p-4 text-gray-700" role="status" aria-live="polite">Loading associations...</div>
      ) : associations.length === 0 ? (
        <div className="p-4 text-gray-600 bg-gray-50 border border-gray-200 rounded-lg">No associations yet.</div>
      ) : (
        <div className="space-y-2">
          {associations.map((a) => (
            <div key={a.id}>{renderAssociationLine(a)}</div>
          ))}
        </div>
      )}
    </section>
  );
}
