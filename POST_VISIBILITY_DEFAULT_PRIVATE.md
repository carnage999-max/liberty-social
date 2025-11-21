# Post Visibility Default Changed to Private

## Summary
Updated the default post visibility setting to "private" across all post creation components in the application (both regular posts and page posts).

## Changes Made

### Files Updated: 4

#### 1. `/frontend/components/layout/AppShell.tsx`
**Component:** CreatePostModal (regular posts)
**Changes:**
- Line 906: Initial state changed from `"public"` to `"only_me"`
- Line 958: Reset form changed from `"public"` to `"only_me"`

**Rationale:** Regular user posts now create as private by default (only_me = visible to user only)

#### 2. `/frontend/components/pages/PagePostFormModal.tsx`
**Component:** PagePostFormModal (page post creation)
**Changes:**
- Line 22: Initial state changed from `"public"` to `"private"`
- Line 34: Reset form changed from `"public"` to `"private"`

**Rationale:** Page posts created by admins now default to private visibility

#### 3. `/frontend/components/pages/PagePostEditModal.tsx`
**Component:** PagePostEditModal (page post editing)
**Changes:**
- Line 47: Initial state changed from `"public"` to `"private"`

**Rationale:** When editing posts, default assumes private unless specified otherwise

#### 4. `/frontend/components/pages/PagePostForm.tsx`
**Component:** PagePostForm (legacy page post form, kept for compatibility)
**Changes:**
- Line 21: Initial state changed from `"public"` to `"private"`
- Line 33: Reset form changed from `"public"` to `"private"`

**Rationale:** Legacy form maintains consistency with new modals

## Visibility Type Reference

Two different visibility type systems exist in the application:

### Regular Posts (AppShell.tsx)
Uses `Visibility` type from `/lib/types.ts`:
- `"public"` - Visible to all users
- `"friends"` - Visible to friends only
- `"only_me"` - Visible to user only (PRIVATE) ✅ NEW DEFAULT

### Page Posts (PagePost*.tsx)
Uses custom type:
- `"public"` - Visible to all users
- `"followers"` - Visible to page followers
- `"private"` - Visible to page owner/admins only (PRIVATE) ✅ NEW DEFAULT

## User Impact

### Before Change
- Users creating posts: Posts were **public** by default
- Page admins creating posts: Posts were **public** by default
- Potential privacy concern: Users might accidentally share private thoughts publicly

### After Change
- Users creating posts: Posts are now **private** (only_me) by default
- Page admins creating posts: Posts are now **private** by default
- Better privacy by default: Users must explicitly choose to share publicly
- Users can still easily change visibility via dropdown before posting

## Visibility Selection Flow

### When Creating a Post

**Regular Post (AppShell):**
```
1. User clicks "Create Post" button
2. Modal opens with default: "Only Me"
3. User can change via dropdown: Public | Friends | Only Me
4. User writes content and posts
5. Post created with selected visibility
```

**Page Post (PagePostFormModal):**
```
1. Admin clicks "Post" button on compact card
2. Modal opens with default: "Private"
3. Admin can change via dropdown: Public | Followers | Private
4. Admin writes content and posts
5. Post created with selected visibility
```

### When Editing a Post

**Page Post Edit (PagePostEditModal):**
```
1. Admin clicks manage (⋮) button on post
2. Edit modal opens with current post visibility
3. If visibility was not previously set: defaults to "Private"
4. Admin can change and update post
```

## Form Reset Behavior

When users cancel or submit a form, the visibility resets to the new defaults:
- Regular posts: `"only_me"`
- Page posts: `"private"`

This ensures consistent defaults for subsequent posts.

## Backward Compatibility

✅ **Fully Backward Compatible**
- Existing public posts remain public
- No changes to post data storage
- No changes to API behavior
- Only affects NEW posts created after this change
- Users can still choose any visibility option

## Testing Checklist

- [x] Build compiles successfully
- [x] Regular post creation defaults to "Only Me"
- [x] Page post creation defaults to "Private"
- [x] Can still select other visibility options
- [x] Form resets to new defaults after canceling
- [x] Form resets to new defaults after posting
- [x] Edit modal handles visibility correctly
- [x] No regressions in post creation flow

## Build Results

```
✓ Compiled successfully in 21.3s
✓ Generating static pages (29/29)
```

## API Endpoints (No Changes)

Posts are still created via the same endpoints with the same structure:
- `POST /posts/` - Regular posts with visibility field
- `POST /posts/` - Page posts with visibility field

The visibility is simply sent with a different default value.

## Git Commit

```
commit a2144a6
feat: Change default post visibility to private

Updated default visibility setting across all post creation components:
- AppShell: public → only_me (regular posts)
- PagePostFormModal: public → private (page post creation)
- PagePostEditModal: public → private (page post editing)
- PagePostForm: public → private (legacy form)

All resetForm() methods updated to match new defaults.
```

## Related Documentation

- `/PAGE_POSTS_IMPLEMENTATION.md` - Complete page posts feature docs
- `/PAGE_POSTS_COMPLETE_SUMMARY.md` - Page posts overview
- `/FIXES_PAGE_DETAIL_STYLING.md` - Recent styling fixes

## Future Considerations

1. **User Settings:** Consider adding a user preference for default visibility
2. **Templates:** Could offer different templates with pre-configured defaults
3. **Warnings:** Could warn users before posting publicly
4. **Analytics:** Track public vs. private post distribution

## Rollback Information

If needed to revert:
```bash
# Revert to previous visibility defaults
git revert a2144a6
```

Changes would be straightforward as they're only state initialization values.
