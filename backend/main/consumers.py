import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from .models import ConversationParticipant
from .realtime import conversation_group_name, notification_group_name


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """Streams real-time chat events for a conversation."""

    async def connect(self):
        import logging
        logger = logging.getLogger(__name__)
        
        user = self.scope.get("user")
        logger.info(f"ChatConsumer.connect - user: {user}, is_anonymous: {isinstance(user, AnonymousUser) if user else 'no user'}")
        
        if not user or isinstance(user, AnonymousUser) or user.is_anonymous:
            logger.warning("ChatConsumer.connect - Unauthorized (401)")
            await self.close(code=4401)
            return

        conversation_id = self.scope["url_route"]["kwargs"].get("conversation_id")
        logger.info(f"ChatConsumer.connect - conversation_id: {conversation_id}")
        
        if not conversation_id:
            logger.warning("ChatConsumer.connect - Bad request (400) - missing conversation_id")
            await self.close(code=4400)
            return

        has_access = await self._user_in_conversation(user.id, conversation_id)
        logger.info(f"ChatConsumer.connect - user {user.id} has access to conversation {conversation_id}: {has_access}")
        
        if not has_access:
            logger.warning(f"ChatConsumer.connect - Forbidden (403) - user {user.id} not a participant in conversation {conversation_id}")
            await self.close(code=4403)
            return

        self.conversation_id = str(conversation_id)
        self.group_name = conversation_group_name(self.conversation_id)

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connection.ack", "conversation": self.conversation_id})

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")
        if message_type == "ping":
            await self.send_json({"type": "pong"})

    async def chat_message(self, event):
        await self.send_json(
            {
                "type": "message.created",
                "payload": event.get("data"),
            }
        )

    async def message_updated(self, event):
        await self.send_json(
            {
                "type": "message.updated",
                "payload": event.get("data"),
            }
        )

    async def message_deleted(self, event):
        await self.send_json(
            {
                "type": "message.deleted",
                "payload": event.get("data"),
            }
        )

    @sync_to_async
    def _user_in_conversation(self, user_id, conversation_id):
        return ConversationParticipant.objects.filter(
            conversation_id=conversation_id, user_id=user_id
        ).exists()


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Streams real-time notifications for a user (primarily for mobile app)."""

    async def connect(self):
        user = self.scope.get("user")
        if not user or isinstance(user, AnonymousUser) or user.is_anonymous:
            await self.close(code=4401)
            return

        self.user_id = str(user.id)
        self.group_name = notification_group_name(self.user_id)

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connection.ack", "user_id": self.user_id})

    async def disconnect(self, code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")
        if message_type == "ping":
            await self.send_json({"type": "pong"})

    async def notification_created(self, event):
        await self.send_json(
            {
                "type": "notification.created",
                "payload": event.get("data"),
            }
        )
