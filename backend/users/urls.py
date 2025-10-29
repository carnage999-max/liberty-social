from django.urls import path, include
from .views import RegisterUserViewSet, LoginUserview, LogoutView, UserView
from rest_framework.routers import DefaultRouter


router = DefaultRouter()
router.register('login', LoginUserview, basename='login')
router.register('register', RegisterUserViewSet, basename='register')
router.register('user', UserView, basename='user')

urlpatterns = [
    path('', include(router.urls)),
    path('logout/', LogoutView, name='logout')
]

