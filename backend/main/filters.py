"""
Django filters for feed filtering using django-filter package.

This module provides FilterSet classes for filtering Post objects based on user preferences
(friend posts vs page posts, page categories, etc.)

Definitions:
- Friend posts: Posts where page__isnull=True (user-authored, not page-authored)
- Page posts: Posts where page__isnull=False (page-authored)
"""

import django_filters
from django import forms
from django.db.models import Q
from main.models import Post, UserFeedPreference, Page


class PostFilterForm(forms.Form):
    """Custom form for PostFilterSet to handle boolean filter values properly"""
    show_friend_posts = django_filters.BooleanFilter.field_class(
        required=False,
        label='Show friend posts'
    )
    show_page_posts = django_filters.BooleanFilter.field_class(
        required=False,
        label='Show page posts'
    )
    preferred_categories = forms.CharField(
        required=False,
        label='Preferred categories'
    )


class PostFilterSet(django_filters.FilterSet):
    """
    FilterSet for Post model to handle feed filtering based on URL query parameters.
    
    Query Parameters:
    - show_friend_posts: 'true' or 'false' (or '1'/'0') - Include posts where page is null (user-authored)
    - show_page_posts: 'true' or 'false' (or '1'/'0') - Include posts where page is not null (page-authored)
    - preferred_categories: category code - Filter page posts by specific category
    
    Example URLs:
    - /feed/?show_friend_posts=true&show_page_posts=false  (only friend posts)
    - /feed/?show_friend_posts=false&show_page_posts=true  (only page posts)
    - /feed/?preferred_categories=tech  (posts in tech category)
    """
    
    show_friend_posts = django_filters.BooleanFilter(
        method='filter_content_type',
        label='Show friend posts'
    )
    
    show_page_posts = django_filters.BooleanFilter(
        method='filter_content_type',
        label='Show page posts'
    )
    
    preferred_categories = django_filters.CharFilter(
        method='filter_by_category',
        label='Preferred categories'
    )
    
    class Meta:
        model = Post
        fields = []  # We're using custom filter methods
        form = PostFilterForm
    
    def filter_content_type(self, queryset, name, value):
        """
        Filter posts based on content type (friend posts vs page posts).
        
        This is called once per filter, but we need both parameters together.
        We use form.cleaned_data to access both values simultaneously.
        
        Definitions:
        - Friend posts: Posts from users in the current user's friend list
        - Page posts: Posts authored by pages (page field is not null)
        """
        # Get both parameters from the form's cleaned data
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
    
    def filter_by_category(self, queryset, name, value):
        """
        Filter page posts by preferred category.
        When a category is selected:
        - Show page posts from that category
        - Show all friend posts (because category filter only applies to pages)
        """
        if not value:
            print(f"[FILTER] filter_by_category: no category provided, returning all posts")
            return queryset
        
        print(f"[FILTER] filter_by_category: filtering by category='{value}'")
        print(f"  Input queryset count: {queryset.count()}")
        
        # Filter to show:
        # - Page posts from the selected category, OR
        # - All friend posts (page__isnull=True)
        from django.db.models import Q
        result = queryset.filter(
            Q(page__category=value) | Q(page__isnull=True)
        )
        
        print(f"  Output queryset count: {result.count()}")
        return result


