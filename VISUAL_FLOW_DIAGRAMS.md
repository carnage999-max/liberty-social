# Page Profile Image Management - Visual Flow Diagrams

## User Journeys

### Journey 1: Public User Viewing Profile Image

```
┌─────────────────────────────────────────────────────┐
│       PUBLIC USER - View Page Profile               │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
            ┌──────────────────────────┐
            │ Navigate to Page Detail  │
            └──────────────────────────┘
                          │
                          ▼
        ┌───────────────────────────────────┐
        │ Page displays with profile image  │
        │   [Clickable Image]  [Follow]     │
        └───────────────────────────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │ Click on Image         │
              └────────────────────────┘
                          │
                          ▼
        ┌───────────────────────────────────┐
        │   GALLERY OPENS (Full Screen)     │
        │                                   │
        │        ◄──  [Image]  ──►          │
        │                                   │
        │   [Close Button]  1 / 1           │
        └───────────────────────────────────┘
                          │
                          ▼
        ┌───────────────────────────────────┐
        │ User can:                         │
        │ • View image in full screen       │
        │ • Close by clicking X or backdrop │
        └───────────────────────────────────┘
```

### Journey 2: Page Admin Updating Profile Image

```
┌─────────────────────────────────────────────────────┐
│    PAGE ADMIN - Update Profile Image                │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌────────────────────────────────┐
        │ Navigate to Page Detail        │
        │ (As Admin/Owner)               │
        └────────────────────────────────┘
                          │
                          ▼
    ┌──────────────────────────────────────────┐
    │ Page displays:                           │
    │  [Profile Image] [Follow] [Edit]         │
    │                                          │
    │ Note: [Edit] only visible to admins      │
    └──────────────────────────────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │ Click Edit       │
                └──────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────┐
        │     EDIT MODAL OPENS               │
        │                                    │
        │  ┌──────────────────────────────┐  │
        │  │ Profile Image Upload         │  │
        │  │ [Upload] [Preview] [Clear]   │  │
        │  │                              │  │
        │  ├──────────────────────────────┤  │
        │  │ Page Name: [Input]           │  │
        │  │ Description: [Textarea]      │  │
        │  │ Category: [Dropdown]         │  │
        │  │ Website: [Input]             │  │
        │  │ Email: [Input]               │  │
        │  │ Phone: [Input]               │  │
        │  │                              │  │
        │  │ [Cancel] [Save Changes]      │  │
        │  └──────────────────────────────┘  │
        └────────────────────────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────┐
        │ Admin selects image file           │
        │ (or drag-drop)                     │
        └────────────────────────────────────┘
                          │
                          ▼
    ┌──────────────────────────────────────────────┐
    │ ImageUploadField validates:                  │
    │ ✓ File type (image/*)                        │
    │ ✓ File size (< 5MB)                          │
    │                                              │
    │ If invalid → Show error toast                │
    │ If valid   → Proceed to upload               │
    └──────────────────────────────────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────┐
        │ Upload to S3                       │
        │ POST /api/uploads/images/          │
        │ (with file in FormData)            │
        └────────────────────────────────────┘
                          │
                          ▼
    ┌──────────────────────────────────────────────┐
    │ Response: { url: "https://s3.../image.jpg" } │
    └──────────────────────────────────────────────┘
                          │
                          ▼
    ┌──────────────────────────────────────────────┐
    │ Form state updated:                          │
    │ editForm.profile_image_url = S3 URL          │
    │                                              │
    │ ImageUploadField shows preview               │
    └──────────────────────────────────────────────┘
                          │
                          ▼
    ┌──────────────────────────────────────────────┐
    │ Admin fills other fields if needed           │
    │ (or keeps existing values)                   │
    └──────────────────────────────────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────┐
        │ Admin clicks "Save Changes"        │
        └────────────────────────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────┐
        │ DUAL REQUEST SUBMISSION:           │
        │                                    │
        │ 1. PATCH /pages/{id}/              │
        │    (name, description, category,   │
        │     website_url, phone, email)     │
        │                                    │
        │ 2. POST /pages/{id}/               │
        │    update-profile-image/           │
        │    (profile_image_url)             │
        └────────────────────────────────────┘
                          │
                    ┌─────┴─────┐
                    ▼           ▼
            ┌────────────┐  ┌──────────────┐
            │ Response 1 │  │ Response 2   │
            └────────────┘  └──────────────┘
                    │           │
                    └─────┬─────┘
                          ▼
        ┌────────────────────────────────────┐
        │ Update page state                  │
        │ setPage(updated)                   │
        │ setIsEditing(false)                │
        └────────────────────────────────────┘
                          │
                          ▼
        ┌────────────────────────────────────┐
        │ Show success toast                 │
        │ "Page updated successfully!"       │
        └────────────────────────────────────┘
                          │
                          ▼
    ┌──────────────────────────────────────────────┐
    │ Page refreshes with:                         │
    │ • New profile image displayed                │
    │ • All updated fields shown                   │
    │ • Gallery shows new image when clicked       │
    └──────────────────────────────────────────────┘
```

## Component Relationships

```
┌─────────────────────────────────────────────────────┐
│          Page Detail Component                      │
│  frontend/app/app/pages/[id]/page.tsx              │
└────────────────┬────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────────┐
│  Gallery     │   │  ImageUploadField│
│  Component   │   │  Component       │
│              │   │                  │
│ • Display    │   │ • File upload    │
│ • Navigation │   │ • Validation     │
│ • Close      │   │ • Preview        │
│ • Backdrop   │   │ • S3 upload      │
└──────────────┘   └──────────────────┘
```

## Backend Permission Flow

```
┌──────────────────────────────────────────────┐
│  POST /pages/{id}/update-profile-image/      │
│  with { profile_image_url: "..." }           │
└────────────────────────┬─────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │ Check Authentication   │
            │ Is user logged in?     │
            └────────────┬───────────┘
                         │
            ┌────────────▼────────────┐
            │ NO                      │
            ▼                         │
        [401]                    ┌────▼────┐
    Unauthorized               │ YES      │
                               └────┬─────┘
                                    │
                    ┌───────────────▼────────────┐
                    │ Check Page Admin Status    │
                    │ _page_admin_entry()        │
                    └───────────────┬────────────┘
                                    │
                    ┌───────────────▼────────────┐
                    │ NO                         │
                    ▼                            │
                  [403]                    ┌─────▼──┐
              Permission Denied           │ YES    │
                                          └────┬───┘
                                               │
                        ┌──────────────────────▼────┐
                        │ Validate profile_image_url│
                        │ exists?                    │
                        └──────────────┬─────────────┘
                                       │
                        ┌──────────────▼───────────┐
                        │ NO                       │
                        ▼                          │
                      [400]                   ┌────▼────┐
                  Bad Request                │ YES      │
                                             └────┬─────┘
                                                  │
                          ┌───────────────────────▼─────┐
                          │ Update Page model           │
                          │ page.profile_image_url = url│
                          │ page.save()                 │
                          └───────────────┬─────────────┘
                                          │
                                          ▼
                        ┌─────────────────────────────┐
                        │ Serialize updated page      │
                        │ Return [200] with page data │
                        └─────────────────────────────┘
```

## State Management Flow

```
┌─────────────────────────────────────────────────┐
│   Page Detail Component State                   │
└─────────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ page: BusinessPage | null                    │
│   → Full page object from backend            │
│   → Updated on load and after save           │
└──────────────────────────────────────────────┘
                          │
        ┌─────────────────▼──────────────────┐
        │                                    │
        ▼                                    ▼
┌─────────────────────┐        ┌────────────────────┐
│ editForm: {         │        │ galleryOpen:       │
│   name: string      │        │   boolean          │
│   description: ...  │        │                    │
│   category: ...     │        │ Controls Gallery   │
│   website_url: ...  │        │ modal visibility   │
│   phone: ...        │        └────────────────────┘
│   email: ...        │
│   profile_image_url:│ ← NEW STATE
│     string          │
│ }                   │
└─────────────────────┘
        │
        ▼
Updated via:
• setEditForm() - User input
• ImageUploadField onChange
• Form submission handler
```

## Data Storage

```
Frontend                    Backend                 S3
─────────                   ─────────               ──

Page Component              Page Model              image.jpg
  ├─ id                       ├─ id
  ├─ name                     ├─ name
  ├─ description              ├─ description
  ├─ category                 ├─ category
  ├─ website_url              ├─ website_url
  ├─ phone                    ├─ phone
  ├─ email                    ├─ email
  ├─ profile_image_url ◄──┐   ├─ profile_image_url ──┐
  │  (URL string)         │   │  (URL string)        │
  ├─ cover_image_url      │   ├─ cover_image_url     │
  ├─ is_verified          │   ├─ is_verified         │
  ├─ created_at           │   ├─ created_at          │
  └─ updated_at           │   ├─ updated_at          │
                          │   └─ ...                 │
                          │                          │
                          └──────────────────────────┘
                                 (stored as URL)
```

## API Endpoints Summary

```
┌─────────────────────────────────────────────────────┐
│  IMAGE MANAGEMENT ENDPOINTS                         │
└─────────────────────────────────────────────────────┘

1. UPLOAD IMAGE
   Method: POST
   Path:   /api/uploads/images/
   Auth:   Required
   Body:   FormData { file: File }
   Response: { url: "https://s3.../image.jpg" }
   
   Used by: ImageUploadField

2. UPDATE PROFILE IMAGE (NEW)
   Method: POST
   Path:   /api/pages/{page_id}/update-profile-image/
   Auth:   Required (Admin/Owner)
   Body:   { profile_image_url: "https://..." }
   Response: Full Page object
   
   Used by: Page detail edit form

3. GET PAGE DETAILS
   Method: GET
   Path:   /api/pages/{page_id}/
   Auth:   Optional
   Response: Page object with profile_image_url
   
   Used by: Gallery component (reads image URL)

4. UPDATE PAGE (existing)
   Method: PATCH
   Path:   /api/pages/{page_id}/
   Auth:   Required (Admin/Owner)
   Body:   { name, description, category, ... }
   Response: Updated page object
   
   Used by: Edit form (general data)
```

## Error Handling Flow

```
┌────────────────────────────────────┐
│  ImageUploadField Error Handling   │
└────────────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
        ▼                ▼
   Client-side      Server-side
   Validation       Response
        │                │
    ┌───┴────┐       ┌───┴────┐
    │         │       │         │
    ▼         ▼       ▼         ▼
  File     File     Upload    Request
  Type     Size     Error      Error
   │        │         │         │
   ▼        ▼         ▼         ▼
"Please   "Image   "Failed   Varies
 select   must be  to upload"
 image"   < 5MB"


┌──────────────────────────────────────┐
│  update-profile-image Error Handling │
└──────────────────────────────────────┘
                │
        ┌───────┴──────────┐
        │                  │
        ▼                  ▼
   No URL           No Admin
   provided         Access
        │                  │
        ▼                  ▼
      [400]              [403]
   Bad Request     Permission
                     Denied
```
