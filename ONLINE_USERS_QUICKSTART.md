# Online Users Feature - Quick Start Guide

## What Was Created

A complete real-time online user presence tracking system with:

✅ **Backend**:
- User model fields for online status tracking (is_online, last_seen, last_activity)
- REST API endpoint to fetch online users
- WebSocket consumer for real-time status broadcasting
- Database migration ready to apply

✅ **Frontend**:
- Reusable OnlineUsers component with premium styling
- useUserStatus hook for WebSocket management
- UserStatusProvider for global connection management
- Auto-reconnection logic with exponential backoff

## Implementation Steps

### Step 1: Apply Database Migration

```bash
cd backend
python manage.py migrate users
```

This adds the three new fields to track user online status.

### Step 2: Integrate UserStatusProvider (Root Layout)

Edit your root layout file to add the provider:

```tsx
// frontend/app/layout.tsx or your root layout
import { AuthProvider } from '@/lib/auth-context';
import { UserStatusProvider } from '@/lib/user-status-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AuthProvider>
          <UserStatusProvider>
            {children}
          </UserStatusProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

**Why**: This starts the WebSocket connection automatically for all authenticated users.

### Step 3: Add OnlineUsers Component to Your Pages

Example 1: Add to messaging page

```tsx
// frontend/app/messages/page.tsx
import OnlineUsers from '@/components/OnlineUsers';

export default function MessagesPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
      <div className="lg:col-span-3">
        {/* Your messages component */}
      </div>
      
      <div className="lg:col-span-1">
        <OnlineUsers
          maxUsers={8}
          title="Who's Online?"
          onUserClick={(user) => {
            // Handle user click - start conversation, view profile, etc.
          }}
        />
      </div>
    </div>
  );
}
```

Example 2: Add to sidebar

```tsx
// frontend/components/Sidebar.tsx
import OnlineUsers from '@/components/OnlineUsers';

export default function Sidebar() {
  return (
    <div className="w-64 p-4">
      <OnlineUsers
        maxUsers={10}
        title="Online Friends"
      />
    </div>
  );
}
```

### Step 4: Restart Backend Services

```bash
# In a terminal at the backend directory
python manage.py runserver

# In another terminal, start Daphne ASGI server (for WebSocket support)
daphne -b 0.0.0.0 -p 8001 liberty_social.asgi:application

# Or use docker-compose
docker-compose up
```

### Step 5: Test in Frontend

The component will:
1. ✅ Auto-connect to WebSocket when user authenticates
2. ✅ Fetch online users from `/api/users/online/` endpoint
3. ✅ Display them in a beautiful gradient card layout
4. ✅ Refresh every 30 seconds
5. ✅ Receive real-time status updates via WebSocket

## Component Styling

The OnlineUsers component features:

- **Background**: Red (#dc2626) to Blue (#1e3a8a) gradient
  - Represents American flag colors
  - Subtle radial gradient overlay for depth

- **Text**: Golden (#fbbf24)
  - Usernames and titles in gold
  - Hover effect to lighter gold (#fcd34d)

- **Online Indicator**: Green dot (bottom-right of avatar)
  - Shows online status at a glance

- **Layout**: Responsive grid
  - Mobile: 2 columns
  - Tablet: 3 columns
  - Desktop: 4-5 columns

- **Interactions**:
  - Click avatar to trigger onUserClick callback
  - Hover shows username tooltip
  - Scale animation on hover (105%)
  - Border highlights (golden border around avatars)

## What The Backend Does

1. **Tracks Online Status**:
   - Sets `user.is_online = True` when user connects to WebSocket
   - Sets `user.is_online = False` when user disconnects

2. **Broadcasts Changes**:
   - Sends `user.status.changed` event to all connected clients when someone comes online/offline
   - Updates `last_activity` on every ping (every 30 seconds)

3. **Serves Online Users List**:
   - `GET /api/users/online/` returns users where `is_online = True`
   - Excludes the requesting user
   - Returns ID, username, profile image, and status info

## What The Frontend Does

1. **Connects to WebSocket**:
   - Establishes connection to `ws://localhost:8000/ws/user-status/?token=TOKEN`
   - Automatically reconnects if connection drops

2. **Sends Keep-Alive**:
   - Sends ping every 30 seconds to maintain connection
   - Server updates `last_activity` on each ping

3. **Receives Status Updates**:
   - Listens for `user.status.changed` events
   - Updates UI when users come online/offline
   - Re-fetches list every 30 seconds for fresh data

4. **Displays Component**:
   - Shows online users with avatars
   - Green indicator dot for online status
   - Click handlers for navigation/actions
   - Responsive design for all screen sizes

## Environment Variables

Make sure your backend `.env` has:

```bash
# Redis configuration (for Channels)
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/liberty_social

# Django
DEBUG=False
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1
```

And frontend `.env.local` has:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

## Testing the Feature

### Test 1: Open Multiple Browser Tabs

1. Open `localhost:3000/app/messages` in Tab 1
2. Open `localhost:3000/app/messages` in Tab 2
3. You should see yourself appear in "Online Users" in both tabs
4. Open DevTools → Application → Local Storage to verify tokens are the same

### Test 2: Check WebSocket Connection

1. Open DevTools → Network → Filter by WS
2. You should see connection to `/ws/user-status/`
3. Status should show "101 Switching Protocols"
4. Messages should show ping/pong traffic every 30 seconds

### Test 3: Verify Status Changes

1. Close Tab 2
2. Wait for WebSocket to close on backend
3. Within 30 seconds, check Tab 1
4. You should see online users list update (yourself removed or count decreased)

### Test 4: Check API Endpoint

```bash
# Get your token
TOKEN=$(jq -r '.liberty_auth_v1 | fromjson | .accessToken' ~/.config/app/localStorage.json)

# Call the API
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/users/online/

# Should return:
# [{"id": "...", "username": "...", "is_online": true, ...}]
```

## Troubleshooting

### Issue: "OnlineUsers component not rendering"

**Solution**: Ensure UserStatusProvider wraps your component tree and you're authenticated

```tsx
// ✅ Correct
<AuthProvider>
  <UserStatusProvider>
    <App />
  </UserStatusProvider>
</AuthProvider>

// ❌ Wrong - Provider outside auth provider
<UserStatusProvider>
  <AuthProvider>
    <App />
  </AuthProvider>
</UserStatusProvider>
```

### Issue: WebSocket connection fails

**Solution**: Check that:
1. Backend is running with Daphne ASGI (not just runserver)
2. Redis is running: `redis-cli ping` → should return `PONG`
3. Token is valid and not expired
4. CORS is configured if frontend and backend on different origins

### Issue: Users stay online after closing browser

**Solution**: The consumer's `disconnect()` method takes a few seconds. Users will be marked offline when:
1. Browser closes connection
2. WebSocket timeout triggers (if Redis connection lost)
3. Server restart/redeployment

You can manually trigger by opening DevTools → Network → finding WebSocket → clicking "close"

## File Locations

**Backend Files**:
- Migration: `/backend/users/migrations/0009_user_is_online_user_last_activity_user_last_seen.py`
- Model: `/backend/users/models.py` (User class, lines 42-68)
- Serializer: `/backend/users/serializers.py` (UserStatusSerializer)
- View: `/backend/users/views.py` (OnlineUsersView)
- Consumer: `/backend/main/consumers.py` (UserStatusConsumer)
- Routing: `/backend/liberty_social/routing.py` (WebSocket URLs)
- URL Config: `/backend/users/urls.py` (REST endpoint)

**Frontend Files**:
- Component: `/frontend/components/OnlineUsers.tsx`
- Hook: `/frontend/hooks/useUserStatus.ts`
- Provider: `/frontend/lib/user-status-provider.tsx`

## Next Steps

### Optional Enhancements

1. **Filter Online Users**: Only show friends/connections
   ```tsx
   <OnlineUsers filter="friends" />
   ```

2. **Add Presence Modes**: Away, DND, Invisible status
   - Update User model with presence_mode field
   - Update serializer to include presence_mode
   - Update component to show different indicators

3. **Offline Indicators**: Show when users were last seen
   - Component already displays `last_seen` timestamp
   - Could add "Last seen 2 minutes ago" text

4. **Notification on Join**: Notify when specific users come online
   - Listen to WebSocket events
   - Filter for specific user IDs
   - Show toast notification

5. **Activity Timeline**: Show friend activity history
   - Log all joins/leaves to a new Activity model
   - Create activity feed page
   - Show timestamps and user details

6. **Custom Status**: Let users set custom status messages
   - Add status_message field to User model
   - Update OnlineUsersView to include in response
   - Display status in tooltip

## Support & Documentation

- **Full Feature Docs**: See `/home/binary/Desktop/liberty-social/ONLINE_USERS_FEATURE.md`
- **API Reference**: See ONLINE_USERS_FEATURE.md → API Reference section
- **WebSocket Spec**: See ONLINE_USERS_FEATURE.md → WebSocket Connection section
- **Architecture Diagram**: See ONLINE_USERS_FEATURE.md → Real-Time Data Flow section

---

**Ready to go!** 🚀 Your real-time online users feature is now live.
