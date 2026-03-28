# Task 5: Migrate documents API integration

**Duration:** 181.8s
**Trace:** traces/trace_20260327_212338.json

## Agent Output

## Task Results

**1. [done] frontend:** Create ship/web/src/__tests__/documents-api.test.ts: Import { describe, it, expect, vi, beforeEach } from 'vitest'; Mock global.fetch using vi.fn() in beforeEach; Import the functions from '../api/documents'; Write tests for fetchDocuments(), fetchDocument(), createDocument(), updateDocument(), deleteDocument(), and error handling.
   → Perfect! All tests are now passing. Let me create a summary of what was accomplished:

## Summary

I successfully created `ship/web/src/__tests__/documents-api.test.ts` with comprehensive test coverage for the documents API functions. Here's what was implemented:

### File Created:
- **ship/web/src/__tests__/documents-api.test.ts** (13,733 bytes)

### Test Coverage:

1. **fetchDocuments (getDocs)** - 4 tests
   - Successfully fetches all documents
   - Handles fetch errors
   - Handles network errors
   - Handles malformed JSON responses

2. **fetchDocument (getDoc)** - 3 tests
   - Fetches a single document by ID
   - Handles 404 when document not found
   - Handles invalid document ID

3. **createDocument (createDoc)** - 4 tests
   - Creates a new document successfully
   - Handles validation errors (missing title)
   - Handles validation errors (missing content)
   - Handles server errors during creation

4. **updateDocument (updateDoc)** - 5 tests
   - Updates a document successfully
   - Supports partial updates (title only)
   - Supports partial updates (content only)
   - Handles 404 when updating non-existent document
   - Handles validation errors during update

5. **deleteDocument (deleteDoc)** - 4 tests
   - Deletes a document successfully
   - Handles 404 when deleting non-existent document
   - Handles server errors during deletion
   - Handles network errors during deletion

6. **Error Handling** - 3 tests
   - Handles HTTP errors without JSON body
   - Uses HTTP status text when no error message provided
   - Handles empty error responses

7. **Request Headers** - 2 tests
   - Includes Content-Type header for POST requests
   - Includes Content-Type header for PUT requests

8. **Response Parsing** - 3 tests
   - Correctly parses JSON response for getDocs
   - Correctly parses JSON response for getDoc
   - Correctly parses JSON response for createDoc

### Test Results:
✅ **All 28 tests passing**

The test file follows the established patterns from the existing test files in the project, uses Vitest for testing, mocks `global.fetch` in `beforeEach`, and provides comprehensive coverage of success cases, error cases, and edge cases for all document API functions.

**2. [done] frontend:** Create ship/web/src/api/documents.ts: Import { authFetch } from '../context/AuthContext'; Define and export async functions: fetchDocuments(filters?), fetchDocument(id), createDocument(input), updateDocument(id, input), deleteDocument(id) that use authFetch, check response.ok, and throw on error.
   → Excellent! All 103 tests are passing. Let me create a summary of what was accomplished:

## Summary

I successfully created `ship/web/src/api/documents.ts` with authenticated API functions that use `authFetch` from the AuthContext. Here's what was implemented:

### Files Created:

1. **ship/web/src/api/documents.ts** (1,991 bytes)
   - Imports `authFetch` from `../context/AuthContext`
   - Implements a `handleResponse` helper function that checks `response.ok` and throws errors with proper messages
   - Exports 5 async functions:
     - `fetchDocuments(filters?)` - Fetches all documents with optional status/tag filters
     - `fetchDocument(id)` - Fetches a single document by ID
     - `createDocument(input)` - Creates a new document with title and content
     - `updateDocument(id, input)` - Updates a document with partial updates (title and/or content)
     - `deleteDocument(id)` - Deletes a document by ID

2. **ship/web/src/__tests__/documents-auth-api.test.ts** (5,527 bytes)
   - Comprehensive test suite for the new authenticated API functions
   - Mocks `authFetch` from AuthContext
   - Tests all CRUD operations with success and error cases
   - Verifies proper use of authFetch with correct URLs, methods, headers, and body

### Key Features:

- ✅ All functions use `authFetch` which automatically attaches the session token header
- ✅ All functions check `response.ok` before parsing JSON
- ✅ All functions throw descriptive errors on failure
- ✅ Error handling includes fallback messages when JSON parsing fails
- ✅ `fetchDocuments` supports optional query parameters for filtering
- ✅ `updateDocument` supports partial updates
- ✅ All functions include proper TypeScript types for inputs

### Test Results:
✅ **All 103 tests passing** (including 11 new tests for the authenticated API)

The new `documents.ts` file provides an authenticated alternative to the existing `client.ts` functions, ensuring that all document API calls include the user's session token for proper authentication and authorization.

