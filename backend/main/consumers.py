import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from .models import ConversationParticipant
from .realtime import conversation_group_name


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """Streams real-time chat events for a conversation."""

    async def connect(self):
        user = self.scope.get("user")
        if not user or isinstance(user, AnonymousUser) or user.is_anonymous:
            await self.close(code=4401)
            return

        conversation_id = self.scope["url_route"]["kwargs"].get("conversation_id")
        if not conversation_id:
            await self.close(code=4400)
            return

        has_access = await self._user_in_conversation(user.id, conversation_id)
        if not has_access:
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

    @sync_to_async
    def _user_in_conversation(self, user_id, conversation_id):
        return ConversationParticipant.objects.filter(
            conversation_id=conversation_id, user_id=user_id
        ).exists()
