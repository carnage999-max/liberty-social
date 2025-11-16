# Feed Filter Issue - Debugging Guide

## Problem
When filtering to show only "Friend Posts", the backend returns no posts even though the user has friends that have posted.

## Root Cause Analysis

The backend has debug logging enabled to help identify the issue. Check your server logs when making requests to the feed endpoint.

### Expected Behavior
1. **Base Queryset Should Include:**
   - All public posts
   - User's own posts
   - Friends' posts with `visibility="friends"`

2. **When `show_friend_posts=true&show_page_posts=false` is sent:**
   - Backend filters to posts where `page__isnull=True`
   - This SHOULD show all friend posts from the base queryset

### Debug Output Location
Enable Django debug mode and check your console output for log lines starting with `[DEBUG]`:

```
[DEBUG] NewsFeedView.get() - user: <username>
[DEBUG] Query params: <parameters>
[DEBUG] Friend IDs: [<list of friend IDs>]
[DEBUG] Base queryset count: <number>
[DEBUG] After block exclusion: <number>
[DEBUG] filter_content_type called: show_friend=<bool>, show_page=<bool>
[DEBUG] <filter action message>
[DEBUG] After filter: <number>
```

### Possible Issues to Check

1. **No friends data:**
   - If "Friend IDs: []" is empty, the user has no friends
   - The friends relationship might not be set up correctly
   - Check if the friendship is bidirectional or unidirectional

2. **No friend posts in base queryset:**
   - If "Base queryset count: 0" even though friends exist
   - The friends' posts might all have `visibility="only_me"`
   - Or the friends haven't posted yet

3. **Filter not recognizing boolean parameters:**
   - If "filter_content_type called: show_friend=None, show_page=None"
   - The query parameters aren't being parsed correctly
   - Django-filters might not recognize "true"/"false" strings

4. **Filter applying incorrectly:**
   - Compare "Base queryset count" with "After filter" count
   - If both are the same, the filter isn't working
   - Check which debug line is being printed

## How django-filters BooleanFilter Works

Django-filters' BooleanFilter accepts:
- Strings: "true", "false", "on", "off", "yes", "no"
- Numbers: "1", "0"
- None (parameter not provided)

When a BooleanFilter doesn't recognize the value, it treats it as None (parameter not provided).

## Next Steps

1. **Run the frontend and open browser DevTools**
   - Go to Network tab
   - Click the Friends filter button
   - Check the request URL - should be `/feed/?show_friend_posts=true&show_page_posts=false`

2. **Check backend server logs**
   - Look for the debug output
   - Identify which check is failing

3. **Verify test data:**
   - Ensure users have friends
   - Ensure those friends have created posts
   - Ensure those posts have appropriate visibility levels

## Query Examples

### Default (All Posts)
```
GET /feed/
```
Returns: Public posts + own posts + friends' "friends-visibility" posts

### Only Friend Posts
```
GET /feed/?show_friend_posts=true&show_page_posts=false
```
Returns: Posts where `page__isnull=True` (any user-authored post visible to the user)

### Only Page Posts
```
GET /feed/?show_friend_posts=false&show_page_posts=true
```
Returns: Posts where `page__isnull=False` (page-authored posts)

## Code Changes Made

1. **filters.py**: Added debug print statements to `filter_content_type()`
2. **views.py**: Added debug print statements to `NewsFeedView.get()`
3. **views.py**: Added explicit field names to BooleanFilters for better form handling

## How to Disable Debug Output

Once issues are identified, remove the `print()` statements:
- In `main/filters.py`: Remove all lines starting with `print(f"[DEBUG]`
- In `main/views.py`: Remove all lines starting with `print(f"[DEBUG]`
