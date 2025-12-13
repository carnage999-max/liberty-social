# Voice and Video Calling Implementation

## Overview
Voice and video calling features have been implemented using WebRTC for peer-to-peer communication with WebSocket signaling.

## Backend Implementation

### 1. Call Model (`backend/main/models.py`)
- **Call model** with fields:
  - `caller`, `receiver` (ForeignKeys to User)
  - `call_type` ("voice" or "video")
  - `status` (initiating, ringing, active, ended, missed, rejected, cancelled)
  - `conversation` (optional ForeignKey)
  - Timestamps: `started_at`, `answered_at`, `ended_at`
  - `duration_seconds`

### 2. WebSocket Signaling (`backend/main/consumers.py`)
Extended `ChatConsumer` to handle call signaling:
- `call.offer` - WebRTC offer from caller
- `call.answer` - WebRTC answer from receiver
- `call.ice-candidate` - ICE candidate exchange
- `call.end` - Call termination

### 3. API Endpoints (`backend/main/views.py`)
**CallViewSet** with actions:
- `POST /api/calls/initiate/` - Start a new call
- `POST /api/calls/{id}/accept/` - Accept incoming call
- `POST /api/calls/{id}/reject/` - Reject incoming call
- `POST /api/calls/{id}/end/` - End active call
- `GET /api/calls/` - List user's calls

## Frontend Implementation

### 1. WebRTC Hook (`frontend/hooks/useWebRTC.ts`)
- Manages WebRTC peer connections
- Handles local/remote media streams
- Provides functions: `initiateCall`, `answerCall`, `endCall`, `rejectCall`

### 2. Call Components
- **IncomingCallModal** (`frontend/components/calls/IncomingCallModal.tsx`)
  - Shows incoming call UI
  - Accept/Reject buttons
  - Auto-rejects after 30 seconds

- **ActiveCallModal** (`frontend/components/calls/ActiveCallModal.tsx`)
  - Full-screen call interface
  - Video display (local PIP, remote full-screen)
  - Controls: mute, video toggle, end call

### 3. Integration Points
To integrate into chat page (`frontend/app/app/messages/[id]/page.tsx`):

1. **Add state management:**
```typescript
const [incomingCall, setIncomingCall] = useState<any>(null);
const [activeCall, setActiveCall] = useState<any>(null);
const webrtc = useWebRTC({
  conversationId,
  onCallIncoming: (call) => setIncomingCall(call),
  onCallAccepted: (call) => {
    setIncomingCall(null);
    setActiveCall(call);
  },
  onCallEnded: () => setActiveCall(null),
});
```

2. **Add call buttons to header** (around line 1068):
```typescript
{conversation && !conversation.is_group && (() => {
  const otherParticipant = conversation.participants.find((p) => p.user.id !== user?.id);
  if (!otherParticipant) return null;
  return (
    <div className="flex gap-2">
      <button
        onClick={() => webrtc.initiateCall(otherParticipant.user.id, "voice")}
        className="text-gray-300 hover:text-white p-2 transition"
        title="Voice Call"
      >
        <Phone className="w-5 h-5" />
      </button>
      <button
        onClick={() => webrtc.initiateCall(otherParticipant.user.id, "video")}
        className="text-gray-300 hover:text-white p-2 transition"
        title="Video Call"
      >
        <Video className="w-5 h-5" />
      </button>
    </div>
  );
})()}
```

3. **Add modals:**
```typescript
{incomingCall && (
  <IncomingCallModal
    call={incomingCall}
    onAccept={() => {
      const otherParticipant = conversation?.participants.find((p) => p.user.id !== user?.id);
      if (otherParticipant) {
        webrtc.answerCall(incomingCall, incomingCall.call_type);
      }
    }}
    onReject={() => {
      webrtc.rejectCall(incomingCall.id);
      setIncomingCall(null);
    }}
    callerAvatar={/* get caller avatar */}
  />
)}

{activeCall && (
  <ActiveCallModal
    call={activeCall}
    otherUser={/* other participant */}
    onEndCall={() => setActiveCall(null)}
    isVideoCall={activeCall.call_type === "video"}
  />
)}
```

4. **Connect WebSocket:**
```typescript
// In useChatWebSocket hook, pass WebSocket to webrtc
webrtc.setWebSocket(ws);
```

## Mobile Implementation (TODO)

### Dependencies Needed:
```bash
cd mobile
npm install react-native-webrtc
```

### Implementation Steps:
1. Create `mobile/hooks/useWebRTC.ts` (similar to frontend)
2. Create `mobile/components/calls/IncomingCallScreen.tsx`
3. Create `mobile/components/calls/ActiveCallScreen.tsx`
4. Integrate into `mobile/app/(tabs)/messages/[id].tsx`

## Next Steps

1. **Run migration:**
```bash
cd backend
python3 manage.py migrate
```

2. **Test WebRTC:**
   - Ensure HTTPS in production (WebRTC requires secure context)
   - Test on real devices (WebRTC may not work in all browsers/devices)
   - Consider TURN servers for NAT traversal

3. **Add TURN servers** (for production):
   - Use services like Twilio, Agora, or self-hosted coturn
   - Update `iceServers` in `useWebRTC.ts`

4. **Mobile implementation:**
   - Install `react-native-webrtc`
   - Implement similar hooks and components
   - Handle permissions (camera, microphone)

## Notes

- WebRTC requires HTTPS in production (except localhost)
- STUN servers are free but may not work for all network configurations
- TURN servers are needed for users behind strict NATs/firewalls
- Call quality depends on network conditions
- Consider adding call recording, screen sharing, etc. in future

