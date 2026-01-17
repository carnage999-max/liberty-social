from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Q
from django.contrib.auth import get_user_model
from .models import Post, Page
from .marketplace_models import MarketplaceListing
from .animal_models import AnimalListing, BreederDirectory

User = get_user_model()


class UniversalSearchView(APIView):
    """
    Universal search endpoint that searches across:
    - Posts
    - Users (People)
    - Pages
    - Marketplace Listings
    - Animal Listings
    - Breeders
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        entity_type = request.query_params.get("type", "all")  # all, post, user, page, marketplace, animal, breeder
        limit = int(request.query_params.get("limit", 20))

        if not query:
            return Response({
                "all": [],
                "posts": [],
                "users": [],
                "pages": [],
                "marketplace": [],
                "animals": [],
                "breeders": [],
            })

        results = {
            "posts": [],
            "users": [],
            "pages": [],
            "marketplace": [],
            "animals": [],
            "breeders": [],
        }

        # Search Posts
        if entity_type in ("all", "post"):
            posts = Post.objects.filter(
                Q(content__icontains=query) | Q(author__username__icontains=query)
            ).filter(
                deleted_at__isnull=True
            ).select_related("author", "page").prefetch_related("media")[:limit]

            results["posts"] = [
                {
                    "id": post.id,
                    "type": "post",
                    "title": post.content[:100] + ("..." if len(post.content) > 100 else ""),
                    "description": (
                        post.page.name if post.author_type == "page" and post.page
                        else post.author.username or post.author.email
                    ),
                    "image": post.media.first().url if post.media.exists() else None,
                    "href": f"/app/feed/{post.slug or post.id}",
                    "relevance_score": self._calculate_relevance(post.content, query),
                }
                for post in posts
            ]

        # Search Users
        if entity_type in ("all", "user"):
            users = User.objects.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            ).exclude(id=request.user.id)[:limit]

            results["users"] = [
                {
                    "id": user.id,
                    "type": "user",
                    "title": user.username or user.email,
                    "description": f"{user.first_name or ''} {user.last_name or ''}".strip() or None,
                    "image": user.profile_image_url,
                    "href": f"/app/users/{user.slug or user.id}",
                    "relevance_score": self._calculate_relevance(
                        f"{user.username} {user.email} {user.first_name} {user.last_name}", query
                    ),
                }
                for user in users
            ]

        # Search Pages
        if entity_type in ("all", "page"):
            pages = Page.objects.filter(
                Q(name__icontains=query) | Q(description__icontains=query)
            )[:limit]

            results["pages"] = [
                {
                    "id": page.id,
                    "type": "page",
                    "title": page.name,
                    "description": (page.description[:100] + "..." if page.description and len(page.description) > 100 else page.description) if page.description else None,
                    "image": page.profile_image_url or page.cover_image_url,
                    "href": f"/app/pages/{page.slug or page.id}",
                    "relevance_score": self._calculate_relevance(f"{page.name} {page.description or ''}", query),
                }
                for page in pages
            ]

        # Search Marketplace Listings
        if entity_type in ("all", "marketplace"):
            marketplace_listings = MarketplaceListing.objects.filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
            ).filter(status="active").select_related("seller", "category").prefetch_related("media")[:limit]

            results["marketplace"] = [
                {
                    "id": listing.id,
                    "type": "marketplace",
                    "title": listing.title,
                    "description": f"${listing.price} - {listing.description[:80]}" if listing.description else f"${listing.price}",
                    "image": listing.media.first().url if listing.media.exists() else None,
                    "href": f"/app/marketplace/{listing.slug or listing.id}",
                    "relevance_score": self._calculate_relevance(f"{listing.title} {listing.description or ''}", query),
                }
                for listing in marketplace_listings
            ]

        # Search Animal Listings
        if entity_type in ("all", "animal"):
            animal_listings = AnimalListing.objects.filter(
                Q(title__icontains=query)
                | Q(description__icontains=query)
                | Q(breed__icontains=query)
            ).filter(status__in=["active", "held"]).select_related("seller", "category").prefetch_related("media")[:limit]

            results["animals"] = [
                {
                    "id": listing.id,
                    "type": "animal",
                    "title": listing.title,
                    "description": f"{listing.breed or 'Animal'} - ${listing.price}" if listing.price > 0 else f"{listing.breed or 'Animal'} - Adoption",
                    "image": listing.media.first().url if listing.media.exists() else None,
                    "href": f"/app/animals/{listing.slug or listing.id}",
                    "relevance_score": self._calculate_relevance(f"{listing.title} {listing.description or ''} {listing.breed or ''}", query),
                }
                for listing in animal_listings
            ]

        # Search Breeders
        if entity_type in ("all", "breeder"):
            breeders = BreederDirectory.objects.filter(
                Q(breeder_name__icontains=query)
                | Q(bio__icontains=query)
            ).filter(subscription_status="active").select_related("seller__user")[:limit]

            results["breeders"] = [
                {
                    "id": breeder.id,
                    "type": "breeder",
                    "title": breeder.breeder_name,
                    "description": (breeder.bio[:100] + "..." if breeder.bio and len(breeder.bio) > 100 else breeder.bio) if breeder.bio else None,
                    "image": breeder.seller.user.profile_image_url if breeder.seller and breeder.seller.user else None,
                    "href": f"/app/breeders/{breeder.slug or breeder.id}",
                    "relevance_score": self._calculate_relevance(f"{breeder.breeder_name} {breeder.bio or ''}", query),
                }
                for breeder in breeders
            ]

        # If searching all, combine and sort by relevance
        if entity_type == "all":
            all_results = []
            for entity_type_key, entity_results in results.items():
                all_results.extend(entity_results)
            
            # Sort by relevance score (higher is better)
            all_results.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
            
            return Response({
                "all": all_results[:limit * 2],  # Return more results for "all" view
                "posts": results["posts"],
                "users": results["users"],
                "pages": results["pages"],
                "marketplace": results["marketplace"],
                "animals": results["animals"],
                "breeders": results["breeders"],
            })

        # Return filtered results
        return Response(results)

    def _calculate_relevance(self, text: str, query: str) -> float:
        """
        Simple relevance scoring:
        - Exact match at start: 100
        - Exact match: 80
        - Case-insensitive match at start: 70
        - Case-insensitive match: 50
        - Partial match: 30
        """
        if not text or not query:
            return 0.0
        
        text_lower = text.lower()
        query_lower = query.lower()
        
        if text_lower.startswith(query_lower):
            return 100.0 if text.startswith(query) else 70.0
        elif query_lower in text_lower:
            return 80.0 if query in text else 50.0
        else:
            # Check if any word matches
            query_words = query_lower.split()
            text_words = text_lower.split()
            matches = sum(1 for qw in query_words if any(tw.startswith(qw) for tw in text_words))
            return (matches / len(query_words)) * 30.0 if query_words else 0.0
