import random
from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from main.models import Bookmark, Comment, Post, PostMedia, Reaction
from users.models import BlockedUsers, Friends, FriendRequest, User, UserSettings


LOREM_SNIPPETS = [
    "Thrilled to be part of Liberty Social. Let's build something generous together.",
    "Exploring new communities today. Any recommendations?",
    "Remember to take breaks while you grind. Balance helps the work shine.",
    "Trying out the new post composer - absolutely love the gradient preview.",
    "Who else is experimenting with long-form updates this week?",
]



REACTION_TYPES = ["like", "love", "haha", "sad", "angry"]


class Command(BaseCommand):
    help = "Populate the database with demo users, friendships, posts, and interactions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--users",
            type=int,
            default=8,
            help="How many demo users to ensure exist (default: 8).",
        )
        parser.add_argument(
            "--posts",
            type=int,
            default=20,
            help="Approximate number of posts to seed across users (default: 20).",
        )
        parser.add_argument(
            "--reset-posts",
            action="store_true",
            help="Remove previously seeded demo posts before creating new ones.",
        )

    def handle(self, *args, **options):
        random.seed(2025)
        users_target = options["users"]
        posts_target = options["posts"]
        reset_posts = options["reset_posts"]

        with transaction.atomic():
            users = self._ensure_users(users_target)
            self.stdout.write(self.style.SUCCESS(f"Ensured {len(users)} users."))

            if reset_posts:
                Post.objects.filter(content__icontains="Liberty Social demo").delete()
                self.stdout.write(self.style.WARNING("Cleared previous demo posts."))

            self._ensure_friendships(users)
            self.stdout.write(self.style.SUCCESS("Friend graph prepared."))

            self._seed_posts(users, posts_target)
            self.stdout.write(self.style.SUCCESS("Posts and media ready."))

            self._seed_comments_and_reactions(users)
            self.stdout.write(self.style.SUCCESS("Comments and reactions created."))

            self._seed_bookmarks(users)
            self.stdout.write(self.style.SUCCESS("Bookmarks updated."))

            self._seed_blocks(users)
            self.stdout.write(self.style.SUCCESS("Sample blocks and friend requests created."))

        self.stdout.write(self.style.SUCCESS("Demo data seeding complete."))

    def _ensure_users(self, count: int) -> list[User]:
        base_names = [
            ("Avery", "Stone"),
            ("Jordan", "Rivera"),
            ("Sky", "Nguyen"),
            ("Morgan", "Lee"),
            ("Emerson", "Knight"),
            ("Dakota", "Hart"),
            ("Harper", "Vale"),
            ("Rowan", "Brooks"),
            ("Quinn", "Summers"),
            ("Riley", "Frost"),
        ]

        created_users: list[User] = []
        for idx in range(count):
            first, last = base_names[idx % len(base_names)]
            username = f"{first.lower()}{idx}"
            email = f"{username}@demo.liberty"
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": username,
                    "first_name": first,
                    "last_name": last,
                },
            )
            if created:
                user.set_password("changeme123")
                user.save()
            UserSettings.objects.get_or_create(user=user)
            created_users.append(user)
        return created_users

    def _ensure_friendships(self, users: list[User]) -> None:
        # create basic friendships in a ring so everyone has at least two connections
        total = len(users)
        for idx, user in enumerate(users):
            friend_a = users[(idx + 1) % total]
            friend_b = users[(idx - 1) % total]
            for friend in {friend_a, friend_b}:
                Friends.objects.get_or_create(user=user, friend=friend)

    def _seed_posts(self, users: list[User], posts_target: int) -> None:
        now = timezone.now()
        posts_per_user = max(1, posts_target // max(1, len(users)))

        for user in users:
            existing_posts = Post.objects.filter(author=user, content__icontains="Liberty Social demo").count()
            to_create = max(0, posts_per_user - existing_posts)
            for idx in range(to_create):
                created_at = now - timedelta(hours=random.randint(1, 120))
                content = f"Liberty Social demo #{idx + 1}: {random.choice(LOREM_SNIPPETS)}"
                post = Post.objects.create(
                    author=user,
                    content=content,
                    visibility=random.choice(["public", "friends"]),
                )
                Post.objects.filter(pk=post.pk).update(
                    created_at=created_at,
                    updated_at=created_at,
                )
                post.refresh_from_db()
                if random.random() < 0.3:
                    PostMedia.objects.create(
                        post=post,
                        url="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200",
                    )

    def _seed_comments_and_reactions(self, users: list[User]) -> None:
        posts = list(Post.objects.all())
        if not posts:
            return
        post_ct = ContentType.objects.get_for_model(Post)
        for post in posts:
            commenters = random.sample(users, k=min(3, len(users)))
            for commenter in commenters:
                Comment.objects.get_or_create(
                    post=post,
                    author=commenter,
                    defaults={
                        "content": f"Loving this update, {post.author.first_name}!",
                    },
                )
                if random.random() < 0.6:
                    Reaction.objects.update_or_create(
                        content_type=post_ct,
                        object_id=post.id,
                        user=commenter,
                        defaults={"reaction_type": random.choice(REACTION_TYPES)},
                    )

    def _seed_bookmarks(self, users: list[User]) -> None:
        sample_posts = list(Post.objects.order_by("-created_at")[:10])
        if not sample_posts:
            return
        for user in users:
            chosen = random.sample(sample_posts, k=min(3, len(sample_posts)))
            for post in chosen:
                Bookmark.objects.get_or_create(user=user, post=post)

    def _seed_blocks(self, users: list[User]) -> None:
        if len(users) < 3:
            return
        user_a, user_b, *_ = users
        BlockedUsers.objects.get_or_create(user=user_a, blocked_user=user_b)
        FriendRequest.objects.get_or_create(
            from_user=user_b,
            to_user=user_a,
            defaults={
                "status": "pending",
            },
        )

