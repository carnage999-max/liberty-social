# Complete Backend Implementation for Global Voice & Video Calls

This guide provides the complete Django backend implementation needed to make voice and video calls work globally (when users are on different pages).

## Overview

The issue is that the backend currently:
- ✅ Sends call notifications via the notification system
- ❌ Does NOT route WebRTC signaling messages (offer/answer SDP) through the global notification WebSocket
- ❌ Missing conversation_id in notifications

## Files to Modify

### 1. Chat WebSocket Consumer (`chat/consumers.py` or similar)

This consumer needs to route call signaling messages to BOTH:
- The chat WebSocket group (existing)
- The receiver's global notification WebSocket group (NEW)

```python
# chat/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import async_to_sync, sync_to_async
from django.contrib.auth import get_user_model
from .models import Conversation, Message, Call

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'

        # Join chat room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send connection acknowledgment
        await self.send(text_data=json.dumps({
            'type': 'connection.ack'
        }))

    async def disconnect(self, close_code):
        # Leave chat room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'call.offer':
                await self.handle_call_offer(data)
            elif message_type == 'call.answer':
                await self.handle_call_answer(data)
            elif message_type == 'message':
                await self.handle_message(data)
            elif message_type == 'typing':
                await self.handle_typing(data)
            # ... other message types

        except Exception as e:
            print(f"Error in ChatConsumer.receive: {e}")

    async def handle_call_offer(self, data):
        """Handle call offer and route to both chat group AND receiver's global notification group"""
        call_id = data.get('call_id')
        caller_id = data.get('caller_id')
        caller_username = data.get('caller_username')
        call_type = data.get('call_type')
        offer = data.get('offer')

        # Get the call from database to find the receiver
        call = await self.get_call(call_id)
        if not call:
            print(f"Call {call_id} not found")
            return

        # Determine receiver (the person who is NOT the caller)
        receiver_id = str(call.receiver.id) if str(call.caller.id) == caller_id else str(call.caller.id)

        # Send to chat WebSocket group (for when both are on chat page)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'call_offer',
                'call_id': str(call_id),
                'caller_id': caller_id,
                'caller_username': caller_username,
                'call_type': call_type,
                'offer': offer,
                'conversation_id': str(self.conversation_id),
            }
        )

        # ALSO send to receiver's global notification WebSocket (for when receiver is elsewhere)
        await self.channel_layer.group_send(
            f'user_{receiver_id}_notifications',
            {
                'type': 'call_offer',  # Note: underscore for channel layer routing
                'call_id': str(call_id),
                'caller_id': caller_id,
                'caller_username': caller_username,
                'call_type': call_type,
                'offer': offer,
                'conversation_id': str(self.conversation_id),
            }
        )

        print(f"[Call Offer] Routed to chat group and user_{receiver_id}_notifications")

    async def handle_call_answer(self, data):
        """Handle call answer and route to both chat group AND caller's global notification group"""
        call_id = data.get('call_id')
        answer = data.get('answer')

        # Get the call from database to find the caller
        call = await self.get_call(call_id)
        if not call:
            print(f"Call {call_id} not found")
            return

        caller_id = str(call.caller.id)
        receiver_id = str(self.user.id)

        # Send to chat WebSocket group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'call_answer',
                'call_id': str(call_id),
                'answer': answer,
                'receiver_id': receiver_id,
            }
        )

        # ALSO send to caller's global notification WebSocket
        await self.channel_layer.group_send(
            f'user_{caller_id}_notifications',
            {
                'type': 'call_answer',  # Note: underscore for channel layer routing
                'call_id': str(call_id),
                'answer': answer,
                'receiver_id': receiver_id,
            }
        )

        print(f"[Call Answer] Routed to chat group and user_{caller_id}_notifications")

    # Channel layer message handlers (called via group_send)
    async def call_offer(self, event):
        """Send call offer to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'call.offer',  # Note: dot for frontend
            'call_id': event['call_id'],
            'caller_id': event['caller_id'],
            'caller_username': event.get('caller_username'),
            'call_type': event.get('call_type'),
            'offer': event['offer'],
            'conversation_id': event.get('conversation_id'),
        }))

    async def call_answer(self, event):
        """Send call answer to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'call.answer',  # Note: dot for frontend
            'call_id': event['call_id'],
            'answer': event['answer'],
            'receiver_id': event.get('receiver_id'),
        }))

    async def call_end(self, event):
        """Send call end notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'call.end',
            'call_id': event['call_id'],
        }))

    # Database helpers
    @database_sync_to_async
    def get_call(self, call_id):
        try:
            from calls.models import Call
            return Call.objects.select_related('caller', 'receiver').get(id=call_id)
        except Call.DoesNotExist:
            return None

    async def handle_message(self, data):
        """Handle regular chat messages"""
        # Your existing message handling code
        pass

    async def handle_typing(self, data):
        """Handle typing indicators"""
        # Your existing typing handling code
        pass

    # Message handlers for receiving from channel layer
    async def chat_message(self, event):
        """Send chat message to WebSocket"""
        await self.send(text_data=json.dumps(event['message']))

    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket"""
        await self.send(text_data=json.dumps(event))
```

### 2. Global Notification WebSocket Consumer (`notifications/consumers.py` or similar)

This consumer handles the global notification WebSocket and must have handlers for call messages:

```python
# notifications/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close()
            return

        self.notification_group_name = f'user_{self.user.id}_notifications'

        # Join personal notification group
        await self.channel_layer.group_add(
            self.notification_group_name,
            self.channel_name
        )

        await self.accept()

        # Send connection acknowledgment
        await self.send(text_data=json.dumps({
            'type': 'connection.ack'
        }))

        print(f"[NotificationWS] User {self.user.id} connected to {self.notification_group_name}")

    async def disconnect(self, close_code):
        # Leave notification group
        if hasattr(self, 'notification_group_name'):
            await self.channel_layer.group_discard(
                self.notification_group_name,
                self.channel_name
            )
        print(f"[NotificationWS] User {self.user.id} disconnected")

    async def receive(self, text_data):
        """Handle messages from WebSocket (heartbeat, etc.)"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'ping':
                # Respond to heartbeat
                await self.send(text_data=json.dumps({
                    'type': 'pong'
                }))

        except Exception as e:
            print(f"Error in NotificationConsumer.receive: {e}")

    # ==================== CALL MESSAGE HANDLERS ====================

    async def call_offer(self, event):
        """
        Handle call.offer messages from channel layer
        This is called when a call offer is sent to this user's notification group
        """
        await self.send(text_data=json.dumps({
            'type': 'call.offer',  # Note: dot for frontend
            'call_id': event['call_id'],
            'caller_id': event['caller_id'],
            'caller_username': event.get('caller_username'),
            'call_type': event.get('call_type'),
            'offer': event['offer'],
            'conversation_id': event.get('conversation_id'),
        }))
        print(f"[NotificationWS] Sent call.offer to user {self.user.id}")

    async def call_answer(self, event):
        """
        Handle call.answer messages from channel layer
        This is called when a call answer is sent to this user's notification group
        """
        await self.send(text_data=json.dumps({
            'type': 'call.answer',  # Note: dot for frontend
            'call_id': event['call_id'],
            'answer': event['answer'],
            'receiver_id': event.get('receiver_id'),
        }))
        print(f"[NotificationWS] Sent call.answer to user {self.user.id}")

    async def call_end(self, event):
        """
        Handle call.end messages from channel layer
        """
        await self.send(text_data=json.dumps({
            'type': 'call.end',
            'call_id': event['call_id'],
        }))
        print(f"[NotificationWS] Sent call.end to user {self.user.id}")

    # ==================== NOTIFICATION HANDLERS ====================

    async def notification_created(self, event):
        """
        Handle general notification.created messages from channel layer
        This is your existing notification handler
        """
        await self.send(text_data=json.dumps({
            'type': 'notification.created',
            'payload': event['payload']
        }))
```

### 3. Call Initiation View (`calls/views.py` or `api/views.py`)

Update the call initiation endpoint to include `conversation_id` in the notification:

```python
# calls/views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from .models import Call
from .serializers import CallSerializer

User = get_user_model()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_call(request):
    """Initiate a voice or video call"""
    receiver_id = request.data.get('receiver_id')
    call_type = request.data.get('call_type', 'voice')  # 'voice' or 'video'
    conversation_id = request.data.get('conversation_id')

    if not receiver_id:
        return Response(
            {'error': 'receiver_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        receiver = User.objects.get(id=receiver_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'Receiver not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Create the call
    call = Call.objects.create(
        caller=request.user,
        receiver=receiver,
        call_type=call_type,
        conversation_id=conversation_id,
        status='ringing'
    )

    # Send notification to receiver's global notification WebSocket
    channel_layer = get_channel_layer()

    # Prepare notification data
    notification_data = {
        'id': call.id,
        'actor': {
            'id': str(request.user.id),
            'username': request.user.username,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
        },
        'verb': f'incoming_{call_type}_call',  # 'incoming_voice_call' or 'incoming_video_call'
        'object_id': call.id,
        'conversation_id': conversation_id,  # IMPORTANT: Include this
        'timestamp': call.created_at.isoformat() if hasattr(call, 'created_at') else None,
    }

    # Send to receiver's global notification group
    async_to_sync(channel_layer.group_send)(
        f'user_{receiver.id}_notifications',
        {
            'type': 'notification_created',
            'payload': notification_data
        }
    )

    print(f"[Call Initiate] Sent notification to user_{receiver.id}_notifications")

    # Serialize and return the call
    serializer = CallSerializer(call)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_call(request, call_id):
    """Accept an incoming call"""
    try:
        call = Call.objects.get(id=call_id)
    except Call.DoesNotExist:
        return Response(
            {'error': 'Call not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Verify the user is the receiver
    if call.receiver != request.user:
        return Response(
            {'error': 'You are not the receiver of this call'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Update call status
    call.status = 'active'
    call.save()

    serializer = CallSerializer(call)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_call(request, call_id):
    """Reject an incoming call"""
    try:
        call = Call.objects.get(id=call_id)
    except Call.DoesNotExist:
        return Response(
            {'error': 'Call not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Verify the user is the receiver
    if call.receiver != request.user:
        return Response(
            {'error': 'You are not the receiver of this call'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Update call status
    call.status = 'rejected'
    call.save()

    # Notify caller
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'user_{call.caller.id}_notifications',
        {
            'type': 'call_end',
            'call_id': str(call.id),
        }
    )

    return Response({'status': 'rejected'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def end_call(request, call_id):
    """End an active call"""
    try:
        call = Call.objects.get(id=call_id)
    except Call.DoesNotExist:
        return Response(
            {'error': 'Call not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Verify the user is part of the call
    if call.caller != request.user and call.receiver != request.user:
        return Response(
            {'error': 'You are not part of this call'},
            status=status.HTTP_403_FORBIDDEN
        )

    # Update call status and duration
    call.status = 'ended'
    duration_seconds = request.data.get('duration_seconds', 0)
    call.duration_seconds = duration_seconds
    call.save()

    # Notify the other party
    other_user = call.receiver if call.caller == request.user else call.caller
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'user_{other_user.id}_notifications',
        {
            'type': 'call_end',
            'call_id': str(call.id),
        }
    )

    return Response({'status': 'ended', 'duration': duration_seconds})
```

### 4. WebSocket Routing (`routing.py`)

Make sure your routing is set up correctly:

```python
# your_app/routing.py
from django.urls import re_path
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from chat.consumers import ChatConsumer
from notifications.consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<conversation_id>\d+)/$', ChatConsumer.as_asgi()),
    re_path(r'ws/notifications/$', NotificationConsumer.as_asgi()),
    # ... other websocket routes
]

application = ProtocolTypeRouter({
    'websocket': AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
```

### 5. URL Configuration (`urls.py`)

```python
# calls/urls.py or api/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('calls/initiate/', views.initiate_call, name='initiate_call'),
    path('calls/<int:call_id>/accept/', views.accept_call, name='accept_call'),
    path('calls/<int:call_id>/reject/', views.reject_call, name='reject_call'),
    path('calls/<int:call_id>/end/', views.end_call, name='end_call'),
]
```

## Key Points

### Django Channels Message Type Naming

**IMPORTANT**: Django Channels has a specific naming convention:

- **When sending via `group_send`**: Use underscores (e.g., `'type': 'call_offer'`)
- **Handler method name**: Must match with underscores (e.g., `async def call_offer(self, event):`)
- **When sending to frontend**: Use dots (e.g., `'type': 'call.offer'`)

### Message Flow

1. **Call Initiation**:
   - Frontend POST `/api/calls/initiate/`
   - Backend creates Call in database
   - Backend sends `notification.created` to receiver's global notification group
   - Receiver sees incoming call modal (anywhere on site)

2. **Call Offer (WebRTC)**:
   - Caller's frontend sends `call.offer` with SDP through WebSocket
   - Backend routes to BOTH:
     - Chat WebSocket group
     - Receiver's global notification group
   - Receiver gets offer SDP (even if not on chat page)

3. **Call Answer (WebRTC)**:
   - Receiver's frontend sends `call.answer` with SDP through WebSocket
   - Backend routes to BOTH:
     - Chat WebSocket group
     - Caller's global notification group
   - Caller gets answer SDP
   - WebRTC connection established

4. **Call End**:
   - Either party sends POST `/api/calls/{id}/end/`
   - Backend notifies other party via global notification group

## Testing Checklist

- [ ] Voice call: Both users on chat page
- [ ] Voice call: Caller on chat page, receiver on feed page
- [ ] Voice call: Both users on different pages
- [ ] Video call: Both users on chat page
- [ ] Video call: Caller on chat page, receiver on feed page
- [ ] Video call: Both users on different pages
- [ ] Call rejection works globally
- [ ] Call ending works globally
- [ ] Call duration is recorded correctly

## Deployment

After implementing these changes:

1. Run migrations if you added/changed models:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

2. Restart your Django/Channels server:
   ```bash
   # For local development
   python manage.py runserver

   # For production with Daphne
   daphne -b 0.0.0.0 -p 8000 your_project.asgi:application
   ```

3. If using AWS ECS, redeploy your task definition

4. Verify WebSocket connections in browser console

## Frontend is Ready!

The frontend has been fully updated to:
- ✅ Handle call notifications from global WebSocket
- ✅ Route call signaling through global WebSocket when no chat WebSocket available
- ✅ Display incoming calls globally (anywhere on site)
- ✅ Support both voice and video calls
- ✅ Clean up camera/mic properly to prevent "already in use" errors

Once you deploy this backend code, calls will work globally! 🎉
