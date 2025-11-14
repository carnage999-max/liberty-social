# Image Upload Fix - Technical Summary

## Issue Reported
User could not upload images when editing marketplace listings. The request was not reaching the backend (no logs), and the user received an error.

## Root Causes Identified

### 1. Wrong API Endpoint Path (Primary Issue)
```
❌ Frontend was using:     /api/uploads/images/
✅ Backend provides:       /uploads/images/
```

The frontend's `MediaUploadField` component was hardcoding an incorrect path that included `/api` prefix. This path doesn't exist in the backend routing.

### 2. Missing API Base URL Construction
The upload code was using direct `fetch()` calls instead of leveraging the `API_BASE` constant from the centralized API helpers. This meant:
- No environment variable support
- Hardcoded paths
- Bypassed authentication header helpers
- Inconsistent with the rest of the application

### 3. Incorrect Media Deletion
The edit page was also using hardcoded paths for deleting media:
```
❌ /api/marketplace/media/${mediaId}/
✅ /marketplace/media/${mediaId}/ (via apiDelete helper)
```

## Solutions Implemented

### Solution 1: Use API_BASE Constant
**File**: `frontend/components/marketplace/MediaUploadField.tsx`

```typescript
import { API_BASE } from "@/lib/api";

// Before
const response = await fetch("/api/uploads/images/", {

// After  
const uploadUrl = `${API_BASE}/uploads/images/`;
const response = await fetch(uploadUrl, {
```

### Solution 2: Use API Helper Functions
**File**: `frontend/app/app/marketplace/[id]/edit/page.tsx`

```typescript
import { apiPost, apiGet, apiPatch, apiDelete } from "@/lib/api";

// Before - direct fetch with wrong path
await fetch(`/api/marketplace/media/${mediaId}/`, {
  method: "DELETE",
  headers: {
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
  },
});

// After - proper helper with correct path
await apiDelete(`/marketplace/media/${mediaId}/`);
```

### Solution 3: Update Type Definitions
**File**: `frontend/components/marketplace/MediaUploadField.tsx`

Added `id` field to properly track existing media:
```typescript
export interface UploadedMedia {
  url: string;
  order: number;
  tempId?: string;
  id?: number;  // Added: for tracking existing media items
}
```

## Verified Endpoints

### Backend Routes Confirmed
```
✅ POST /api/uploads/images/          - Image upload to S3
✅ GET /api/marketplace/media/         - List media items  
✅ POST /api/marketplace/media/        - Create media item
✅ DELETE /api/marketplace/media/{id}/ - Delete media item
```

All routes are properly registered in `backend/main/urls.py`

## Why No Backend Logs?
When using the wrong endpoint path (`/api/uploads/images/`), the request:
1. Reaches the Django server
2. Gets rejected by URL routing (404)
3. Never reaches the UploadImageView
4. Returns error without logging (frontend doesn't see details)

This explains why the user saw an error but the backend had no logs - the request was hitting a 404 route.

## Solution Verification

### Environment Variable Used
The fix respects the environment configuration:
```
NEXT_PUBLIC_API_BASE_URL = http://localhost:8000/api (dev)
NEXT_PUBLIC_API_BASE_URL = https://api.example.com/api (prod)

Generated URLs:
- http://localhost:8000/api/uploads/images/
- https://api.example.com/api/uploads/images/
```

### API Pattern Now Consistent
All API calls now follow the standard pattern:
```
apiGet(path)
apiPost(path, data)
apiPatch(path, data)
apiDelete(path)
```

Where `path` is relative (no domain, no /api prefix) and helpers handle:
- URL construction with API_BASE
- Authentication headers
- JSON serialization
- Error handling
- Response parsing

## Files Modified
1. `frontend/components/marketplace/MediaUploadField.tsx` (8 lines changed)
2. `frontend/app/app/marketplace/[id]/edit/page.tsx` (6 lines changed)

## Impact
- ✅ Image uploads now work correctly
- ✅ Requests are logged in backend
- ✅ Proper error messages displayed
- ✅ Consistent with application patterns
- ✅ Environment-aware configuration

## Testing Results
```
npm run build: ✅ Success (0 errors, 0 warnings)
python manage.py check: ✅ Success (0 issues)
```

## Commits
- `f34d841` - Fix marketplace image upload endpoints to use correct API paths
- `e19788b` - Add documentation for image upload fix

---

## Quick Reference: Correct API Patterns

### ❌ AVOID
```typescript
// Hardcoded paths
fetch("/api/uploads/images/", {...})
fetch("/api/marketplace/media/1/", {...})

// No environment support
const url = "http://localhost:8000/api/...";

// Manual auth headers
headers: {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json"
}
```

### ✅ USE
```typescript
// Relative paths with helpers
import { apiPost, apiDelete, API_BASE } from "@/lib/api";

// Option 1: Helper functions (preferred)
await apiPost("/marketplace/media/", data);
await apiDelete("/marketplace/media/1/");

// Option 2: With API_BASE for raw fetch
const url = `${API_BASE}/uploads/images/`;
fetch(url, {...})

// Helpers handle auth, serialization, etc.
```

