"""
Django management command to populate demo data for Google Play Store screenshots.

Usage:
    python manage.py setup_demo_data

This will create:
- Demo users with professional profiles
- Sample posts for the feed
- Sample messages between users
- Marketplace listings (general + animal)
- Business pages
- Friend connections
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from main.models import Post, Conversation, Message, Page
from main.marketplace_models import MarketplaceListing
from main.animal_models import AnimalListing
from users.models import FriendRequest
import random

User = get_user_model()


class Command(BaseCommand):
    help = "Setup demo data for Google Play Store screenshots"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Clean existing demo data before creating new data",
        )
        parser.add_argument(
            "--skip-cleanup",
            action="store_true",
            help="Skip the cleanup step (useful if you want to add more data)",
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS("🚀 Setting up demo data for screenshots...")
        )
        self.stdout.write(
            self.style.WARNING(
                "\n💡 Note: Redis connection warnings can be safely ignored.\n"
            )
        )

        if options["clean"]:
            self.stdout.write("🗑️  Cleaning existing demo data...")
            self.clean_demo_data()

        # Create demo users
        users = self.create_demo_users()

        # Create friend connections
        self.create_friend_connections(users)

        # Create sample posts
        self.create_sample_posts(users)

        # Create sample messages
        self.create_sample_messages(users)

        # Create business pages
        self.create_business_pages(users)

        # Create marketplace listings
        self.create_marketplace_listings(users)

        # Create animal marketplace listings
        self.create_animal_listings(users)

        self.stdout.write(self.style.SUCCESS("✅ Demo data setup complete!"))
        self.stdout.write(self.style.SUCCESS("\n📸 Ready for screenshots!"))
        self.print_demo_accounts()

    def clean_demo_data(self):
        """Clean existing demo data"""
        demo_emails = [
            "sarah.johnson@demo.com",
            "michael.chen@demo.com",
            "emma.williams@demo.com",
            "james.davis@demo.com",
            "olivia.martinez@demo.com",
        ]

        User.objects.filter(email__in=demo_emails).delete()
        self.stdout.write(self.style.SUCCESS("  ✓ Cleaned demo users"))

    def create_demo_users(self):
        """Create professional demo user accounts"""
        self.stdout.write("👥 Creating demo users...")

        users_data = [
            {
                "email": "sarah.johnson@demo.com",
                "username": "sarahjohnson",
                "first_name": "Sarah",
                "last_name": "Johnson",
                "bio": "Digital Marketing Strategist | Content Creator | Coffee Enthusiast ☕\n📍 San Francisco, CA",
            },
            {
                "email": "michael.chen@demo.com",
                "username": "michaelchen",
                "first_name": "Michael",
                "last_name": "Chen",
                "bio": "Software Engineer | Tech Blogger | Open Source Contributor 💻\n📍 Seattle, WA",
            },
            {
                "email": "emma.williams@demo.com",
                "username": "emmawilliams",
                "first_name": "Emma",
                "last_name": "Williams",
                "bio": "Small Business Owner | Baker | Food Photography 🍰\n📍 Portland, OR",
            },
            {
                "email": "james.davis@demo.com",
                "username": "jamesdavis",
                "first_name": "James",
                "last_name": "Davis",
                "bio": "Fitness Coach | Marathon Runner | Healthy Living Advocate 🏃\n📍 Austin, TX",
            },
            {
                "email": "olivia.martinez@demo.com",
                "username": "oliviamartinez",
                "first_name": "Olivia",
                "last_name": "Martinez",
                "bio": "Travel Photographer | Adventure Seeker | World Explorer 🌍\n📍 Miami, FL",
            },
        ]

        users = []
        for user_data in users_data:
            user, created = User.objects.get_or_create(
                email=user_data["email"],
                defaults={
                    "username": user_data["username"],
                    "first_name": user_data["first_name"],
                    "last_name": user_data["last_name"],
                    "bio": user_data["bio"],
                    "is_active": True,
                },
            )
            if created:
                user.set_password("Demo@123")
                user.save()
                self.stdout.write(f"  ✓ Created {user.get_full_name()}")
            users.append(user)

        return users

    def create_friend_connections(self, users):
        """Create friend connections between demo users"""
        self.stdout.write("🤝 Creating friend connections...")

        # Make everyone friends with everyone
        for i, user in enumerate(users):
            for friend in users[i + 1 :]:
                # Create and accept friend request
                fr, created = FriendRequest.objects.get_or_create(
                    from_user=user, to_user=friend, defaults={"status": "accepted"}
                )
                if created:
                    fr.accepted_at = timezone.now()
                    fr.save()

        self.stdout.write(
            f"  ✓ Created {len(users) * (len(users) - 1) // 2} friendships"
        )

    def create_sample_posts(self, users):
        """Create engaging sample posts for feed screenshots"""
        self.stdout.write("📝 Creating sample posts...")

        posts_data = [
            {
                "user": users[0],  # Sarah
                "content": "🎉 Excited to announce I've just launched my new marketing consultancy! Ready to help small businesses grow their online presence. DM me for a free consultation! #DigitalMarketing #SmallBusiness",
                "hours_ago": 2,
            },
            {
                "user": users[1],  # Michael
                "content": "Just finished building a new open-source project! 🚀 Check out my latest blog post on modern web development practices. Link in bio! #WebDev #OpenSource #TechBlog",
                "hours_ago": 5,
            },
            {
                "user": users[2],  # Emma
                "content": "🍰 New seasonal menu alert! Fresh strawberry shortcake and lemon tarts now available at the bakery. Come by this weekend for a sweet treat! Limited quantities! #Bakery #Desserts #LocalBusiness",
                "hours_ago": 8,
            },
            {
                "user": users[3],  # James
                "content": "💪 Marathon training update: Completed my longest run yet - 20 miles! Feeling strong and ready for race day. Remember: consistency beats intensity every time. #MarathonTraining #Fitness #RunningMotivation",
                "hours_ago": 12,
            },
            {
                "user": users[4],  # Olivia
                "content": "🌅 Caught the most incredible sunrise in Bali this morning! Sometimes you just need to wake up early and chase the light. Travel tip: Golden hour is always worth the early alarm. #TravelPhotography #Bali #Sunrise",
                "hours_ago": 24,
            },
            {
                "user": users[0],  # Sarah
                "content": "Quick marketing tip: Consistency > Perfection. Post regularly, engage authentically, and watch your community grow! 📈 What's your biggest social media challenge? #MarketingTips",
                "hours_ago": 36,
            },
            {
                "user": users[1],  # Michael
                "content": "Debugging a tricky issue for the past 3 hours... Finally found it! It was a missing semicolon 😅 Never gets old. #DeveloperLife #Coding",
                "hours_ago": 48,
            },
            {
                "user": users[2],  # Emma
                "content": "Behind the scenes: 4am wake-up calls, flour everywhere, and the smell of fresh bread. This is what I love about running a bakery! ❤️🥖 #BakeryLife #SmallBusinessOwner",
                "hours_ago": 60,
            },
        ]

        created_count = 0
        for post_data in posts_data:
            post_time = timezone.now() - timedelta(hours=post_data["hours_ago"])
            post, created = Post.objects.get_or_create(
                author=post_data["user"],
                content=post_data["content"],
                defaults={
                    "created_at": post_time,
                    "updated_at": post_time,
                },
            )
            if created:
                created_count += 1

        self.stdout.write(f"  ✓ Created {created_count} posts")

    def create_sample_messages(self, users):
        """Create sample message conversations"""
        self.stdout.write("💬 Creating sample messages...")

        conversations_data = [
            {
                "participants": [users[0], users[1]],  # Sarah & Michael
                "messages": [
                    {
                        "sender": users[0],
                        "content": "Hey Michael! I saw your post about web development. Could you help me with my website?",
                        "hours_ago": 3,
                    },
                    {
                        "sender": users[1],
                        "content": "Hi Sarah! Of course! I'd be happy to help. What do you need?",
                        "hours_ago": 2,
                    },
                    {
                        "sender": users[0],
                        "content": "I need to optimize my site for mobile users. Any recommendations?",
                        "hours_ago": 2,
                    },
                    {
                        "sender": users[1],
                        "content": "Definitely! Let's start with responsive design. I can send you some resources.",
                        "hours_ago": 1,
                    },
                ],
            },
            {
                "participants": [users[2], users[0]],  # Emma & Sarah
                "messages": [
                    {
                        "sender": users[0],
                        "content": "Emma! Your strawberry shortcake looks amazing! 🍰",
                        "hours_ago": 6,
                    },
                    {
                        "sender": users[2],
                        "content": "Thank you Sarah! Come by this weekend, I'll save you one! 😊",
                        "hours_ago": 5,
                    },
                    {
                        "sender": users[0],
                        "content": "Perfect! I'll be there Saturday morning!",
                        "hours_ago": 5,
                    },
                ],
            },
            {
                "participants": [users[3], users[4]],  # James & Olivia
                "messages": [
                    {
                        "sender": users[4],
                        "content": "James! That 20-mile run is incredible! 💪",
                        "hours_ago": 10,
                    },
                    {
                        "sender": users[3],
                        "content": "Thanks Olivia! Training is intense but worth it. How's Bali?",
                        "hours_ago": 9,
                    },
                    {
                        "sender": users[4],
                        "content": "Amazing! The beaches here are breathtaking. You should visit!",
                        "hours_ago": 9,
                    },
                ],
            },
        ]

        created_conversations = 0
        created_messages = 0

        from main.models import ConversationParticipant

        for conv_data in conversations_data:
            # Check if conversation already exists between these participants
            participants = conv_data["participants"]

            # Find existing conversation with these exact participants
            from django.db.models import Count, Q

            existing_conv = None
            potential_convs = Conversation.objects.annotate(
                participant_count=Count("participants")
            ).filter(participant_count=len(participants))

            for conv in potential_convs:
                conv_user_ids = set(conv.participants.values_list("user_id", flat=True))
                participant_ids = set(p.id for p in participants)
                if conv_user_ids == participant_ids:
                    existing_conv = conv
                    break

            if existing_conv:
                conv = existing_conv
                created = False
            else:
                # Create new conversation (created_by is the first participant)
                conv = Conversation.objects.create(
                    created_by=participants[0],
                    created_at=timezone.now() - timedelta(hours=24),
                )
                # Add participants using ConversationParticipant
                for participant in participants:
                    ConversationParticipant.objects.create(
                        conversation=conv,
                        user=participant,
                        role="admin" if participant == participants[0] else "member",
                    )
                created = True
                created_conversations += 1

            # Create messages if this is a new conversation or if it has no messages
            if created or conv.messages.count() == 0:
                for msg_data in conv_data["messages"]:
                    msg_time = timezone.now() - timedelta(hours=msg_data["hours_ago"])
                    Message.objects.create(
                        conversation=conv,
                        sender=msg_data["sender"],
                        content=msg_data["content"],
                        created_at=msg_time,
                    )
                    created_messages += 1

        self.stdout.write(
            f"  ✓ Created {created_conversations} conversations with {created_messages} messages"
        )

    def create_business_pages(self, users):
        """Create professional business pages"""
        self.stdout.write("🏢 Creating business pages...")

        pages_data = [
            {
                "created_by": users[2],  # Emma's bakery
                "name": "Sweet Emma's Bakery",
                "description": "Artisan bakery specializing in fresh bread, pastries, and custom cakes. Using locally-sourced ingredients and traditional baking methods. Open Tuesday-Sunday, 7am-6pm.",
                "category": "food",
                "website_url": "https://www.sweetemmasbakery.com",
                "phone": "(503) 555-0123",
            },
            {
                "created_by": users[3],  # James's fitness
                "name": "FitLife Coaching",
                "description": "Personal training and nutrition coaching for all fitness levels. Specializing in marathon training, weight loss, and strength building. Online and in-person sessions available.",
                "category": "health",
                "website_url": "https://www.fitlifecoaching.com",
                "phone": "(512) 555-0456",
            },
            {
                "created_by": users[0],  # Sarah's marketing
                "name": "Digital Growth Agency",
                "description": "Full-service digital marketing agency helping small businesses thrive online. Services include social media management, content creation, SEO, and brand strategy.",
                "category": "business",
                "website_url": "https://www.digitalgrowthagency.com",
                "phone": "(415) 555-0789",
            },
        ]

        created_count = 0
        for page_data in pages_data:
            page, created = Page.objects.get_or_create(
                name=page_data["name"],
                defaults={
                    "created_by": page_data["created_by"],
                    "description": page_data["description"],
                    "category": page_data["category"],
                    "website_url": page_data.get("website_url", ""),
                    "phone": page_data.get("phone", ""),
                    "is_verified": True,
                },
            )
            if created:
                created_count += 1
                # Add followers using PageFollower model
                from main.models import PageFollower

                for follower in users[:3]:
                    PageFollower.objects.get_or_create(page=page, user=follower)

        self.stdout.write(f"  ✓ Created {created_count} business pages")

    def create_marketplace_listings(self, users):
        """Create marketplace listings"""
        self.stdout.write("🛍️ Creating marketplace listings...")

        from main.marketplace_models import MarketplaceCategory
        from django.utils.text import slugify

        # Create categories if they don't exist
        categories = {}
        category_names = [
            "Electronics",
            "Sports & Outdoors",
            "Furniture",
            "Home & Garden",
        ]
        for cat_name in category_names:
            cat, _ = MarketplaceCategory.objects.get_or_create(
                name=cat_name, defaults={"slug": slugify(cat_name)}
            )
            categories[cat_name] = cat

        listings_data = [
            {
                "seller": users[1],
                "title": 'MacBook Pro 16" (2023) - Like New',
                "description": 'Barely used MacBook Pro 16" with M2 Pro chip, 16GB RAM, 512GB SSD. Includes original box, charger, and AppleCare+ until 2026. Perfect for developers and creators.',
                "price": 2199.00,
                "category": "Electronics",
                "condition": "like_new",
                "location": "Seattle, WA",
            },
            {
                "seller": users[4],
                "title": "Canon EOS R6 Camera Body",
                "description": "Professional mirrorless camera in excellent condition. Low shutter count (~5000). Perfect for photography enthusiasts. Includes 2 batteries and charger.",
                "price": 1899.00,
                "category": "Electronics",
                "condition": "excellent",
                "location": "Miami, FL",
            },
            {
                "seller": users[3],
                "title": "Peloton Bike - Excellent Condition",
                "description": "Peloton bike with all accessories including cycling shoes (size 10), weights, and heart rate monitor. Membership not included. Great for home workouts!",
                "price": 1200.00,
                "category": "Sports & Outdoors",
                "condition": "excellent",
                "location": "Austin, TX",
            },
            {
                "seller": users[0],
                "title": "Modern Standing Desk with Motor",
                "description": 'Electric standing desk 60" x 30" in walnut finish. Memory presets for height adjustment. Perfect for home office. Disassembles for easy moving.',
                "price": 350.00,
                "category": "Furniture",
                "condition": "good",
                "location": "San Francisco, CA",
            },
            {
                "seller": users[2],
                "title": "KitchenAid Professional Mixer",
                "description": "Heavy-duty stand mixer in metallic chrome. 6-quart capacity with multiple attachments. Perfect for serious bakers. Lightly used.",
                "price": 299.00,
                "category": "Home & Garden",
                "condition": "like_new",
                "location": "Portland, OR",
            },
        ]

        created_count = 0
        for listing_data in listings_data:
            listing, created = MarketplaceListing.objects.get_or_create(
                title=listing_data["title"],
                defaults={
                    "seller": listing_data["seller"],
                    "description": listing_data["description"],
                    "price": listing_data["price"],
                    "category": categories[listing_data["category"]],
                    "condition": listing_data["condition"],
                    "location": listing_data["location"],
                    "status": "active",
                },
            )
            if created:
                created_count += 1

        self.stdout.write(f"  ✓ Created {created_count} marketplace listings")

    def create_animal_listings(self, users):
        """Create animal marketplace listings"""
        self.stdout.write("🐾 Creating animal marketplace listings...")

        from main.animal_models import AnimalCategory

        # Create animal categories if they don't exist
        categories = {}
        category_data = [
            ("Golden Retriever Puppies", "dogs"),
            ("Quarter Horse", "livestock"),
            ("Scottish Fold Kittens", "cats"),
            ("Cockatiel", "birds"),
            ("Miniature Pig", "small_mammals"),
        ]
        for cat_name, animal_type in category_data:
            cat, _ = AnimalCategory.objects.get_or_create(
                name=cat_name, defaults={"animal_type": animal_type}
            )
            categories[cat_name] = cat

        animal_listings = [
            {
                "seller": users[4],
                "title": "Golden Retriever Puppies - AKC Registered",
                "description": "Beautiful litter of 6 Golden Retriever puppies. 8 weeks old, fully vaccinated, dewormed, and health checked. Parents are both AKC champions. Ready for loving homes!",
                "price": 1800.00,
                "category": "Golden Retriever Puppies",
                "breed": "Golden Retriever",
                "age_years": 0,
                "age_months": 2,
                "location": "Miami, FL",
            },
            {
                "seller": users[3],
                "title": "Registered Quarter Horse Mare",
                "description": "Gentle 5-year-old Quarter Horse mare. Great for trail riding and light ranch work. Up to date on all vaccinations. Perfect for intermediate riders.",
                "price": 5500.00,
                "category": "Quarter Horse",
                "breed": "Quarter Horse",
                "age_years": 5,
                "age_months": 0,
                "location": "Austin, TX",
            },
            {
                "seller": users[2],
                "title": "Scottish Fold Kittens - Adorable",
                "description": "Two Scottish Fold kittens looking for forever homes. Litter trained, socialized, and vet checked. One male, one female. 10 weeks old.",
                "price": 1200.00,
                "category": "Scottish Fold Kittens",
                "breed": "Scottish Fold",
                "age_years": 0,
                "age_months": 2,
                "location": "Portland, OR",
            },
            {
                "seller": users[1],
                "title": "Pair of Cockatiels with Cage",
                "description": "Bonded pair of cockatiels (2 years old) with large cage and accessories. Hand-tamed and friendly. Includes food, toys, and perches.",
                "price": 250.00,
                "category": "Cockatiel",
                "breed": "Cockatiel",
                "age_years": 2,
                "age_months": 0,
                "location": "Seattle, WA",
            },
            {
                "seller": users[0],
                "title": "Miniature Pig - Family Friendly",
                "description": "Sweet 6-month-old miniature pig. House trained and great with kids. Comes with supplies and care instructions. Looking for a loving home with outdoor space.",
                "price": 600.00,
                "category": "Miniature Pig",
                "breed": "Miniature Pig",
                "age_years": 0,
                "age_months": 6,
                "location": "San Francisco, CA",
            },
        ]

        created_count = 0
        for listing_data in animal_listings:
            listing, created = AnimalListing.objects.get_or_create(
                title=listing_data["title"],
                defaults={
                    "seller": listing_data["seller"],
                    "description": listing_data["description"],
                    "price": listing_data["price"],
                    "category": categories[listing_data["category"]],
                    "breed": listing_data["breed"],
                    "age_years": listing_data["age_years"],
                    "age_months": listing_data["age_months"],
                    "location": listing_data["location"],
                    "status": "active",
                },
            )
            if created:
                created_count += 1

        self.stdout.write(f"  ✓ Created {created_count} animal listings")

    def print_demo_accounts(self):
        """Print demo account credentials"""
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("📱 DEMO ACCOUNTS FOR SCREENSHOTS"))
        self.stdout.write("=" * 60)

        accounts = [
            ("Sarah Johnson", "sarah.johnson@demo.com"),
            ("Michael Chen", "michael.chen@demo.com"),
            ("Emma Williams", "emma.williams@demo.com"),
            ("James Davis", "james.davis@demo.com"),
            ("Olivia Martinez", "olivia.martinez@demo.com"),
        ]

        self.stdout.write("\n📧 Email / 🔑 Password: Demo@123\n")
        for name, email in accounts:
            self.stdout.write(f"  • {name:20} - {email}")

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(
            "💡 TIP: Login with any of these accounts to take screenshots!"
        )
        self.stdout.write("=" * 60 + "\n")
