from django.urls import path, include
from .views import RegisterUserViewSet, LoginUserview, LogoutView, UserView
from .views import FriendsViewset, FriendRequestViewset, BlockedUsersViewset, ProfilePictureUploadView
from .password_reset_view import PasswordResetView
from rest_framework.routers import DefaultRouter


router = DefaultRouter()
router.register('login', LoginUserview, basename='login')
router.register('register', RegisterUserViewSet, basename='register')
router.register('user', UserView, basename='user')
from .views import FriendsViewset, FriendRequestViewset, BlockedUsersViewset
router.register('friends', FriendsViewset, basename='friends')
router.register('friend-requests', FriendRequestViewset, basename='friend-requests')
router.register('blocks', BlockedUsersViewset, basename='blocks')

urlpatterns = [
    path('', include(router.urls)),
    path('logout/', LogoutView, name='logout')
    ,
    path('profile/upload-picture/', ProfilePictureUploadView.as_view(), name='profile-upload')
    ,
    path('password-reset/', PasswordResetView.as_view(), name='password-reset')
]

