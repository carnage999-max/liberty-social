from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .realtime import notification_group_name


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Streams real-time notifications to an authenticated user."""

    async def connect(self):
        user = self.scope.get("user")
        if not user or user.is_anonymous:
            await self.close(code=4401)
            return

        self.user = user
        self.group_name = notification_group_name(user.id)

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connection.ack"})

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
                "payload": event.get("data", {}),
            }
        )
