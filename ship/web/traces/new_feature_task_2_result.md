# Task 2: File Attachments — migration, upload API, frontend component

**Duration:** 441.4s
**Trace:** traces/trace_20260329_004959.json

## Agent Output

## Task Results

**1. [done] database:** Create migration file ship/api/src/db/migrations/021_create_attachments.sql to add attachments table.
   -> I created the migration file `ship/api/src/db/migrations/021_create_attachments.sql` to add the `attachments` table. The table includes columns for `id`, `entity_type`, `entity_id`, `filename`, `original_name`, `mime_type`, `size_bytes`, `uploaded_by`, `created_at`, and `deleted_at`. An index on `entity_type` and `entity_id` was also added for efficient querying.

**2. [done] backend:** Create ship/api/src/routes/attachments.ts with routes for listing, uploading, and deleting attachments.
   -> I created the server route file for attachments with list, upload, and delete endpoints.

What I added
- New file: ship/api/src/routes/attachments.ts
  - Exports function: createAttachmentsRouter(pool: pg.Pool): express.Router
  - Endpoints implemented:
    - GET / — lists attachments filtered by entity_type and entity_id
      - Validates entity_type against ['issue', 'project', 'document']
      - Validates entity_id is a UUID
      - Returns array of Attachment (mapped from DB snake_case to camelCase)
    - POST / — creates a new attachment row
      - Validates body: entity_type, entity_id, filename, original_name, mime_type, size_bytes
      - Extracts uploaded_by from req.user.id or req.auth.userId (expects upstream auth middleware to set)
      - Inserts row and returns created Attachment with 201 status
    - DELETE /:id — soft-deletes an attachment
      - Validates id as UUID
      - Sets deleted_at = NOW() if not already deleted
      - Returns 200 with empty object or 404 if not found
  - Utilities:
    - mapRowToAttachment for DB row-to-API mapping
    - isValidUUID for basic UUID validation
    - ENTITY_TYPES constant mirrored from the shared contract

Notes
- The table schema aligns with migration 021_create_attachments.sql (columns and types match).
- The router assumes it will be mounted at /api/attachments by the main server file.
- uploaded_by relies on an existing authentication middleware setting either req.user.id or req.auth.userId; otherwise it responds 401.

No other files were changed.

**3. [done] backend:** Integrate attachments router into app by updating ship/api/src/app.ts to use '/api/attachments' route.
   -> Done.

Summary of changes:
- Created new file: ship/api/src/app.ts
  - Sets up an Express app with JSON body parsing.
  - Integrates the attachments router by mounting it at the route prefix /api/attachments.
  - Exports a factory function createApp(pool: pg.Pool): express.Express and a default export.

Details:
- app.ts content:
  - Imports express and the createAttachmentsRouter from ./routes/attachments.
  - Applies express.json() middleware.
  - Uses app.use('/api/attachments', createAttachmentsRouter(pool)) to mount the router.

Notes:
- There was no existing ship/api/src/app.ts file, so I created it to fulfill the integration request.
- No other files were modified.

**4. [done] frontend:** Create ship/web/src/components/AttachmentList.tsx to display and manage attachments for a given entity.
   -> I created a new component to display and manage attachments for a given entity.

What I added
- New file: src/components/AttachmentList.tsx

Highlights
- Lists attachments for a given entityType and entityId by calling GET /api/attachments?entity_type=...&entity_id=...
- Uploads new attachments (metadata only, per backend contract) via POST /api/attachments using authFetch
  - Uses a hidden file input; supports selecting multiple files
  - Sends { entity_type, entity_id, filename, original_name, mime_type, size_bytes }
- Deletes attachments via DELETE /api/attachments/:id using authFetch (with confirmation)
- Shows basic file icons based on MIME type, human-readable file sizes, and timestamps
- Exposes readOnly and onChange props:
  - readOnly: disables upload/delete
  - onChange: notifies parent with the updated list after fetch
- Includes a refresh button and basic error handling UI
- TailwindCSS classes for consistent styling

Usage
- Import and render where needed:
  - import AttachmentList from '../components/AttachmentList';
  - <AttachmentList entityType="issue" entityId={issueId} />
- Optional:
  - <AttachmentList entityType="project" entityId={projectId} readOnly />
  - <AttachmentList entityType="document" entityId={docId} onChange={(list) => console.log(list)} />

Notes
- The component currently uses:
  - authFetch for POST/DELETE (to set uploaded_by via auth); GET uses fetch.
  - If your GET requires auth as well, swap fetch for authFetch in fetchAttachments.
- This matches the shared contract: Entity types, fields, and endpoints. The implementation treats attachment creation as metadata-only (no binary upload), consistent with the backend you provided.

No other files were changed.

**5. [done] frontend:** Update ship/web/src/api/client.ts to add functions for getAttachments, createAttachment, and deleteAttachment.
   -> I updated the frontend API client to include attachment functions per the shared contract.

Changes made:
- Edited file: src/api/client.ts
  - Added attachment types and functions after the existing getActivities function:
    - Types:
      - Attachment
      - CreateAttachmentRequest
      - CreateAttachmentResponse (alias)
      - GetAttachmentsResponse (alias)
      - DeleteAttachmentResponse (alias)
    - Functions:
      - getAttachments(entityType: string, entityId: string): Promise<Attachment[]>
        - Uses GET /api/attachments?entity_type=...&entity_id=...
      - createAttachment(data: CreateAttachmentRequest): Promise<Attachment>
        - Uses POST /api/attachments with authFetch and JSON body
      - deleteAttachment(id: string): Promise<void>
        - Uses DELETE /api/attachments/:id with authFetch

Notes:
- GET uses fetch (unauthenticated) to match current AttachmentList behavior; POST/DELETE use authFetch.
- The function names and request/response shapes match the shared contract exactly.
- No other files were modified.

