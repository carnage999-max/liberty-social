# Page Posts Feature - Quick Reference

## What Was Built

A complete posts management system for Liberty Social pages where:
- **Admins** can create, edit, and delete posts in a compact modal interface
- **All users** can view all page posts in a beautiful list with media galleries
- **Manage button** (⋮) appears on each post for admins to edit/delete

## Components at a Glance

| Component | Purpose | Visibility |
|-----------|---------|------------|
| `PagePostFormModal` | Create posts in modal | Admins only |
| `PagePostsList` | Display all posts | All users |
| `PagePostEditModal` | Edit/delete posts | Admins only |
| `ImageGallery` | View post media | All users |

## File Locations

```
frontend/
├── components/pages/
│   ├── PagePostFormModal.tsx  (NEW - 200 lines)
│   ├── PagePostEditModal.tsx  (NEW - 350 lines)
│   ├── PagePostsList.tsx      (NEW - 350 lines)
│   └── PagePostForm.tsx       (REMOVED - moved to Modal)
│
└── app/app/pages/
    └── [id]/page.tsx          (MODIFIED - import changes + integration)
```

## Key Features

### For Admins
✅ Create posts with content and up to 6 images
✅ Set visibility: Public, Followers, Private
✅ Edit existing posts (content, media, visibility)
✅ Delete posts with confirmation
✅ See post list with manage button

### For All Users
✅ View all page posts
✅ See post metadata (author, timestamp, reactions)
✅ Click media to open lightbox gallery
✅ Click "View Post" to see full details
✅ See reaction counts by emoji type

## How to Use

### Create a Post (Admin)
1. Go to page detail page
2. Find "Share a post..." card
3. Click card or "+ Post" button
4. Fill form in modal
5. Click "Publish Post"
6. Post appears in list immediately

### Edit a Post (Admin)
1. Find post in list
2. Click three-dot (⋮) menu
3. Modal opens with current data
4. Make changes and click "Update Post"
5. Changes reflected in list

### Delete a Post (Admin)
1. Click three-dot (⋮) menu on post
2. Click trash icon
3. Confirm deletion
4. Post removed from list

### View Posts (Anyone)
1. Go to page detail page
2. Scroll to "Page Posts" section
3. See all posts in list
4. Click images to view in gallery
5. Click "View Post" for full details

## API Endpoints

**Fetch posts:** `GET /pages/{id}/posts/`
**Create post:** `POST /posts/`
**Get post:** `GET /posts/{id}/`
**Update post:** `PATCH /posts/{id}/`
**Delete post:** `DELETE /posts/{id}/`
**Upload media:** `POST /uploads/images/`

## State Management

### Page Component
```typescript
const [refreshPosts, setRefreshPosts] = useState(0);
// Increment to trigger PagePostsList reload
setRefreshPosts(prev => prev + 1);
```

### PagePostFormModal
```typescript
const [showModal, setShowModal] = useState(false);
const [content, setContent] = useState("");
const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
const [visibility, setVisibility] = useState("public");
const [isSubmitting, setIsSubmitting] = useState(false);
```

### PagePostsList
```typescript
const [posts, setPosts] = useState<Post[]>([]);
const [loading, setLoading] = useState(true);
const [editingPostId, setEditingPostId] = useState<number | null>(null);
const [gallery, setGallery] = useState<{ postId: number; index: number } | null>(null);
```

## Props Reference

### PagePostFormModal
```typescript
interface PagePostFormProps {
  pageId: number;
  accessToken: string;
  onPostCreated?: () => void;
}
```

### PagePostsList
```typescript
interface PagePostsListProps {
  pageId: number;
  accessToken: string;
  canManage: boolean;
  onPostDeleted?: () => void;
  refreshTrigger?: number; // Increment to refresh
}
```

### PagePostEditModal
```typescript
interface PagePostEditModalProps {
  postId: number;
  pageId: number;
  accessToken: string;
  onClose: () => void;
  onPostUpdated: (post: Post) => void;
  onPostDeleted: (postId: number) => void;
}
```

## Styling Classes

### Card Container
```
rounded-3xl border border-gray-200 bg-white p-5 shadow-sm
```

### Button Styles
```
btn-primary          // Gold metallic button (existing)
border-gray-300      // Secondary border button
bg-red-600          // Delete/destructive action
```

### Form Elements
```
rounded-lg border border-gray-200 focus:ring-(--color-deep-navy)
```

### Media Grid
```
grid-cols-2 sm:grid-cols-3 gap-2
aspect-square | aspect-video
```

## Common Tasks

### Add custom styling to post card
Edit the div with `className="rounded-3xl border border-gray-200..."` in PagePostsList

### Change maximum media items
Edit `const MAX_MEDIA_ITEMS = 6` in PagePostFormModal/PagePostEditModal

### Modify API endpoints
Update paths in:
- `apiGet(\`/pages/${pageId}/posts/\`)`
- `apiPatch(\`/posts/${postId}/\`)`
- `apiDelete(\`/posts/${postId}/\`)`

### Add new post fields
1. Update Post type in `/lib/types.ts`
2. Add form field in PagePostFormModal
3. Include in payload when creating/updating
4. Display in post card in PagePostsList

## Performance Notes

- **Image Gallery**: Lazy loads - only loads when lightbox opened
- **Media Upload**: Handles multiple files in single request
- **Refresh Trigger**: Uses number increment (efficient)
- **Error Handling**: Toast notifications for user feedback
- **Loading States**: Spinners and disabled buttons during operations

## Mobile Responsive

| Viewport | Behavior |
|----------|----------|
| Mobile < 640px | Full-screen modal, single column layout |
| Tablet 640-1024px | Modal with constraints, 2-3 column grid |
| Desktop > 1024px | Centered modal, 3+ column layout |

## Testing Checklist

- [ ] Create post as admin
- [ ] Add media to post
- [ ] Change visibility settings
- [ ] Edit post content
- [ ] Delete post with confirmation
- [ ] View as non-admin user
- [ ] Open media in gallery
- [ ] Navigate gallery with arrows
- [ ] Mobile responsiveness
- [ ] Form validation (empty content)
- [ ] Error handling (network failure)

## Build & Deploy

```bash
# Build
npm run build

# Result
✓ Compiled successfully in ~17s
✓ All pages generated
```

## Future Enhancements

- Comment section on posts
- Like/react to posts
- Share posts
- Pin important posts
- Schedule posts for later
- Post analytics
- Rich text editor
- Mention users/pages
- Hashtag support

## Troubleshooting

### Posts not showing
1. Check API endpoint: `GET /pages/{id}/posts/`
2. Verify accessToken is valid
3. Check browser console for errors
4. Verify page ID is correct

### Form not submitting
1. Check content is not empty
2. Verify media upload succeeds
3. Check API endpoint: `POST /posts/`
4. Look for validation error messages

### Edit modal won't open
1. Verify canManage prop is true
2. Check postId is valid
3. Verify accessToken is still valid
4. Check `GET /posts/{id}/` endpoint

### Images not uploading
1. Check file size limits
2. Verify file format (JPEG/PNG/GIF)
3. Check upload endpoint: `POST /uploads/images/`
4. Verify FormData is being sent correctly

## Git History

```
commit c5b5672
Author: Agent
Date: [timestamp]

feat: Add page posts section with list display, edit/delete modals, and collapsible form
- PagePostsList: Display posts for all users
- PagePostEditModal: Edit/delete for admins
- PagePostFormModal: Create in compact card + modal
- Integration in pages/[id]/page.tsx
- Build: ✓ Successful in 17.4s
```

## Support & Questions

For issues or questions:
1. Check the implementation in `PAGE_POSTS_IMPLEMENTATION.md`
2. Review visual flows in `PAGE_POSTS_VISUAL_GUIDE.md`
3. Check API responses in browser Network tab
4. Review error messages in console

## Related Files

- `/frontend/app/app/pages/[id]/page.tsx` - Integration point
- `/frontend/lib/types.ts` - Post type definition
- `/frontend/lib/api.ts` - API client methods
- `/frontend/components/Toast.tsx` - Toast notifications
- `/frontend/components/ImageGallery.tsx` - Lightbox component
- `/frontend/components/ConfirmationDialog.tsx` - Delete confirmation
