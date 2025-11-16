"""
Django filters for feed filtering using django-filter package.

This module provides FilterSet classes for filtering Post objects based on user preferences
(friend posts vs page posts, page categories, etc.)
"""

import django_filters
from django.db.models import Q
from main.models import Post, UserFeedPreference, Page


class PostFilterSet(django_filters.FilterSet):
    """
    FilterSet for Post model to handle feed filtering based on user preferences.
    
    Filters:
    - show_friend_posts: Show posts where page is null (user-authored)
    - show_page_posts: Show posts where page is not null (page-authored)
    - preferred_categories: Filter page posts by category
    - show_other_categories: Include posts from categories not in preferred list
    """
    
    show_friend_posts = django_filters.BooleanFilter(
        method='filter_show_friend_posts',
        label='Show friend posts'
    )
    
    show_page_posts = django_filters.BooleanFilter(
        method='filter_show_page_posts',
        label='Show page posts'
    )
    
    preferred_categories = django_filters.CharFilter(
        method='filter_preferred_categories',
        label='Preferred categories'
    )
    
    show_other_categories = django_filters.BooleanFilter(
        method='filter_show_other_categories',
        label='Show other categories'
    )
    
    class Meta:
        model = Post
        fields = []  # We're using custom filter methods
    
    def filter_show_friend_posts(self, queryset, name, value):
        """
        Filter posts based on show_friend_posts preference.
        
        Friend posts are posts where page is null (user-authored posts).
        """
        if value is None:
            return queryset
        
        # Get the current request user
        request = self.request
        if not request or not request.user or not request.user.is_authenticated:
            return queryset
        
        try:
            prefs = UserFeedPreference.objects.get(user=request.user)
        except UserFeedPreference.DoesNotExist:
            return queryset
        
        # Determine if we should filter based on both preferences
        show_friend = prefs.show_friend_posts
        show_page = prefs.show_page_posts
        
        if show_friend and show_page:
            # Show both - no filtering needed for content type
            return queryset
        elif show_friend and not show_page:
            # Show only friend posts (page is null)
            return queryset.filter(page__isnull=True)
        elif not show_friend and show_page:
            # Show only page posts (page is not null)
            return queryset.filter(page__isnull=False)
        else:
            # Both false - show nothing
            return queryset.none()
    
    def filter_show_page_posts(self, queryset, name, value):
        """
        Filter posts based on show_page_posts preference.
        This is handled in filter_show_friend_posts for mutual exclusivity.
        """
        # The logic is handled in filter_show_friend_posts to maintain
        # the mutually exclusive nature of the two filters
        return queryset
    
    def filter_preferred_categories(self, queryset, name, value):
        """
        Filter page posts by preferred categories.
        """
        if not value:
            return queryset
        
        request = self.request
        if not request or not request.user or not request.user.is_authenticated:
            return queryset
        
        try:
            prefs = UserFeedPreference.objects.get(user=request.user)
        except UserFeedPreference.DoesNotExist:
            return queryset
        
        if not prefs.preferred_categories:
            return queryset
        
        # Filter by page categories (only applies to page posts)
        category_filter = Q(page__category__in=prefs.preferred_categories)
        
        if prefs.show_other_categories:
            # Include posts without pages (friend posts are always included)
            category_filter |= Q(page__isnull=True)
        
        return queryset.filter(category_filter)
    
    def filter_show_other_categories(self, queryset, name, value):
        """
        Filter based on whether to show posts from non-preferred categories.
        This is handled in filter_preferred_categories.
        """
        # The logic is handled in filter_preferred_categories
        return queryset
