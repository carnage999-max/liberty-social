# Image Upload Issue - Root Cause and Fix

## Problem Summary

When trying to update a listing image in the marketplace edit page, the image upload was failing silently with no backend request being logged.

## Root Cause Analysis

### Issue 1: Incorrect API Endpoint Path

**Location**: `frontend/components/marketplace/MediaUploadField.tsx` (line 60)

**Problem**:
```typescript
const response = await fetch("/api/uploads/images/", {
```

The code was using the hardcoded path `/api/uploads/images/`, which is incorrect because:

1. The actual backend endpoint is `/uploads/images/` (without `/api` prefix)
2. The `/api` prefix is added by the `API_BASE` constant which is set from environment variable `NEXT_PUBLIC_API_BASE_URL`
3. Direct fetch calls bypass the API helper functions that handle URL construction

**Solution**:
```typescript
const uploadUrl = `${API_BASE}/uploads/images/`;
const response = await fetch(uploadUrl, {
```

Now it uses the `API_BASE` constant from `lib/api.ts` which correctly constructs the full URL based on the environment configuration.

### Issue 2: Incorrect Media Deletion Endpoint

**Location**: `frontend/app/app/marketplace/[id]/edit/page.tsx` (line 188)

**Problem**:
```typescript
await fetch(`/api/marketplace/media/${mediaId}/`, {
  method: "DELETE",
```

Same issue - hardcoded `/api` prefix that doesn't exist in the actual endpoint.

**Solution**:
```typescript
await apiDelete(`/marketplace/media/${mediaId}/`);
```

Now it uses the proper `apiDelete` helper which constructs the URL correctly and handles authentication.

### Issue 3: Missing ID Property in Upload Response

**Location**: `frontend/components/marketplace/MediaUploadField.tsx`

**Problem**:
The `UploadedMedia` interface didn't include the `id` field:
```typescript
export interface UploadedMedia {
  url: string;
  order: number;
  tempId?: string;
  // Missing: id?: number;
}
```

**Solution**:
```typescript
export interface UploadedMedia {
  url: string;
  order: number;
  tempId?: string;
  id?: number;  // Added for tracking existing media
}
```

This allows the edit page to distinguish between newly uploaded media and existing media when processing updates.

## Backend Verification

### Available Endpoints

✅ **Image Upload Endpoint**
```
POST /uploads/images/
Permission: IsAuthenticated
Input: FormData with 'file' or 'files' key
Output: { url, urls, items }
```

✅ **Media Management Endpoint**
```
GET /marketplace/media/ - List media (owner only)
POST /marketplace/media/ - Create media item (owner only)  
DELETE /marketplace/media/{id}/ - Delete media (owner only)
```

Both endpoints are properly registered in `backend/main/urls.py` and accessible at the correct paths.

## How Image Upload Works Now

### Step 1: Select Image
User selects an image file in the MediaUploadField

### Step 2: Validate
- Check file type (must be image/*)
- Check file size (max 5MB)
- Check file count (max 5 images)

### Step 3: Upload to S3
```javascript
formData.append("file", file);
const uploadUrl = `${API_BASE}/uploads/images/`; // e.g., http://localhost:8000/api/uploads/images/
const response = await fetch(uploadUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
  body: formData,
});
const data = await response.json();
// data.url contains the S3 URL
```

### Step 4: Track Uploaded Media
```javascript
uploadedMedia.push({
  url: data.url,        // S3 URL from backend
  order: index,         // Display order
  tempId: "uuid",       // Temp ID for tracking
});
```

### Step 5: Update Backend on Form Submit
When form is submitted:
```javascript
// Add new media to listing
const newMedia = media.filter((m) => !m.id); // Only new uploads
for (const item of newMedia) {
  await apiPost("/marketplace/media/", {
    listing: listingId,
    media_url: item.url,
    media_type: "image",
    order: item.order,
  });
}
```

## Frontend API Pattern

The correct way to make API calls in Liberty Social:

### ❌ Incorrect (Direct Fetch)
```typescript
fetch("/api/uploads/images/", {...})  // Wrong path
fetch(`/api/marketplace/media/${id}/`, {...})  // Wrong path
```

### ✅ Correct (Using Helpers)
```typescript
// From lib/api.ts
const uploadUrl = `${API_BASE}/uploads/images/`;
fetch(uploadUrl, {...})

// Or use helper functions
await apiPost("/marketplace/media/", data);
await apiDelete("/marketplace/media/{id}/");
```

## Files Changed

1. **MediaUploadField.tsx**
   - Import `API_BASE` from `lib/api`
   - Use `API_BASE` for upload URL construction
   - Add `id` to UploadedMedia interface
   - Add error logging for debugging

2. **[id]/edit/page.tsx**
   - Import `apiDelete` from `lib/api`
   - Use `apiDelete` instead of raw fetch for deletion
   - This ensures proper URL construction and authentication

## Testing Checklist

- [ ] Create new listing with multiple images
- [ ] Upload images successfully (check S3 URLs)
- [ ] Edit listing and update existing images
- [ ] Delete images from listing
- [ ] Add new images to existing listing
- [ ] Verify backend logs show upload requests
- [ ] Verify S3 storage has image files
- [ ] Test error cases (invalid file type, too large, etc.)

## Environment Configuration

Make sure `NEXT_PUBLIC_API_BASE_URL` is set correctly:

```bash
# Development
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api

# Production
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com/api
```

This environment variable is used by `API_BASE` in `lib/api.ts` to construct all API URLs.

## Commit Hash

`f34d841` - Fix marketplace image upload endpoints to use correct API paths
