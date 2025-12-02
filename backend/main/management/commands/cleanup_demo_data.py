"""
Django management command to clean up demo data created by setup_demo_data.

Usage:
    python manage.py cleanup_demo_data
    python manage.py cleanup_demo_data --confirm
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from main.models import Post, Message, Conversation, Page, MarketplaceListing
from main.animal_models import AnimalListing

User = get_user_model()


class Command(BaseCommand):
    help = "Clean up all demo data created by setup_demo_data command"

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Skip confirmation prompt and delete immediately",
        )

    def handle(self, *args, **options):
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.WARNING("🗑️  DEMO DATA CLEANUP"))
        self.stdout.write("=" * 60 + "\n")

        # Define demo user emails
        demo_emails = [
            "sarah.johnson@demo.com",
            "michael.chen@demo.com",
            "emma.williams@demo.com",
            "james.davis@demo.com",
            "olivia.martinez@demo.com",
        ]

        # Count what will be deleted
        demo_users = User.objects.filter(email__in=demo_emails)
        user_count = demo_users.count()

        # Get counts for related data
        post_count = Post.objects.filter(author__in=demo_users).count()

        # Count conversations where any participant is a demo user
        from main.models import ConversationParticipant

        conversation_ids = set(
            ConversationParticipant.objects.filter(user__in=demo_users).values_list(
                "conversation_id", flat=True
            )
        )
        conversation_count = len(conversation_ids)

        # Count messages in those conversations
        message_count = Message.objects.filter(
            conversation_id__in=conversation_ids
        ).count()

        # Count pages created by demo users
        page_count = Page.objects.filter(created_by__in=demo_users).count()

        # Count marketplace listings
        marketplace_count = MarketplaceListing.objects.filter(
            seller__in=demo_users
        ).count()

        # Count animal listings
        animal_count = AnimalListing.objects.filter(seller__in=demo_users).count()

        if user_count == 0:
            self.stdout.write(
                self.style.SUCCESS("✅ No demo data found. Database is clean!\n")
            )
            return

        # Display what will be deleted
        self.stdout.write("📊 Found the following demo data:\n")
        self.stdout.write(f"   👥 Users: {user_count}")
        self.stdout.write(f"   📝 Posts: {post_count}")
        self.stdout.write(f"   💬 Conversations: {conversation_count}")
        self.stdout.write(f"   📨 Messages: {message_count}")
        self.stdout.write(f"   🏢 Business Pages: {page_count}")
        self.stdout.write(f"   🛍️  Marketplace Listings: {marketplace_count}")
        self.stdout.write(f"   🐾 Animal Listings: {animal_count}")
        self.stdout.write("\n")

        # Confirmation prompt
        if not options["confirm"]:
            self.stdout.write(
                self.style.WARNING(
                    "⚠️  WARNING: This will permanently delete all demo data!"
                )
            )
            self.stdout.write("")
            confirm = input(
                'Are you sure you want to continue? Type "yes" to confirm: '
            )

            if confirm.lower() != "yes":
                self.stdout.write(self.style.ERROR("\n❌ Cleanup cancelled.\n"))
                return

        self.stdout.write("\n🗑️  Starting cleanup...\n")

        # Delete in order (respecting foreign key constraints)

        # 1. Delete messages first
        deleted_messages = Message.objects.filter(
            conversation_id__in=conversation_ids
        ).delete()
        self.stdout.write(f"   ✓ Deleted {deleted_messages[0]} messages")

        # 2. Delete conversations
        deleted_conversations = Conversation.objects.filter(
            id__in=conversation_ids
        ).delete()
        self.stdout.write(f"   ✓ Deleted {deleted_conversations[0]} conversations")

        # 3. Delete posts (and their likes, comments via CASCADE)
        deleted_posts = Post.objects.filter(author__in=demo_users).delete()
        self.stdout.write(
            f"   ✓ Deleted {deleted_posts[0]} posts (and related likes/comments)"
        )

        # 4. Delete animal listings
        deleted_animals = AnimalListing.objects.filter(seller__in=demo_users).delete()
        self.stdout.write(f"   ✓ Deleted {deleted_animals[0]} animal listings")

        # 5. Delete marketplace listings
        deleted_marketplace = MarketplaceListing.objects.filter(
            seller__in=demo_users
        ).delete()
        self.stdout.write(f"   ✓ Deleted {deleted_marketplace[0]} marketplace listings")

        # 6. Delete business pages
        deleted_pages = Page.objects.filter(created_by__in=demo_users).delete()
        self.stdout.write(f"   ✓ Deleted {deleted_pages[0]} business pages")

        # 7. Finally delete users (friendships will CASCADE)
        deleted_users = demo_users.delete()
        self.stdout.write(f"   ✓ Deleted {deleted_users[0]} users (and friendships)")

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("✅ CLEANUP COMPLETE!"))
        self.stdout.write("=" * 60)
        self.stdout.write("")
        self.stdout.write("📊 Summary:")
        self.stdout.write(f"   • {user_count} demo users removed")
        self.stdout.write(f"   • {post_count} posts removed")
        self.stdout.write(f"   • {conversation_count} conversations removed")
        self.stdout.write(f"   • {message_count} messages removed")
        self.stdout.write(f"   • {page_count} business pages removed")
        self.stdout.write(f"   • {marketplace_count} marketplace listings removed")
        self.stdout.write(f"   • {animal_count} animal listings removed")
        self.stdout.write("")
        self.stdout.write("🎯 Database is now clean of all demo data!")
        self.stdout.write("")
