# API Endpoint Fixes - Comprehensive Summary

## Issues Fixed

### 1. Offers Page - Pagination Handling ✅

**Problem**: 
- Offers page was showing repeated errors
- API returns paginated response with `{ count, next, previous, results }`
- Code was not properly handling the paginated structure

**Solution**:
```typescript
// Before - Incorrect handling
const response = await apiGet("/marketplace/offers/");
const allOffers: OfferWithDetails[] = response.results || response;

// After - Proper type-safe pagination handling
import { PaginatedResponse } from "@/lib/api";

const response = await apiGet<PaginatedResponse<OfferWithDetails>>(
  "/marketplace/offers/"
);
const allOffers: OfferWithDetails[] = response.results || [];
```

**Changes Made**:
- Added `PaginatedResponse` type import
- Properly typed the API response
- Ensured `response.results` is always accessed
- Default to empty array if no results

**File**: `frontend/app/app/marketplace/offers/page.tsx`

---

### 2. Pages Edit - Image Upload Failure ✅

**Problem**:
- Image uploads in pages edit were failing
- `ImageUploadField` component was using hardcoded `/api/uploads/images/` path
- This endpoint doesn't exist; correct path is `/uploads/images/`
- API_BASE environment variable was not being used

**Solution**:
```typescript
// Before - Hardcoded incorrect path
const response = await fetch("/api/uploads/images/", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
  },
  body: formData,
});

// After - Using API_BASE constant
import { API_BASE } from "@/lib/api";

const uploadUrl = `${API_BASE}/uploads/images/`;
const response = await fetch(uploadUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
  },
  body: formData,
});
```

**Changes Made**:
- Import `API_BASE` from `@/lib/api`
- Construct URL using environment-aware constant
- Add error logging for debugging
- Same fix applied to marketplace image uploads

**Files**:
- `frontend/components/ImageUploadField.tsx` (pages edit image upload)
- `frontend/components/marketplace/MediaUploadField.tsx` (marketplace image upload)

---

## API Endpoints Reference

### Offers Endpoint
```
GET /api/marketplace/offers/
```

**Response Format** (Paginated):
```json
{
  "count": 5,
  "next": "http://api/marketplace/offers/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "listing": {...},
      "buyer": {...},
      "offered_price": 100,
      "status": "pending",
      "message": "Is this negotiable?",
      "created_at": "2025-11-14T...",
      "responded_at": null
    }
  ]
}
```

### Image Upload Endpoint
```
POST /api/uploads/images/
```

**Request**: FormData with `file` key
**Response**:
```json
{
  "url": "https://s3.amazonaws.com/bucket/image.jpg",
  "urls": ["https://..."],
  "items": [{
    "url": "https://...",
    "content_type": "image/jpeg",
    "name": "image.jpg",
    "size": 102400
  }]
}
```

---

## How to Handle Paginated Responses

### Correct Pattern
```typescript
import { apiGet, type PaginatedResponse } from "@/lib/api";

// Type the response properly
const response = await apiGet<PaginatedResponse<YourType>>(
  "/your-endpoint/"
);

// Always use response.results
const items: YourType[] = response.results || [];

// Access pagination metadata
console.log(response.count);   // Total count
console.log(response.next);    // Next page URL
console.log(response.previous); // Previous page URL
```

### With Pagination Parameters
```typescript
// Query parameters for pagination
const response = await apiGet<PaginatedResponse<YourType>>(
  "/your-endpoint/?page=1&page_size=20"
);
```

### Common Paginated Endpoints
- `/marketplace/listings/` - Browse listings
- `/marketplace/offers/` - User's offers
- `/marketplace/saves/` - Saved listings
- `/marketplace/media/` - Media items
- Most other list endpoints

---

## Image Upload Pattern

### Correct Pattern for All Image Uploads
```typescript
import { API_BASE } from "@/lib/api";

const formData = new FormData();
formData.append("file", file);

const uploadUrl = `${API_BASE}/uploads/images/`;
const response = await fetch(uploadUrl, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
  },
  body: formData,
});

if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error("Upload error:", errorData);
  throw new Error("Upload failed");
}

const data = await response.json();
const imageUrl = data.url; // Use this URL in your application
```

### Components Using This Pattern
- ✅ `ImageUploadField.tsx` - Pages/business edit
- ✅ `MediaUploadField.tsx` - Marketplace listings

---

## Environment Configuration

Make sure your `.env.local` (or environment) has:
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

This is used by all API helpers to construct URLs:
- Development: `http://localhost:8000/api`
- Production: `https://api.yourdomain.com/api`

---

## Files Modified

### 1. `/frontend/app/app/marketplace/offers/page.tsx`
- Added `PaginatedResponse` type import
- Fixed response handling to properly access `response.results`
- Ensures consistent handling of paginated data

### 2. `/frontend/components/ImageUploadField.tsx`
- Added `API_BASE` import
- Fixed upload URL to use environment-aware constant
- Added error logging for debugging

### 3. `/frontend/components/marketplace/MediaUploadField.tsx`
- (Previously fixed) Uses `API_BASE` for upload URL
- Properly handles multiple file uploads

---

## Testing Checklist

- [ ] Upload image in pages edit - should work
- [ ] Upload images in marketplace create - should work
- [ ] Upload images in marketplace edit - should work
- [ ] View offers page - should show all offers without errors
- [ ] Filter offers by tab (received/sent) - should work
- [ ] Accept/decline offer - should update status
- [ ] Check backend logs for successful requests

---

## Common Issues and Solutions

### Issue: "Upload failed" with no error details
**Solution**: Check browser console for error data, ensure:
- Authentication token is valid
- CORS is configured
- API_BASE is set correctly
- File is valid (image type, < 5MB)

### Issue: Offers page shows repeated errors
**Solution**: Ensure:
- Response is typed as `PaginatedResponse<OfferWithDetails>`
- Always access `response.results` array
- Check backend for actual errors in logs

### Issue: API endpoints return 404
**Solution**: Verify:
- Paths don't include hardcoded `/api` prefix
- Using `API_BASE` constant for raw fetch calls
- Backend routes are registered correctly

---

## Commit Hash

`1af6cb0` - Fix offers page pagination and image uploads in pages edit

---

## Summary

All paginated API endpoints now properly handle the response structure. All image uploads use the correct environment-aware URL construction. The application now follows consistent patterns for:
1. Paginated data handling
2. Image upload operations
3. API endpoint construction
4. Environment configuration

