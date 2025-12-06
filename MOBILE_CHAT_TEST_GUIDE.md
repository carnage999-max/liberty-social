# Mobile Chat Features - Quick Test Guide

## 🚀 Quick Start Testing

### Prerequisites
1. Two devices (or emulator + device)
2. Both logged into the app
3. Open the same chat conversation on both devices

---

## 1️⃣ Typing Indicators

**What to test:**
- Type a message slowly on Device A
- Watch Device B for typing indicator
- Stop typing and watch indicator disappear

**Expected behavior:**
- Dots animate while typing ✓
- Name displays with "is typing..." ✓
- Indicator shows for ~3 seconds after you stop ✓

**Test command:** Just start typing in the message input

---

## 2️⃣ Header Menu

**What to test:**
- Tap the **⋮** (three dots) in the top-right header

**Expected behavior:**
1. **View Profile** → Takes you to the other person's profile ✓
2. **Block User** → Shows toast "Block functionality coming soon" ✓
3. **Clear Chat** → Shows confirmation, clears all messages ✓

**Test commands:**
```
Tap ⋮ → Tap "View Profile"        (should navigate)
Tap ⋮ → Tap "Block User"          (should show toast)
Tap ⋮ → Tap "Clear Chat" → Confirm (should clear chat)
```

---

## 3️⃣ Media Upload

**What to test:**
- Tap the **📎** (attachment) icon
- Select an image or video
- Send the message

**Expected behavior:**
- Image preview appears ✓
- Attachment button shows media ✓
- Send succeeds without 400 error ✓
- Message appears with image/video ✓

**Test commands:**
```
Tap 📎 → Select Image             (should show preview)
Tap Send                          (should upload successfully)
Tap 📎 → Select Video             (should handle video)
```

---

## 4️⃣ Message Reactions

**What to test:**
- **Long-press** (hold down) any message
- Select an emoji from the picker
- Watch the reaction appear

**Expected behavior:**
- Picker modal appears on long-press ✓
- Emojis appear below the message ✓
- Toast shows "Reaction added!" ✓
- Multiple people can react ✓

**Test commands:**
```
Long-press Message → Select 😀   (reaction appears below)
Long-press Same Message → Select ❤️ (second reaction appears)
Tap ❤️ Button on Message           (reopens picker)
```

---

## 5️⃣ Message Edit

**What to test:**
- **Long-press** any message you sent
- Tap **"Edit"** button
- Modify the text
- Tap send

**Expected behavior:**
- Edit indicator appears at top ✓
- Shows original message text ✓
- Input placeholder changes to "Edit message..." ✓
- Toast shows "Message updated" ✓
- Message updates in chat ✓

**Test commands:**
```
Long-press Your Message           (should show menu)
Tap Edit                          (edit indicator appears)
Modify Text                       (edit the content)
Tap Send                          (sends PATCH request)
Verify Message Updated            (new content displays)
```

---

## 6️⃣ Message Delete

**What to test:**
- **Long-press** any message
- Tap **"Delete"** button (red)
- Confirm deletion

**Expected behavior:**
- Confirmation alert appears ✓
- Toast shows "Message deleted" ✓
- Message shows "This message was deleted" ✓
- Can still see conversation thread ✓

**Test commands:**
```
Long-press Your Message           (should show menu)
Tap Delete (red)                  (confirmation alert)
Tap "Delete" (red button)         (message deleted)
Verify Deleted State              (shows "deleted" text)
```

---

## 📊 Feature Comparison Matrix

| Feature | Mobile | Frontend | Status |
|---------|--------|----------|--------|
| Send Messages | ✅ | ✅ | ✅ Parity |
| Typing Indicators | ✅ | ✅ | ✅ Parity |
| Media Upload | ✅ | ✅ | ✅ Parity |
| Message Reactions | ✅ | ✅ | ✅ Parity |
| Message Edit | ✅ | ✅ | ✅ Parity |
| Message Delete | ✅ | ✅ | ✅ Parity |
| Message Search | ❌ | ❌ | ⏳ Pending |
| Reply Threading | ❌ | ❌ | ⏳ Pending |

---

## 🐛 Troubleshooting

### Typing Indicator not showing?
1. Check both devices on same conversation
2. Verify WebSocket connection (check Network tab)
3. Restart app if stuck

### Media upload returns error?
1. Check file size < 10MB
2. Verify image/video format is supported
3. Check network connectivity
4. Check API is accessible

### Reaction not showing?
1. Try closing/reopening chat
2. Verify message loaded completely
3. Check long-press is at least 500ms

### Edit not working?
1. Can only edit your own messages
2. Verify message is loaded
3. Check network connection
4. Try again with shorter text first

### Delete confirmation not appearing?
1. Long-press must be on own message
2. Verify device supports Alert API
3. Try restarting app

---

## ✅ Quick Test Checklist

### Device A (Sender)
- [ ] Start typing message
- [ ] Watch Device B for typing indicator
- [ ] Send regular text message
- [ ] Send message with media attachment
- [ ] Long-press your message and edit it
- [ ] Long-press your message and react
- [ ] Long-press your message and delete it

### Device B (Receiver)
- [ ] See typing indicator while Device A types
- [ ] Receive text message
- [ ] Receive message with media (appears in chat)
- [ ] See Device A's edited message
- [ ] See reaction on Device A's message
- [ ] See deleted message state

---

## 📝 Notes for Testing

- **Time to test:** ~10-15 minutes per feature
- **Required:** Two devices/emulators on same network
- **Best on:** Real devices (more accurate typing indicator timing)
- **Screenshot:** Take screenshots of final states for documentation

---

## 🎯 Success Criteria

**All features pass if:**
1. ✅ No crashes when testing any feature
2. ✅ All UI elements appear correctly
3. ✅ API calls complete without errors
4. ✅ Real-time updates visible on both devices
5. ✅ Toast notifications appear appropriately
6. ✅ Can perform quick succession of interactions

---

**Last Updated:** 2024  
**Version:** v1.0 - Complete Mobile Chat Features  
**Status:** Ready for QA Testing
