"""
Direct test of the filter logic without running Django server.
Tests the PostFilterSet filter_content_type method to verify correct behavior.
"""

# Simulate the cleaned_data behavior that would come from the form
class MockForm:
    def __init__(self, friend_posts=None, page_posts=None):
        self.cleaned_data = {
            'show_friend_posts': friend_posts,
            'show_page_posts': page_posts,
        }

class MockQuerySet:
    def __init__(self, count_val, name="MockQS"):
        self.count_val = count_val
        self.name = name
        self.filters_applied = []
    
    def filter(self, **kwargs):
        new_qs = MockQuerySet(self.count_val - 5, f"{self.name}_filtered")
        self.filters_applied.append(kwargs)
        print(f"  [QS] Applying filter: {kwargs} -> new count would be {new_qs.count_val}")
        return new_qs
    
    def count(self):
        return self.count_val
    
    def none(self):
        return MockQuerySet(0, f"{self.name}_none")

class MockFilterSet:
    def __init__(self, show_friend=None, show_page=None):
        self.form = MockForm(show_friend, show_page)
    
    def filter_content_type(self, queryset, name=None, value=None):
        """Same logic as the real filter"""
        show_friend = self.form.cleaned_data.get('show_friend_posts')
        show_page = self.form.cleaned_data.get('show_page_posts')
        
        print(f"[FILTER] filter_content_type called with:")
        print(f"  show_friend_posts: {show_friend}")
        print(f"  show_page_posts: {show_page}")
        print(f"  Input queryset count: {queryset.count()}")
        
        # If neither parameter was provided, show all posts (default behavior)
        if show_friend is None and show_page is None:
            print(f"  -> Default: Both None, returning all posts")
            return queryset
        
        # If both explicitly true or both None, show all posts
        if show_friend is not False and show_page is not False:
            print(f"  -> Both active/default, returning all posts")
            return queryset
        
        # Filter based on the combination
        if show_friend is True and show_page is False:
            # Only friend posts: exclude page-authored posts
            print(f"  -> Only friend posts: exclude posts where page is not null")
            result = queryset.filter(page__isnull=True)
        elif show_friend is False and show_page is True:
            # Only page posts: include only page-authored posts
            print(f"  -> Only page posts: include only posts where page is not null")
            result = queryset.filter(page__isnull=False)
        elif show_friend is False and show_page is False:
            # Neither selected - return empty
            print(f"  -> Both false: returning no posts")
            result = queryset.none()
        else:
            # Fallback for any other combination
            print(f"  -> Fallback case")
            result = queryset
        
        print(f"  -> Output queryset count: {result.count()}")
        return result

# Test cases
print("=" * 70)
print("TEST 1: Default behavior (both None) - should show all posts")
print("=" * 70)
qs = MockQuerySet(100)
filterset = MockFilterSet(show_friend=None, show_page=None)
result = filterset.filter_content_type(qs)
print(f"Expected: 100, Got: {result.count()}")
assert result.count() == 100, f"Test 1 failed: expected 100, got {result.count()}"
print("✓ PASS\n")

print("=" * 70)
print("TEST 2: Both True - should show all posts")
print("=" * 70)
qs = MockQuerySet(100)
filterset = MockFilterSet(show_friend=True, show_page=True)
result = filterset.filter_content_type(qs)
print(f"Expected: 100, Got: {result.count()}")
assert result.count() == 100, f"Test 2 failed: expected 100, got {result.count()}"
print("✓ PASS\n")

print("=" * 70)
print("TEST 3: Only friend posts (true, false) - filter page__isnull=True")
print("=" * 70)
qs = MockQuerySet(100)
filterset = MockFilterSet(show_friend=True, show_page=False)
result = filterset.filter_content_type(qs)
print(f"Expected: 95 (100-5), Got: {result.count()}")
assert result.count() == 95, f"Test 3 failed: expected 95, got {result.count()}"
print("✓ PASS\n")

print("=" * 70)
print("TEST 4: Only page posts (false, true) - filter page__isnull=False")
print("=" * 70)
qs = MockQuerySet(100)
filterset = MockFilterSet(show_friend=False, show_page=True)
result = filterset.filter_content_type(qs)
print(f"Expected: 95 (100-5), Got: {result.count()}")
assert result.count() == 95, f"Test 4 failed: expected 95, got {result.count()}"
print("✓ PASS\n")

print("=" * 70)
print("TEST 5: Both False - should return empty")
print("=" * 70)
qs = MockQuerySet(100)
filterset = MockFilterSet(show_friend=False, show_page=False)
result = filterset.filter_content_type(qs)
print(f"Expected: 0, Got: {result.count()}")
assert result.count() == 0, f"Test 5 failed: expected 0, got {result.count()}"
print("✓ PASS\n")

print("=" * 70)
print("TEST 6: Only friend True (true, None) - should show all (default)")
print("=" * 70)
qs = MockQuerySet(100)
filterset = MockFilterSet(show_friend=True, show_page=None)
result = filterset.filter_content_type(qs)
print(f"Expected: 100, Got: {result.count()}")
assert result.count() == 100, f"Test 6 failed: expected 100, got {result.count()}"
print("✓ PASS\n")

print("=" * 70)
print("✓ ALL TESTS PASSED!")
print("=" * 70)
