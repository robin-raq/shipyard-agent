import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../context/AuthContext';

// Shared contract types (frontend view)
export interface Attachment {
  id: string;
  entityType: 'issue' | 'project' | 'document' | string;
  entityId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  deletedAt: string | null;
}

interface AttachmentListProps {
  entityType: 'issue' | 'project' | 'document';
  entityId: string;
  className?: string;
  readOnly?: boolean;
  onChange?: (attachments: Attachment[]) => void;
}

function humanFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const thresh = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let u = 0;
  let b = bytes;
  while (b >= thresh && u < units.length - 1) {
    b /= thresh;
    u++;
  }
  return `${b.toFixed(b < 10 && u > 0 ? 1 : 0)} ${units[u]}`;
}

function iconForMime(mime: string) {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎞️';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime === 'application/pdf') return '📄';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️';
  if (mime.startsWith('text/')) return '📝';
  return '📎';
}

export default function AttachmentList({ entityType, entityId, className = '', readOnly = false, onChange }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canManage = useMemo(() => !readOnly, [readOnly]);

  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ entity_type: entityType, entity_id: entityId });
      const res = await authFetch(`/api/attachments?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to fetch attachments' }));
        throw new Error(err.message || 'Failed to fetch attachments');
      }
      const data: Attachment[] = await res.json();
      setAttachments(data);
      onChange?.(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, onChange]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!canManage) return;
      if (!confirm('Delete this attachment?')) return;
      try {
        setDeletingId(id);
        const res = await authFetch(`/api/attachments/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Failed to delete attachment' }));
          throw new Error(err.message || 'Failed to delete attachment');
        }
        await fetchAttachments();
      } catch (e: any) {
        alert(e?.message || 'Failed to delete attachment');
      } finally {
        setDeletingId(null);
      }
    },
    [canManage, fetchAttachments]
  );

  const uploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (!canManage) return;
      setError(null);
      setUploading(true);

      try {
        for (const file of Array.from(files)) {
          // The backend contract expects metadata only (no binary upload here)
          const payload = {
            entity_type: entityType,
            entity_id: entityId,
            filename: file.name,
            original_name: file.name,
            mime_type: file.type || 'application/octet-stream',
            size_bytes: file.size,
          };
          const res = await authFetch('/api/attachments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: 'Failed to create attachment' }));
            throw new Error(err.message || `Failed to create attachment for ${file.name}`);
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const created: Attachment = await res.json();
        }
        await fetchAttachments();
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (e: any) {
        setError(e?.message || 'Failed to upload attachments');
      } finally {
        setUploading(false);
      }
    },
    [canManage, entityId, entityType, fetchAttachments]
  );

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    uploadFiles(e.target.files);
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Attachments</h3>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <input
                ref={fileInputRef}
                id="attachment-file-input"
                type="file"
                className="hidden"
                multiple
                onChange={onFileInputChange}
              />
              <label
                htmlFor="attachment-file-input"
                className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors cursor-pointer ${
                  uploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
                aria-disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Add files'}
              </label>
            </>
          )}
          <button
            type="button"
            onClick={fetchAttachments}
            className="inline-flex items-center px-2 py-1 rounded text-sm text-gray-700 hover:bg-gray-100"
            aria-label="Refresh attachments"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 p-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>
      )}

      <div className="border border-gray-200 rounded-md bg-white">
        {loading ? (
          <div className="p-4 text-gray-600" role="status" aria-live="polite">Loading attachments…</div>
        ) : attachments.length === 0 ? (
          <div className="p-4 text-gray-600">No attachments</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {attachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl" aria-hidden>{iconForMime(att.mimeType)}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900" title={att.originalName || att.filename}>
                      {att.originalName || att.filename}
                    </div>
                    <div className="text-xs text-gray-600">
                      {humanFileSize(att.sizeBytes)} • {new Date(att.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDelete(att.id)}
                    disabled={deletingId === att.id}
                    className={`text-sm font-medium rounded px-2 py-1 transition-colors ${
                      deletingId === att.id
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-red-700 hover:text-red-900'
                    }`}
                    aria-label={`Delete ${att.originalName || att.filename}`}
                  >
                    {deletingId === att.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
