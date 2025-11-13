# Page Profile Image Management

## Overview

This feature allows page admins and owners to update their page's profile image through the edit page interface. Regular users can click on the profile image to view it in a full-screen gallery.

## Features

### Backend

#### New Endpoint: Update Profile Image

**Endpoint:** `POST /api/pages/{id}/update-profile-image/`

**Required Permission:** Page Admin or Owner

**Request Body:**
```json
{
  "profile_image_url": "https://s3.example.com/image.jpg"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Liberty Café",
  "category": "business",
  "profile_image_url": "https://s3.example.com/image.jpg",
  "cover_image_url": null,
  "is_verified": false
}
```

**Permission Check:**
- Only page admins/owners can update the profile image
- Returns `403 Permission Denied` if user is not an admin/owner
- Returns `400 Bad Request` if `profile_image_url` is missing

### Frontend Components

#### Gallery Component

**Location:** `frontend/components/Gallery.tsx`

**Props:**
```typescript
interface GalleryProps {
  isOpen: boolean;           // Controls modal visibility
  onClose: () => void;       // Callback when closing gallery
  images: string[];          // Array of image URLs to display
  initialIndex?: number;     // Starting image index (default: 0)
}
```

**Features:**
- Full-screen image viewer
- Next/Previous navigation buttons (when multiple images)
- Image counter display
- Click backdrop to close
- Smooth image transitions

**Usage:**
```tsx
const [galleryOpen, setGalleryOpen] = useState(false);

<Gallery
  isOpen={galleryOpen}
  onClose={() => setGalleryOpen(false)}
  images={[imageUrl]}
/>
```

#### ImageUploadField Component

**Location:** `frontend/components/ImageUploadField.tsx`

**Props:**
```typescript
interface ImageUploadFieldProps {
  label: string;                    // Field label
  value: string | null;             // Current image URL
  onChange: (url: string) => void;  // Callback for URL change
  onPreview?: (url: string) => void;// Optional preview callback
  disabled?: boolean;               // Disable interactions
}
```

**Features:**
- Drag-and-drop support (native file input)
- File validation (image type, 5MB max size)
- Upload progress indication
- Image preview display
- Clear button to remove image
- Automatic upload to S3 via `/api/uploads/images/`

**Usage:**
```tsx
<ImageUploadField
  label="Profile Image"
  value={profileImageUrl}
  onChange={(url) => setProfileImageUrl(url)}
  disabled={isSubmitting}
/>
```

### Updated Page Detail Component

**Location:** `frontend/app/app/pages/[id]/page.tsx`

**Changes:**
1. Profile image is now clickable to open gallery
2. Edit modal includes ImageUploadField for profile image
3. Image upload is submitted via dedicated `/update-profile-image/` endpoint
4. Gallery component integrated for image viewing

**Workflow:**
1. User clicks profile image → Gallery opens
2. User clicks Edit → Edit modal shows all fields including image upload
3. User selects new image → ImageUploadField uploads to S3
4. User clicks Save → Page data + profile image URL saved
5. Updated page displays new image

## Technical Details

### Image Upload Flow

1. **Frontend:** User selects image via ImageUploadField
2. **Frontend:** Component uploads file to `/api/uploads/images/` (existing endpoint)
3. **Backend:** UploadImageView processes file and uploads to S3
4. **Frontend:** Component receives URL and updates form state
5. **Frontend:** User submits form with new profile_image_url
6. **Backend:** PageViewSet saves general page data and profile image via dedicated endpoint

### Permission Model

```
User Type              Can View Gallery    Can Edit Image
Public/Guest           ✓ (if has image)    ✗
Authenticated User     ✓ (if has image)    ✗
Page Admin             ✓ (if has image)    ✓
Page Owner             ✓ (if has image)    ✓
```

### Storage

- Images stored in S3 bucket (via existing upload system)
- URLs stored in `Page.profile_image_url` field
- No local database changes needed

## Security Considerations

1. **Authentication:** Gallery is public, but image URLs must be discoverable
2. **Authorization:** Only page admins/owners can update images
3. **File Validation:** 
   - Only image files accepted
   - Maximum 5MB file size
   - MIME type validation on client and server
4. **Rate Limiting:** Uses existing authentication system

## Error Handling

### ImageUploadField
- Non-image files: "Please select an image file"
- Files > 5MB: "Image must be less than 5MB"
- Upload failures: "Failed to upload image"

### update-profile-image Endpoint
- Missing `profile_image_url`: 400 Bad Request
- User not admin/owner: 403 Permission Denied
- Database error: 500 Internal Server Error

## Testing

### Manual Tests
1. **View Gallery:**
   - Navigate to page detail
   - Click on profile image
   - Gallery opens with image
   - Navigation works (if implemented for multiple images)

2. **Edit Profile Image:**
   - Click Edit button (as page admin)
   - Upload new image
   - Verify preview shows
   - Submit form
   - Verify new image appears in page

3. **Permission Check:**
   - Non-admin user tries to edit
   - Edit button should not be visible
   - Gallery should still work

4. **Error Cases:**
   - Upload non-image file → error toast
   - Upload file > 5MB → error toast
   - Network error during upload → error toast

## Future Enhancements

1. **Multiple Images:**
   - Support cover_image_url alongside profile_image_url
   - Gallery with navigation between multiple images

2. **Crop/Edit:**
   - Client-side image cropping before upload
   - Aspect ratio enforcement

3. **Gallery Performance:**
   - Lazy loading for large image arrays
   - Image optimization with next/image

4. **Bulk Upload:**
   - Multiple image uploads at once
   - Drag-and-drop zone component

## API Reference

### Update Profile Image
- **Method:** POST
- **URL:** `/api/pages/{page_id}/update-profile-image/`
- **Auth:** Required (Bearer token)
- **Body:** `{ "profile_image_url": "string" }`
- **Response:** Full Page object with updated image

### Upload Image (existing)
- **Method:** POST
- **URL:** `/api/uploads/images/`
- **Auth:** Required
- **Body:** FormData with 'file' field
- **Response:** `{ "url": "string", "urls": [...], "items": [...] }`
