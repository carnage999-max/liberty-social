# Feed Filters - Complete Rebuild

## Overview
The feed filter system has been completely rebuilt from scratch to properly align with the django-filters backend implementation.

## Backend Understanding (Django Filters)

The backend uses `PostFilterSet` with the following query parameters:

### Query Parameters
1. **show_friend_posts** (boolean): Whether to include friend posts (posts where `page__isnull=True`)
2. **show_page_posts** (boolean): Whether to include page posts (posts where `page__isnull=False`)
3. **preferred_categories** (string): Optional category code to filter page posts

### Backend Filter Logic

```
if show_friend=true, show_page=true:
  → Show ALL posts (default)

if show_friend=true, show_page=false:
  → Show ONLY friend posts (page__isnull=True)

if show_friend=false, show_page=true:
  → Show ONLY page posts (page__isnull=False)

if show_friend=false, show_page=false:
  → Show NO posts (empty feed)

if preferred_categories=<code>:
  → Show page posts from that category + ALL friend posts
```

## Frontend Implementation

### FeedFilters Component (`frontend/components/FeedFilters.tsx`)

**Key Features:**
- **Simplified state management**: Uses simple boolean toggles for friend/page posts
- **Built-in category choices**: Hardcoded CATEGORY_CHOICES matching backend's Page.CATEGORY_CHOICES
- **Direct useEffect**: Notifies parent component on every state change
- **No dependency on useFeedPreferences hook**: Eliminates async/timing issues

**State Variables:**
- `friendPostsActive`: Boolean - whether friend posts are shown
- `pagePostsActive`: Boolean - whether page posts are shown
- `selectedCategory`: Optional string - selected category code
- `categoryDropdownOpen`: Boolean - dropdown visibility

**Callback Pattern:**
Uses a single useEffect that fires whenever any filter changes:
```tsx
useEffect(() => {
  onFiltersChange({
    showFriendPosts: friendPostsActive,
    showPagePosts: pagePostsActive,
    selectedCategory,
  });
}, [friendPostsActive, pagePostsActive, selectedCategory, onFiltersChange]);
```

### Feed Page Component (`frontend/app/app/feed/page.tsx`)

**Filter State:**
```tsx
const [showFriendPosts, setShowFriendPosts] = useState(true);
const [showPagePosts, setShowPagePosts] = useState(true);
const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
```

**loadFeed Function:**
- Accepts optional `filters` parameter with override values
- Builds query parameters based on current filter state:
  - Only sends params if they differ from default (both true, no category)
  - Always includes both `show_friend_posts` and `show_page_posts` when any filter is active

**Filter Change Callback:**
```tsx
<FeedFilters onFiltersChange={(filters) => {
  setShowFriendPosts(filters.showFriendPosts);
  setShowPagePosts(filters.showPagePosts);
  setSelectedCategory(filters.selectedCategory);
  // Reload feed with new filters
  loadFeed(undefined, false, filters);
}} />
```

## Filter Scenarios

### Scenario 1: Page Load (Default)
- User clicks "Your Feed"
- No filters active: `showFriendPosts=true, showPagePosts=true, no category`
- Backend call: `/feed/` (no query params)
- Result: Shows all public posts, user's own posts, friends' posts, and all page posts

### Scenario 2: Click "Friends" Button
- Initial state: Both toggles ON
- User clicks "Friends" toggle → turns OFF
- State becomes: `showFriendPosts=true, showPagePosts=false`
- Backend call: `/feed/?show_friend_posts=true&show_page_posts=false`
- Result: Shows ONLY friend posts (page__isnull=True)
- UI: Friends button stays highlighted, Pages button becomes inactive

### Scenario 3: Click "Pages" Button
- Initial state: Both toggles ON
- User clicks "Pages" toggle → turns OFF
- State becomes: `showFriendPosts=false, showPagePosts=true`
- Backend call: `/feed/?show_friend_posts=false&show_page_posts=true`
- Result: Shows ONLY page posts (page__isnull=False)
- UI: Pages button stays highlighted, Friends button becomes inactive

### Scenario 4: Select Category
- User clicks category dropdown and selects "Technology"
- State becomes: `showFriendPosts=true, showPagePosts=true, selectedCategory='tech'`
- Backend call: `/feed/?show_friend_posts=true&show_page_posts=true&preferred_categories=tech`
- Result: Shows page posts from tech category + all friend posts
- UI: "Filters active" badge appears

### Scenario 5: Both Toggles OFF
- User clicks Friends to deactivate, then Pages to deactivate
- State becomes: `showFriendPosts=false, showPagePosts=false`
- Backend call: `/feed/?show_friend_posts=false&show_page_posts=false`
- Result: Shows NO posts (queryset.none())
- UI: Both buttons inactive, empty feed with "Reset filters" option

## Key Improvements

1. **Alignment with Backend**: Query parameters now exactly match django-filters expectations
2. **Simplified State Management**: No more complex handleFilterChange logic with ?? operators
3. **Eliminated Race Conditions**: useEffect ensures filters are always correctly communicated
4. **Direct Category Mapping**: Categories are hardcoded in frontend, matching backend choices
5. **Clearer Intent**: Toggle buttons directly reflect filter logic
6. **Better Debugging**: Straightforward parameter building in loadFeed

## Testing Checklist

- [ ] Load page → sees all posts
- [ ] Click "Friends" → sees only friend posts
- [ ] Click "Pages" → sees only page posts  
- [ ] Select category → sees category posts + friend posts
- [ ] Deselect category → reverts to previous filter state
- [ ] Toggle multiple filters → correctly combines filters
- [ ] Pagination with filters works → "Load More" maintains filter state
- [ ] Empty results show appropriate message

## URL Examples

```
Default:     /feed/
Friends:     /feed/?show_friend_posts=true&show_page_posts=false
Pages:       /feed/?show_friend_posts=false&show_page_posts=true
Category:    /feed/?show_friend_posts=true&show_page_posts=true&preferred_categories=tech
Empty:       /feed/?show_friend_posts=false&show_page_posts=false
```
