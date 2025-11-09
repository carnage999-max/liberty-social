import logging

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .realtime import notification_group_name

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Streams real-time notifications to an authenticated user."""

    async def connect(self):
        client = (
            self.scope.get("client", ["unknown"])[0]
            if self.scope.get("client")
            else "unknown"
        )
        logger.info(f"WebSocket connection attempt from {client}")

        user = self.scope.get("user")
        if not user or user.is_anonymous:
            logger.warning(
                f"WebSocket connection rejected: anonymous user from {client}"
            )
            await self.close(code=4401)
            return

        try:
            self.user = user
            self.group_name = notification_group_name(user.id)
            logger.info(
                f"WebSocket connecting user {user.id} to group {self.group_name}"
            )

            # Test channel layer availability
            if not self.channel_layer:
                logger.error("No channel layer available for WebSocket connection")
                await self.close(code=4500)
                return

            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.info(f"WebSocket connected for user {user.id}")
            await self.send_json({"type": "connection.ack"})
        except Exception as e:
            logger.exception(f"Error during WebSocket connect for user {user.id}: {e}")
            try:
                await self.close(code=4500)
            except Exception:
                pass

    async def disconnect(self, code):
        user_id = getattr(self, "user", None)
        user_id = user_id.id if user_id else "unknown"
        logger.info(f"WebSocket disconnected for user {user_id} with code {code}")

        if hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(
                    self.group_name, self.channel_name
                )
            except Exception as e:
                logger.exception(f"Error during WebSocket disconnect cleanup: {e}")

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")
        if message_type == "ping":
            await self.send_json({"type": "pong"})

    async def notification_created(self, event):
        try:
            await self.send_json(
                {
                    "type": "notification.created",
                    "payload": event.get("data", {}),
                }
            )
        except Exception as e:
            logger.exception(f"Error sending notification via WebSocket: {e}")
