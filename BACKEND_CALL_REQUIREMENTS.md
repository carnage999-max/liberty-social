# Backend Requirements for Global Call Notifications

## Current Issue
Incoming calls only work when both users are on the same chat page because call signaling messages (`call.offer`, `call.answer`) are only sent through the **chat WebSocket** (`/ws/chat/<conversation_id>/`).

When a user receives a call but is NOT on the chat page, they don't have the chat WebSocket connected, so they never receive the incoming call notification.

## Required Backend Changes

### 1. Send `call.incoming` Through Global Notification WebSocket

When a call is initiated (POST `/calls/initiate/`), the backend should send a message to the **receiver** through the **global notification WebSocket** (`/ws/notifications/`):

```python
# In your call initiation logic (e.g., views.py or consumers.py)

# After creating the call in the database:
call = Call.objects.create(
    caller=request.user,
    receiver=receiver_user,
    call_type=call_type,
    conversation=conversation,
    # ... other fields
)

# Send notification to receiver's global notification WebSocket
channel_layer = get_channel_layer()
async_to_sync(channel_layer.group_send)(
    f"user_{receiver_user.id}_notifications",  # Global notification group
    {
        "type": "call.incoming",
        "call_id": str(call.id),
        "caller_id": str(request.user.id),
        "caller_username": request.user.username,
        "call_type": call_type,  # "voice" or "video"
        "conversation_id": str(conversation.id),
        "offer": None,  # Will be sent separately via call.offer
    }
)
```

### 2. Route Call Signaling Messages Through Global Notification WebSocket

The chat WebSocket consumer sends `call.offer` and `call.answer` messages. These need to ALSO be sent through the global notification WebSocket for users who aren't on the chat page.

#### In your Chat WebSocket Consumer (e.g., `chat_consumer.py`):

```python
async def receive(self, text_data):
    data = json.loads(text_data)
    message_type = data.get("type")

    if message_type == "call.offer":
        # Send to chat WebSocket group (existing logic)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "call.offer",
                "call_id": data.get("call_id"),
                "caller_id": data.get("caller_id"),
                "caller_username": data.get("caller_username"),
                "call_type": data.get("call_type"),
                "offer": data.get("offer"),  # SDP offer
                "conversation_id": str(self.conversation_id),
            }
        )

        # ALSO send to receiver's global notification WebSocket
        call = await sync_to_async(Call.objects.get)(id=data.get("call_id"))
        receiver_id = call.receiver.id if call.caller.id == self.user.id else call.caller.id

        await self.channel_layer.group_send(
            f"user_{receiver_id}_notifications",
            {
                "type": "call_offer",  # Note: use underscore for channel layer method routing
                "call_id": data.get("call_id"),
                "caller_id": data.get("caller_id"),
                "caller_username": data.get("caller_username"),
                "call_type": data.get("call_type"),
                "offer": data.get("offer"),
                "conversation_id": str(self.conversation_id),
            }
        )

    elif message_type == "call.answer":
        # Send to chat WebSocket group (existing logic)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "call.answer",
                "call_id": data.get("call_id"),
                "answer": data.get("answer"),  # SDP answer
                "receiver_id": str(self.user.id),
            }
        )

        # ALSO send to caller's global notification WebSocket
        call = await sync_to_async(Call.objects.get)(id=data.get("call_id"))
        caller_id = call.caller.id

        await self.channel_layer.group_send(
            f"user_{caller_id}_notifications",
            {
                "type": "call_answer",  # Note: use underscore for channel layer method routing
                "call_id": data.get("call_id"),
                "answer": data.get("answer"),
                "receiver_id": str(self.user.id),
            }
        )
```

#### In your Global Notification WebSocket Consumer (e.g., `notification_consumer.py`):

```python
class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        self.notification_group_name = f"user_{self.user.id}_notifications"

        # Join notification group
        await self.channel_layer.group_add(
            self.notification_group_name,
            self.channel_name
        )

        await self.accept()
        await self.send(text_data=json.dumps({
            "type": "connection.ack"
        }))

    async def disconnect(self, close_code):
        # Leave notification group
        await self.channel_layer.group_discard(
            self.notification_group_name,
            self.channel_name
        )

    # Handler for call.incoming messages
    async def call_incoming(self, event):
        await self.send(text_data=json.dumps({
            "type": "call.incoming",
            "call_id": event["call_id"],
            "caller_id": event["caller_id"],
            "caller_username": event["caller_username"],
            "call_type": event["call_type"],
            "conversation_id": event.get("conversation_id"),
        }))

    # Handler for call.offer messages (note: method name uses underscore)
    async def call_offer(self, event):
        await self.send(text_data=json.dumps({
            "type": "call.offer",  # Send as call.offer to frontend
            "call_id": event["call_id"],
            "caller_id": event["caller_id"],
            "caller_username": event.get("caller_username"),
            "call_type": event.get("call_type"),
            "offer": event["offer"],
            "conversation_id": event.get("conversation_id"),
        }))

    # Handler for call.answer messages (note: method name uses underscore)
    async def call_answer(self, event):
        await self.send(text_data=json.dumps({
            "type": "call.answer",  # Send as call.answer to frontend
            "call_id": event["call_id"],
            "answer": event["answer"],
            "receiver_id": event.get("receiver_id"),
        }))

    # Handler for call.end messages
    async def call_end(self, event):
        await self.send(text_data=json.dumps({
            "type": "call.end",
            "call_id": event["call_id"],
        }))

    # Existing notification handler
    async def notification_created(self, event):
        await self.send(text_data=json.dumps({
            "type": "notification.created",
            "payload": event["payload"]
        }))
```

### 3. Message Flow

**Scenario: User A calls User B, but User B is NOT on the chat page**

1. User A clicks "Call" button → POST `/calls/initiate/`
2. Backend creates call in database
3. Backend sends `call.incoming` to User B's global notification WebSocket
4. User B sees incoming call modal (globally, anywhere on the site)
5. User A's WebRTC hook sends `call.offer` through their WebSocket (chat or global)
6. Backend routes `call.offer` to User B's global notification WebSocket
7. User B clicks "Accept"
8. User B's WebRTC hook sends `call.answer` through global notification WebSocket
9. Backend routes `call.answer` to User A's WebSocket
10. WebRTC peer connection established, call starts

## Frontend Changes (Already Implemented)

✅ Global notification WebSocket forwards all `call.*` messages to CallContext
✅ CallContext uses global notification WebSocket as fallback for signaling when no chat WebSocket available
✅ Incoming call modal appears globally when `call.incoming` or `call.offer` is received
✅ WebRTC hook can use either chat WebSocket or global notification WebSocket for signaling

## Testing

After deploying backend changes:

1. **Test 1**: User A on chat page, User B on feed page
   - User A initiates call
   - User B should see incoming call modal on feed page
   - User B accepts, call should work

2. **Test 2**: Both users on different pages (not chat)
   - User A on profile page initiates call
   - User B on marketplace page should see incoming call
   - Both should be able to communicate

3. **Test 3**: User A on chat page, User B on chat page (existing scenario)
   - Should continue working as before

## Important Notes

- Django Channels uses **underscore** in method names (e.g., `call_offer`) but sends **dots** in message types (e.g., `"type": "call.offer"`)
- The global notification WebSocket group name should be consistent: `f"user_{user_id}_notifications"`
- Make sure CHANNEL_LAYERS is properly configured in Django settings
- Consider adding error handling for cases where user is offline or WebSocket is disconnected

## Current Frontend Logs Show

The global notification WebSocket is now stable (reference counting fixed) and is properly dispatching call messages. The backend just needs to send the messages through it.
