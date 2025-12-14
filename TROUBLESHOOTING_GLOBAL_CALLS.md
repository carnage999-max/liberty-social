# Troubleshooting Global Calls

## Issue: "Timeout waiting for offer SDP"

This error means the receiver accepted the call but never received the WebRTC offer from the caller.

### Diagnostic Steps

#### 1. Check Caller's Console Logs

**What to look for:**
```
[WebRTC] Signal data (offer) generated
[WebRTC] ✅ Offer sent via WebSocket
```

**If you see:**
- ✅ "Offer sent via WebSocket" → Caller sent the offer, problem is in backend or receiver
- ❌ "WebSocket not connected" → Caller's WebSocket is not set up

#### 2. Check Backend Logs (CloudWatch or local)

**What to look for:**
```
[CHATWS] Routing call.offer to receiver's global notification group: user_XXX_notifications
```
OR
```
[NotificationWS] Routing call.offer to receiver's notification group: user_XXX_notifications
```
AND
```
[NotificationWS] Sending call.offer to client - call_id=XXX
```

**If missing:**
- Backend is not receiving the offer from caller
- OR backend is not routing it to receiver

#### 3. Check Receiver's Console Logs

**What to look for:**
```
[GlobalNotificationWS] Received: call.offer
[CallContext] Call offer received
[WebRTC] Offer SDP present and we are the receiver
```

**If missing:**
- Receiver's global WebSocket is not receiving the offer
- Backend is not sending it

### Common Issues

#### Issue 1: Caller's WebSocket Not Connected

**Symptom:**
```
[WebRTC] ❌ WebSocket not connected
```

**Cause:** Caller's global notification WebSocket is not set as the signaling WebSocket.

**Check:**
```
[CallContext] Global notification WebSocket ready, setting as fallback for WebRTC
[CallContext] No chat WebSocket, using global WebSocket for call signaling
```

**Fix:** Ensure CallContext is setting the global WebSocket in useWebRTC.

---

#### Issue 2: Backend Not Routing Offer

**Symptom:** Caller sends offer, but backend logs show error or nothing.

**Cause:**
- Backend code not deployed
- Error in NotificationConsumer._handle_call_offer_from_client()
- Call object not found in database

**Check Backend Logs for:**
```
[NotificationWS] Error routing call.offer: ...
```

**Fix:** Check CloudWatch logs for Python exceptions.

---

#### Issue 3: Conversation ID Missing

**Symptom:** Backend tries to route but fails because conversation_id is needed.

**Cause:** Frontend not sending conversation_id in call.offer message.

**Check Frontend:**
The offer should include:
```javascript
{
  type: "call.offer",
  call_id: "93",
  call_type: "voice",
  caller_id: "...",
  caller_username: "...",
  offer: { ... },  // SDP offer
  conversation_id: "..."  // THIS MIGHT BE MISSING
}
```

**Fix:** Update useWebRTC to include conversation_id when sending offer.

---

## Quick Fix: Add conversation_id to call.offer

The most likely issue is that the caller's offer doesn't include `conversation_id`, which the backend needs to properly route.

### Frontend Fix Needed

In `frontend/hooks/useWebRTC.ts`, around line 162-170, update:

```typescript
wsRef.current.send(
  JSON.stringify({
    type: "call.offer",
    call_id: call.id.toString(),
    call_type: type,
    caller_id: call.caller?.id?.toString() || call.caller_id?.toString(),
    caller_username: call.caller?.username || call.caller_username,
    offer: data,
    conversation_id: call.conversation?.id?.toString() || call.conversation_id?.toString() || callConversationId || conversationId,  // ADD THIS
  })
);
```

Also in the answer handler (around line 281-289):

```typescript
wsRef.current.send(
  JSON.stringify({
    type: "call.answer",
    call_id: callId,
    answer: data,
    receiver_id: receiverId,
    conversation_id: currentCall?.conversation?.id?.toString() || currentCall?.conversation_id?.toString(),  // ADD THIS
  })
);
```

## Verification After Fix

### Expected Caller Logs:
```
[WebRTC] initiateCall called
[WebRTC] ✅ API response: {id: 93, conversation: {id: "..."}, ...}
[WebRTC] Signal data (offer) generated
[WebRTC] ✅ Offer sent via WebSocket
```

### Expected Backend Logs:
```
[CALL] Sending call.incoming to notification group: user_XXX_notifications
[NotificationWS] Routing call.offer to receiver's notification group: user_XXX_notifications
[NotificationWS] Sending call.offer to client - call_id=93
```

### Expected Receiver Logs:
```
[GlobalNotificationWS] Received: notification.created (verb: incoming_voice_call)
[GlobalNotificationWS] Received: call.offer
[CallContext] Call offer received
[WebRTC] Offer SDP present and we are the receiver, notifying WebRTC hook
[WebRTC] ✅ Creating peer as receiver
[WebRTC] Signal data (answer) generated
[WebRTC] ✅ Answer sent via WebSocket
[WebRTC] ✅ Remote stream received (receiver)
[WebRTC] ✅ Peer connected - WebRTC connection established!
```

### Expected Caller's Response:
```
[GlobalNotificationWS] Received: call.answer
[CallContext] Answer SDP present and we are the caller, notifying WebRTC hook
[WebRTC] ✅ Remote stream received (initiator)
[WebRTC] ✅ Peer connected
```

## If Still Not Working

1. **Share full caller console logs** - From page load to call initiation
2. **Share backend CloudWatch logs** - Filter by call_id
3. **Check which WebSocket caller is using**:
   ```
   [CallContext] Setting chat WebSocket for call signaling
   ```
   OR
   ```
   [CallContext] No chat WebSocket, using global WebSocket for call signaling
   ```

4. **Verify backend deployment**:
   ```bash
   cd backend
   python3 verify_call_implementation.py
   ```

5. **Check if both users are on same page or different pages**

## Next Steps

1. First, please share the **caller's console logs**
2. I'll provide the exact fix based on what we find
3. The fix will likely be adding `conversation_id` to the WebRTC signaling messages
