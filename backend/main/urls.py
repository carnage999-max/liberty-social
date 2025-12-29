from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .feedback_view import FeedbackView
from users.analytics_views import (
    analytics_overview,
    analytics_by_country,
    analytics_by_state,
    analytics_by_age,
    analytics_by_gender,
    analytics_micro_segmentation,
    analytics_top_countries,
)
from .yard_sale_views import (
    yard_sales_search,
    yard_sale_detail,
    create_yard_sale,
    create_yard_sale_payment_intent,
    confirm_yard_sale_payment,
    stripe_webhook,
    update_yard_sale,
    delete_yard_sale,
    my_yard_sales,
    report_yard_sale,
    contact_seller,
)
from .views import (
    PostViewSet,
    CommentViewSet,
    ReactionViewSet,
    NewsFeedView,
    NotificationViewSet,
    BookmarkViewSet,
    SaveFolderViewSet,
    SaveFolderItemViewSet,
    DeviceTokenViewSet,
    ConversationViewSet,
    CallViewSet,
    PageViewSet,
    PageAdminInviteViewSet,
    PageInviteViewSet,
    UserFeedPreferenceViewSet,
    UserReactionPreferenceViewSet,
    FirebaseConfigView,
    RedisHealthView,
    WebSocketDiagnosticView,
    TestPushNotificationView,
)
from .marketplace_views import (
    MarketplaceCategoryViewSet,
    MarketplaceListingViewSet,
    MarketplaceOfferViewSet,
    MarketplaceSaveViewSet,
    MarketplaceListingMediaViewSet,
    SellerVerificationViewSet,
)
from .animal_views import (
    AnimalCategoryViewSet,
    AnimalSellerVerificationViewSet,
    AnimalListingViewSet,
    AnimalListingMediaViewSet,
    SellerReviewViewSet,
    BreederDirectoryViewSet,
    AdminActionLogViewSet,
)
from .views_uploads import UploadImageView
from .search_views import UniversalSearchView

router = DefaultRouter()
router.register("posts", PostViewSet, basename="posts")
router.register("comments", CommentViewSet, basename="comments")
router.register("reactions", ReactionViewSet, basename="reactions")
router.register("notifications", NotificationViewSet, basename="notifications")
router.register("bookmarks", BookmarkViewSet, basename="bookmarks")
router.register("save-folders", SaveFolderViewSet, basename="save-folders")
router.register("save-folder-items", SaveFolderItemViewSet, basename="save-folder-items")
router.register("device-tokens", DeviceTokenViewSet, basename="device-tokens")
router.register("conversations", ConversationViewSet, basename="conversations")
router.register("calls", CallViewSet, basename="calls")
router.register("pages", PageViewSet, basename="pages")
router.register("admin-invites", PageAdminInviteViewSet, basename="admin-invites")
router.register("page-invites", PageInviteViewSet, basename="page-invites")
router.register(
    "feed-preferences", UserFeedPreferenceViewSet, basename="feed-preferences"
)
router.register(
    "reaction-preferences",
    UserReactionPreferenceViewSet,
    basename="reaction-preferences",
)
router.register(
    "marketplace/categories",
    MarketplaceCategoryViewSet,
    basename="marketplace-categories",
)
router.register(
    "marketplace/listings", MarketplaceListingViewSet, basename="marketplace-listings"
)
router.register(
    "marketplace/offers", MarketplaceOfferViewSet, basename="marketplace-offers"
)
router.register(
    "marketplace/saves", MarketplaceSaveViewSet, basename="marketplace-saves"
)
router.register(
    "marketplace/media", MarketplaceListingMediaViewSet, basename="marketplace-media"
)
router.register(
    "marketplace/seller-verification",
    SellerVerificationViewSet,
    basename="marketplace-seller-verification",
)
router.register(
    "animals/categories", AnimalCategoryViewSet, basename="animal-categories"
)
router.register("animals/listings", AnimalListingViewSet, basename="animal-listings")
router.register(
    "animals/verification",
    AnimalSellerVerificationViewSet,
    basename="animal-seller-verification",
)
router.register("animals/media", AnimalListingMediaViewSet, basename="animal-media")
router.register("animals/reviews", SellerReviewViewSet, basename="animal-reviews")
router.register("animals/breeders", BreederDirectoryViewSet, basename="animal-breeders")
router.register(
    "admin/action-logs", AdminActionLogViewSet, basename="admin-action-logs"
)

urlpatterns = [
    path("", include(router.urls)),
    path(
        "users/admin/analytics/overview/", analytics_overview, name="analytics-overview"
    ),
    path(
        "users/admin/analytics/by-country/",
        analytics_by_country,
        name="analytics-by-country",
    ),
    path(
        "users/admin/analytics/by-state/", analytics_by_state, name="analytics-by-state"
    ),
    path("users/admin/analytics/by-age/", analytics_by_age, name="analytics-by-age"),
    path(
        "users/admin/analytics/by-gender/",
        analytics_by_gender,
        name="analytics-by-gender",
    ),
    path(
        "users/admin/analytics/micro-segmentation/",
        analytics_micro_segmentation,
        name="analytics-micro-segmentation",
    ),
    path(
        "users/admin/analytics/top-countries/",
        analytics_top_countries,
        name="analytics-top-countries",
    ),
    # Yard Sale Routes
    path("yard-sales/search/", yard_sales_search, name="yard-sales-search"),
    path("yard-sales/<int:listing_id>/", yard_sale_detail, name="yard-sale-detail"),
    path("yard-sales/create/", create_yard_sale, name="yard-sale-create"),
    path("yard-sales/create-payment-intent/", create_yard_sale_payment_intent, name="yard-sale-create-payment-intent"),
    path("yard-sales/confirm-payment/", confirm_yard_sale_payment, name="yard-sale-confirm-payment"),
    path("yard-sales/stripe-webhook/", stripe_webhook, name="yard-sale-stripe-webhook"),
    path(
        "yard-sales/<int:listing_id>/update/", update_yard_sale, name="yard-sale-update"
    ),
    path(
        "yard-sales/<int:listing_id>/delete/", delete_yard_sale, name="yard-sale-delete"
    ),
    path("yard-sales/my-listings/", my_yard_sales, name="yard-sales-my-listings"),
    path(
        "yard-sales/<int:listing_id>/report/", report_yard_sale, name="yard-sale-report"
    ),
    path(
        "yard-sales/<int:listing_id>/contact/", contact_seller, name="yard-sale-contact"
    ),
    path("feed/", NewsFeedView.as_view(), name="newsfeed"),
    path("feedback/", FeedbackView.as_view(), name="feedback"),
    path("uploads/images/", UploadImageView.as_view(), name="upload-image"),
    path("firebase-config/", FirebaseConfigView.as_view(), name="firebase-config"),
    path("redis-health/", RedisHealthView.as_view(), name="redis-health"),
    path("ws-diagnostic/", WebSocketDiagnosticView.as_view(), name="ws-diagnostic"),
    path(
        "test-push-notification/",
        TestPushNotificationView.as_view(),
        name="test-push-notification",
    ),
    path("search/", UniversalSearchView.as_view(), name="universal-search"),
]
