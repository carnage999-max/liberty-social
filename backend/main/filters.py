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
    FilterSet for Post model to handle feed filtering based on URL query parameters.
    
    Query Parameters:
    - show_friend_posts: 'true' or 'false' - Include posts where page is null (user-authored)
    - show_page_posts: 'true' or 'false' - Include posts where page is not null (page-authored)
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
    
    def filter_content_type(self, queryset, name, value):
        """
        Filter posts based on content type (friend posts vs page posts).
        This method handles both show_friend_posts and show_page_posts filters.
        
        The filtering is done based on BOTH parameters together (mutually exclusive logic).
        """
        # Get both parameters from query string
        show_friend = self.form.cleaned_data.get('show_friend_posts')
        show_page = self.form.cleaned_data.get('show_page_posts')
        
        # If neither parameter was provided, show all posts
        if show_friend is None and show_page is None:
            return queryset
        
        # If both are True or both are None, show all posts
        if (show_friend is True and show_page is True) or (show_friend is None and show_page is None):
            return queryset
        
        # If only friend posts requested
        if show_friend is True and show_page is False:
            return queryset.filter(page__isnull=True)
        
        # If only page posts requested
        if show_friend is False and show_page is True:
            return queryset.filter(page__isnull=False)
        
        # If both false, return nothing
        if show_friend is False and show_page is False:
            return queryset.none()
        
        return queryset
    
    def filter_by_category(self, queryset, name, value):
        """
        Filter page posts by preferred category.
        """
        if not value:
            return queryset
        
        # Filter by page category
        # Include both the specific category and friend posts (posts with no page)
        return queryset.filter(
            Q(page__category=value) | Q(page__isnull=True)
        )
