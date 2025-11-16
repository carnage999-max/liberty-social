#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'liberty_social.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from main.models import Post
from users.models import Friends, User
from django.db.models import Q

# Get any user
user = User.objects.first()
if not user:
    print("No users exist")
    sys.exit(1)

print(f"User: {user.username}")

# Check friend ids
friend_ids = list(Friends.objects.filter(user=user).values_list("friend_id", flat=True))
print(f"Friend IDs: {friend_ids}")

# Check posts visible to this user
base_qs = Post.objects.filter(
    Q(visibility="public")
    | Q(author=user)
    | Q(author__id__in=friend_ids, visibility="friends"),
    deleted_at__isnull=True
)
print(f"Base queryset posts: {base_qs.count()}")

# Check friend posts (page__isnull=True)
friend_posts = base_qs.filter(page__isnull=True).count()
print(f"Friend posts (page__isnull=True): {friend_posts}")

# Check page posts (page__isnull=False)
page_posts = base_qs.filter(page__isnull=False).count()
print(f"Page posts (page__isnull=False): {page_posts}")

# Show actual friend posts
print("\nFriend posts details:")
for post in base_qs.filter(page__isnull=True)[:5]:
    print(f"  - Post {post.id} by {post.author.username}: {post.content[:50]}")
