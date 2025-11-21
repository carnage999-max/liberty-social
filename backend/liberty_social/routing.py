from django.urls import path

from main.consumers import ChatConsumer, NotificationConsumer, UserStatusConsumer

websocket_urlpatterns = [
    path("ws/chat/<int:conversation_id>/", ChatConsumer.as_asgi()),
    path("ws/notifications/", NotificationConsumer.as_asgi()),
    path("ws/user-status/", UserStatusConsumer.as_asgi()),
]
