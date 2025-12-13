import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from .models import ConversationParticipant
from .realtime import conversation_group_name, notification_group_name
from users.models import User


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """Streams real-time chat events for a conversation."""

    async def connect(self):
        import logging

        logger = logging.getLogger(__name__)

        user = self.scope.get("user")
        print(
            f"[CHATWS] ChatConsumer.connect - user: {user}, is_anonymous: {isinstance(user, AnonymousUser) if user else 'no user'}",
            flush=True,
        )
        logger.info(
            f"ChatConsumer.connect - user: {user}, is_anonymous: {isinstance(user, AnonymousUser) if user else 'no user'}"
        )

        if not user or isinstance(user, AnonymousUser) or user.is_anonymous:
            print(f"[CHATWS] Unauthorized - closing connection", flush=True)
            logger.warning("ChatConsumer.connect - Unauthorized (401)")
            await self.close(code=4401)
            return

        conversation_id = self.scope["url_route"]["kwargs"].get("conversation_id")
        print(f"[CHATWS] conversation_id: {conversation_id}", flush=True)
        logger.info(f"ChatConsumer.connect - conversation_id: {conversation_id}")

        if not conversation_id:
            logger.warning(
                "ChatConsumer.connect - Bad request (400) - missing conversation_id"
            )
            await self.close(code=4400)
            return

        try:
            has_access = await self._user_in_conversation(user.id, conversation_id)
            print(
                f"[CHATWS] user {user.id} has access to conversation {conversation_id}: {has_access}",
                flush=True,
            )
        except Exception as e:
            print(f"[CHATWS] ERROR checking access: {e}", flush=True)
            logger.error(f"Error checking conversation access: {e}")
            await self.close(code=4500)
            return
        logger.info(
            f"ChatConsumer.connect - user {user.id} has access to conversation {conversation_id}: {has_access}"
        )

        if not has_access:
            print(f"[CHATWS] Forbidden - user not a participant", flush=True)
            logger.warning(
                f"ChatConsumer.connect - Forbidden (403) - user {user.id} not a participant in conversation {conversation_id}"
            )
            await self.close(code=4403)
            return

        self.conversation_id = str(conversation_id)
        self.group_name = conversation_group_name(self.conversation_id)

        try:
            print(f"[CHATWS] Adding to group: {self.group_name}", flush=True)
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            print(f"[CHATWS] Accepting connection", flush=True)
            await self.accept()
            print(f"[CHATWS] Sending connection ack", flush=True)
            await self.send_json(
                {"type": "connection.ack", "conversation": self.conversation_id}
            )
            print(f"[CHATWS] Connection fully established!", flush=True)
        except Exception as e:
            print(f"[CHATWS] ERROR during connection setup: {e}", flush=True)
            logger.error(f"Error setting up chat WebSocket: {e}")
            await self.close(code=4500)
            return

    async def disconnect(self, code):
        print(f"[CHATWS] Disconnect called with code: {code}", flush=True)
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
            print(f"[CHATWS] Removed from group: {self.group_name}", flush=True)

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")
        if message_type == "ping":
            await self.send_json({"type": "pong"})
        elif message_type == "typing.start":
            await self._handle_typing_start()
        elif message_type == "typing.stop":
            await self._handle_typing_stop()
        elif message_type == "call.offer":
            await self._handle_call_offer(content)
        elif message_type == "call.answer":
            await self._handle_call_answer(content)
        elif message_type == "call.ice-candidate":
            await self._handle_call_ice_candidate(content)
        elif message_type == "call.end":
            await self._handle_call_end(content)

    async def _handle_typing_start(self):
        """Handle user starting to type - broadcast to other participants."""
        user = self.scope.get("user")
        if not user:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "typing.started",
                "user_id": str(user.id),
                "username": user.username,
            },
        )

    async def _handle_typing_stop(self):
        """Handle user stopping to type - broadcast to other participants."""
        user = self.scope.get("user")
        if not user:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "typing.stopped",
                "user_id": str(user.id),
                "username": user.username,
            },
        )

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

    async def typing_started(self, event):
        """Broadcast typing started event to all participants except sender."""
        await self.send_json(
            {
                "type": "typing.started",
                "user_id": event.get("user_id"),
                "username": event.get("username"),
            }
        )

    async def typing_stopped(self, event):
        """Broadcast typing stopped event to all participants except sender."""
        await self.send_json(
            {
                "type": "typing.stopped",
                "user_id": event.get("user_id"),
                "username": event.get("username"),
            }
        )

    async def _handle_call_offer(self, content):
        """Handle WebRTC offer from caller."""
        user = self.scope.get("user")
        if not user:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "call.offer",
                "caller_id": str(user.id),
                "caller_username": user.username,
                "call_id": content.get("call_id"),
                "call_type": content.get("call_type", "voice"),
                "offer": content.get("offer"),
            },
        )

    async def _handle_call_answer(self, content):
        """Handle WebRTC answer from receiver."""
        user = self.scope.get("user")
        if not user:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "call.answer",
                "receiver_id": str(user.id),
                "call_id": content.get("call_id"),
                "answer": content.get("answer"),
            },
        )

    async def _handle_call_ice_candidate(self, content):
        """Handle ICE candidate exchange."""
        user = self.scope.get("user")
        if not user:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "call.ice-candidate",
                "user_id": str(user.id),
                "call_id": content.get("call_id"),
                "candidate": content.get("candidate"),
            },
        )

    async def _handle_call_end(self, content):
        """Handle call end."""
        user = self.scope.get("user")
        if not user:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "call.end",
                "user_id": str(user.id),
                "call_id": content.get("call_id"),
            },
        )

    async def call_offer(self, event):
        """Broadcast call offer to other participants."""
        await self.send_json(
            {
                "type": "call.offer",
                "caller_id": event.get("caller_id"),
                "caller_username": event.get("caller_username"),
                "call_id": event.get("call_id"),
                "call_type": event.get("call_type"),
                "offer": event.get("offer"),
            }
        )

    async def call_answer(self, event):
        """Broadcast call answer."""
        await self.send_json(
            {
                "type": "call.answer",
                "receiver_id": event.get("receiver_id"),
                "call_id": event.get("call_id"),
                "answer": event.get("answer"),
            }
        )

    async def call_ice_candidate(self, event):
        """Broadcast ICE candidate."""
        await self.send_json(
            {
                "type": "call.ice-candidate",
                "user_id": event.get("user_id"),
                "call_id": event.get("call_id"),
                "candidate": event.get("candidate"),
            }
        )

    async def call_end(self, event):
        """Broadcast call end."""
        await self.send_json(
            {
                "type": "call.end",
                "user_id": event.get("user_id"),
                "call_id": event.get("call_id"),
            }
        )

    async def call_incoming(self, event):
        """Broadcast incoming call notification from server."""
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"call_incoming: Broadcasting call notification - call_id={event.get('call_id')}, caller_id={event.get('caller_id')}, receiver should be in group {self.group_name}")
        print(f"[CHATWS] call_incoming: Broadcasting to {self.group_name} - call_id={event.get('call_id')}, caller_id={event.get('caller_id')}", flush=True)
        await self.send_json(
            {
                "type": "call.offer",
                "call_id": event.get("call_id"),
                "caller_id": event.get("caller_id"),
                "caller_username": event.get("caller_username"),
                "call_type": event.get("call_type"),
            }
        )
        print(f"[CHATWS] call_incoming: Message sent to client", flush=True)

    async def call_accepted(self, event):
        """Broadcast call accepted notification."""
        await self.send_json(
            {
                "type": "call.answer",
                "call_id": event.get("call_id"),
                "receiver_id": event.get("receiver_id"),
            }
        )

    async def call_ended(self, event):
        """Broadcast call ended notification."""
        await self.send_json(
            {
                "type": "call.end",
                "call_id": event.get("call_id"),
                "ended_by": event.get("ended_by"),
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

    async def call_incoming(self, event):
        """Handle incoming call notifications."""
        await self.send_json(
            {
                "type": "call.incoming",
                "call_id": event.get("call_id"),
                "caller_id": event.get("caller_id"),
                "caller_username": event.get("caller_username"),
                "call_type": event.get("call_type"),
                "conversation_id": event.get("conversation_id"),
            }
        )


class UserStatusConsumer(AsyncJsonWebsocketConsumer):
    """Tracks and broadcasts user online/offline status in real-time."""

    async def connect(self):
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            user = self.scope.get("user")
            if not user or isinstance(user, AnonymousUser) or user.is_anonymous:
                logger.warning("UserStatusConsumer.connect - Unauthorized (401)")
                await self.close(code=4401)
                return

            self.user_id = str(user.id)
            self.group_name = "user_status"  # Global group for all online users

            # Mark user as online
            try:
                await self._set_user_online(self.user_id, True)
            except Exception as e:
                logger.error(f"Error setting user online: {e}", exc_info=True)
                # Continue anyway - don't fail the connection

            # Add user to the global status group
            try:
                await self.channel_layer.group_add(self.group_name, self.channel_name)
            except Exception as e:
                logger.error(f"Error adding to channel group: {e}", exc_info=True)
                await self.close(code=4500)
                return

            await self.accept()

            # Notify all clients that this user is online
            try:
                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "user.status.changed",
                        "user_id": self.user_id,
                        "is_online": True,
                    },
                )
            except Exception as e:
                logger.error(f"Error sending status change notification: {e}", exc_info=True)
                # Continue anyway - connection is already established

            await self.send_json({"type": "connection.ack", "user_id": self.user_id})
            logger.info(f"UserStatusConsumer.connect - Successfully connected user {self.user_id}")
        except Exception as e:
            logger.error(f"Error in UserStatusConsumer.connect: {e}", exc_info=True)
            try:
                await self.close(code=4500)
            except:
                pass

    async def disconnect(self, code):
        if hasattr(self, "user_id"):
            # Mark user as offline
            await self._set_user_online(self.user_id, False)

            # Notify all clients that this user is offline
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "user.status.changed",
                    "user_id": self.user_id,
                    "is_online": False,
                },
            )

        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")
        if message_type == "ping":
            # Update last_activity on ping to track active users
            if hasattr(self, "user_id"):
                await self._update_user_activity(self.user_id)
            await self.send_json({"type": "pong"})

    async def user_status_changed(self, event):
        """Handle user status change events from other connections."""
        await self.send_json(
            {
                "type": "user.status.changed",
                "user_id": event.get("user_id"),
                "is_online": event.get("is_online"),
            }
        )

    @sync_to_async
    def _set_user_online(self, user_id, is_online):
        """Update user's online status in database."""
        try:
            user = User.objects.get(id=user_id)
            user.is_online = is_online
            user.last_activity = timezone.now()
            if is_online:
                # When coming online, update last_seen as well
                user.last_seen = timezone.now()
            user.save(update_fields=["is_online", "last_activity", "last_seen"])
        except User.DoesNotExist:
            pass

    @sync_to_async
    def _update_user_activity(self, user_id):
        """Update user's last activity and last seen timestamps."""
        try:
            user = User.objects.get(id=user_id)
            user.last_activity = timezone.now()
            user.last_seen = timezone.now()
            user.save(update_fields=["last_activity", "last_seen"])
        except User.DoesNotExist:
            pass
