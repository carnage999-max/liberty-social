# Frontend Call Features - Testing Guide

## Prerequisites

1. ✅ Backend deployed and running
2. ✅ Database migration applied (`python manage.py migrate`)
3. ✅ WebSocket server running
4. ✅ Frontend development server running (`npm run dev`)

## Testing Checklist

### 1. Basic Setup Test

**Test: Verify call buttons appear**
- [ ] Navigate to a 1-on-1 conversation
- [ ] Check header for voice (📞) and video (📹) call buttons
- [ ] Buttons should appear next to conversation title
- [ ] Buttons should be disabled if call is active/incoming

**Expected Result:**
- Call buttons visible in header
- Buttons are clickable (when no active call)

---

### 2. Voice Call Test

**Test: Initiate voice call**
1. Open a conversation with another user
2. Click the voice call button (📞)
3. Browser should request microphone permission
4. Grant permission

**Expected Result:**
- Call initiated
- Other user receives incoming call notification
- Caller sees "Calling..." or similar state

**Test: Receive voice call**
1. Have another user call you
2. Incoming call modal should appear
3. Shows caller's name and avatar
4. "Voice Call" label visible

**Expected Result:**
- Incoming call modal appears
- Auto-rejects after 30 seconds if not answered
- Accept/Reject buttons work

**Test: Accept voice call**
1. Click "Accept" on incoming call
2. Browser requests microphone permission (if not granted)
3. Active call screen appears

**Expected Result:**
- Active call modal shows
- Voice call UI (no video, just user info)
- Mute button works
- End call button works

**Test: End voice call**
1. Click "End Call" button
2. Call should terminate

**Expected Result:**
- Call ends
- Modal closes
- Both users can see call ended

---

### 3. Video Call Test

**Test: Initiate video call**
1. Click video call button (📹)
2. Browser requests camera + microphone permissions
3. Grant permissions

**Expected Result:**
- Call initiated
- Local video preview appears (if supported)
- Other user receives video call notification

**Test: Accept video call**
1. Accept incoming video call
2. Grant camera + microphone permissions

**Expected Result:**
- Active call modal shows
- Remote video (full screen)
- Local video (picture-in-picture, top-right)
- Mute, video toggle, and end call buttons work

**Test: Video call controls**
1. During active video call:
   - Click mute button - audio should mute/unmute
   - Click video toggle - camera should turn on/off
   - Click end call - call should terminate

**Expected Result:**
- All controls work correctly
- Visual feedback for muted/disabled states

---

### 4. Call Rejection Test

**Test: Reject incoming call**
1. Receive incoming call
2. Click "Reject" button

**Expected Result:**
- Call rejected
- Modal closes immediately
- Caller sees "Call rejected" or similar

---

### 5. WebSocket Signaling Test

**Test: Check browser console**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Initiate a call
4. Check for WebSocket messages

**Expected Result:**
- No errors in console
- WebSocket messages logged (optional)
- `call.offer`, `call.answer`, `call.ice-candidate` messages visible

---

### 6. Error Handling Test

**Test: Permission denied**
1. Deny microphone/camera permissions
2. Try to initiate call

**Expected Result:**
- Error message shown
- Call not initiated
- User can retry

**Test: Network issues**
1. Disconnect network during call
2. Reconnect

**Expected Result:**
- Call may drop (expected)
- Error handling works
- Can initiate new call after reconnect

---

## Common Issues & Solutions

### Issue: Call buttons not appearing
**Solution:**
- Check if conversation is 1-on-1 (not group chat)
- Verify user is logged in
- Check browser console for errors

### Issue: "Failed to start call" error
**Solution:**
- Check backend is running
- Verify API endpoint `/api/calls/initiate/` is accessible
- Check browser console for detailed error

### Issue: No incoming call notification
**Solution:**
- Verify WebSocket connection is active
- Check both users are in the same conversation
- Verify backend WebSocket server is running

### Issue: Video not showing
**Solution:**
- Check camera permissions granted
- Verify browser supports WebRTC
- Check network connection
- Try refreshing the page

### Issue: Audio not working
**Solution:**
- Check microphone permissions
- Verify system audio settings
- Check browser audio settings
- Try different browser

---

## Browser Compatibility

### Supported Browsers:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest, macOS/iOS)
- ⚠️ Opera (should work)

### Requirements:
- HTTPS (required for WebRTC, except localhost)
- Modern browser with WebRTC support
- Microphone access (voice calls)
- Camera access (video calls)

---

## Testing with Two Users

### Setup:
1. Open app in two different browsers/incognito windows
2. Login as two different users
3. Start a conversation between them
4. Test calls between the two users

### Test Flow:
1. User A initiates call → User B receives notification
2. User B accepts → Both see active call
3. Test controls (mute, video toggle)
4. User A ends call → Both see call ended

---

## Debug Commands

### Check WebSocket Connection:
```javascript
// In browser console
// Check if WebSocket is connected
// Look for WebSocket messages in Network tab
```

### Check API Endpoints:
```bash
# Test call initiation (replace with your token)
curl -X POST http://localhost:8000/api/calls/initiate/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"receiver_id": 2, "call_type": "voice", "conversation_id": 1}'
```

### Check Browser Permissions:
- Chrome: `chrome://settings/content/microphone`
- Firefox: `about:preferences#privacy` → Permissions
- Safari: System Preferences → Security & Privacy

---

## Success Criteria

✅ All tests pass
✅ No console errors
✅ Calls connect successfully
✅ Audio/video work
✅ Controls function properly
✅ Error handling works
✅ WebSocket signaling works

---

## Next Steps After Testing

1. Fix any issues found
2. Test on mobile devices
3. Test with multiple users
4. Performance testing
5. Add TURN servers for production (if needed)

