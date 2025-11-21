# Online Users Feature Documentation

## Overview

The Online Users feature enables real-time tracking and display of which users are currently online in the application. This provides a social presence indicator similar to Facebook Messenger and helps users see who's available for interaction.

## Architecture

### Backend Components

#### 1. **User Model Enhancements** (`backend/users/models.py`)
New fields added to the `User` model:
- `is_online` (BooleanField): Boolean flag indicating if user is currently online
- `last_seen` (DateTimeField): Automatically updated on every user action
- `last_activity` (DateTimeField): Tracks the most recent user activity timestamp

#### 2. **UserStatusSerializer** (`backend/users/serializers.py`)
Lightweight serializer for exposing user online status:
```python
{
  "id": "user-uuid",
  "username": "john_doe",
  "profile_image_url": "https://...",
  "is_online": true,
  "last_seen": "2024-01-15T10:30:00Z",
  "last_activity": "2024-01-15T10:35:00Z"
}
```

#### 3. **OnlineUsersView** (`backend/users/views.py`)
REST API endpoint: `GET /api/users/online/`

Returns a list of all currently online users (excluding the requesting user).

```bash
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/api/users/online/
```

#### 4. **UserStatusConsumer** (`backend/main/consumers.py`)
WebSocket consumer for real-time status tracking:

- **Route**: `ws://localhost:8000/ws/user-status/?token=ACCESS_TOKEN`
- **Features**:
  - Automatically marks user as online on connection
  - Broadcasts status changes to all connected clients
  - Marks user as offline on disconnection
  - Handles ping/pong for activity tracking
  - Updates `last_activity` on ping messages

**WebSocket Events**:

Incoming messages from client:
```json
{
  "type": "ping"
}
```

Outgoing messages to client:
```json
{
  "type": "user.status.changed",
  "user_id": "user-uuid",
  "is_online": true
}
```

Connection acknowledgment:
```json
{
  "type": "connection.ack",
  "user_id": "user-uuid"
}
```

### Frontend Components

#### 1. **OnlineUsers Component** (`frontend/components/OnlineUsers.tsx`)

Reusable React component for displaying online users with premium styling.

**Features**:
- Red/blue gradient background (American flag colors)
- Golden text for usernames and titles
- Story-style card layout with user avatars
- Green online indicator dots
- Hover effects and animations
- Responsive grid (2-5 columns depending on screen size)
- Click handler support
- Tooltip on hover
- "View all online users" link
- Auto-refreshes every 30 seconds
- Loading and error states

**Props**:
```typescript
interface OnlineUsersProps {
  maxUsers?: number;          // Default: 8
  className?: string;         // Custom CSS classes
  title?: string;            // Default: "Online Users"
  onUserClick?: (user) => void; // Click handler
}
```

**Usage**:
```tsx
import OnlineUsers from '@/components/OnlineUsers';

export default function Page() {
  return (
    <OnlineUsers
      maxUsers={8}
      title="Who's Online?"
      onUserClick={(user) => {
        // Handle user click (navigate to profile, start chat, etc.)
        console.log(`Clicked on ${user.username}`);
      }}
    />
  );
}
```

#### 2. **useUserStatus Hook** (`frontend/hooks/useUserStatus.ts`)

Low-level hook for WebSocket connection management.

**Features**:
- Automatic connection when authenticated
- Automatic disconnection on logout
- Exponential backoff reconnection (max 5 attempts)
- Periodic ping/pong to maintain connection and track activity
- Error handling and logging
- Status change callbacks

**Usage**:
```tsx
import { useUserStatus } from '@/hooks/useUserStatus';

export default function MyComponent() {
  const { isConnected, sendPing } = useUserStatus((event) => {
    console.log(`User ${event.user_id} is ${event.is_online ? 'online' : 'offline'}`);
  });

  return (
    <div>
      {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
    </div>
  );
}
```

#### 3. **UserStatusProvider** (`frontend/lib/user-status-provider.tsx`)

Global provider component for automatic connection management.

**Usage**:
```tsx
// In your root layout or app component
import { AuthProvider } from '@/lib/auth-context';
import { UserStatusProvider } from '@/lib/user-status-provider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <UserStatusProvider>
        <YourApp />
      </UserStatusProvider>
    </AuthProvider>
  );
}
```

## Database Migration

Apply the migration to add online status fields:

```bash
python manage.py migrate users
```

This creates:
- `users_user.is_online` (BooleanField, default=False)
- `users_user.last_seen` (DateTimeField, auto_now=True)
- `users_user.last_activity` (DateTimeField, auto_now=True)

## Real-Time Data Flow

### User Connection Flow
```
User Opens App
    ↓
[Client] AuthProvider loads token
    ↓
[Client] UserStatusProvider initializes
    ↓
[Client] useUserStatus hook connects to ws/user-status/
    ↓
[Server] UserStatusConsumer.connect()
    ↓
[DB] User.is_online = True, User.last_activity = now()
    ↓
[Server] Broadcast user.status.changed event to all clients
    ↓
[All Clients] Receive status change, update UI
```

### User Activity Flow
```
User Interacts with App (scroll, type, click)
    ↓
[Client] Periodic ping sent (every 30 seconds)
    ↓
[Server] UserStatusConsumer.receive_json()
    ↓
[DB] User.last_activity = now()
    ↓
[Client] Pong response received
```

### User Disconnection Flow
```
User Closes App / Network Lost
    ↓
[Client] WebSocket closes
    ↓
[Server] UserStatusConsumer.disconnect()
    ↓
[DB] User.is_online = False
    ↓
[Server] Broadcast user.status.changed event to all clients
    ↓
[All Clients] Receive status change, update UI
```

## Integration Examples

### Example 1: Display Online Users in Sidebar

```tsx
// components/Sidebar.tsx
import OnlineUsers from '@/components/OnlineUsers';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const router = useRouter();

  return (
    <div className="w-64 p-4">
      <OnlineUsers
        maxUsers={10}
        title="Online Friends"
        onUserClick={(user) => {
          router.push(`/app/profile/${user.id}`);
        }}
      />
    </div>
  );
}
```

### Example 2: Display Online Users in Messaging Section

```tsx
// app/messages/page.tsx
import OnlineUsers from '@/components/OnlineUsers';

export default function MessagesPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3">
        {/* Messages content */}
      </div>
      
      <div className="lg:col-span-1">
        <OnlineUsers
          maxUsers={8}
          title="Who's Online?"
          onUserClick={(user) => {
            // Open conversation with user
          }}
        />
      </div>
    </div>
  );
}
```

### Example 3: Custom Styling

```tsx
import OnlineUsers from '@/components/OnlineUsers';

export default function CustomOnlineUsers() {
  return (
    <OnlineUsers
      maxUsers={12}
      className="shadow-xl rounded-2xl"
      title="Active Users"
    />
  );
}
```

## API Reference

### Get Online Users
**Endpoint**: `GET /api/users/online/`
**Authentication**: Required (Bearer token)

**Response** (200 OK):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "alice",
    "profile_image_url": "https://example.com/alice.jpg",
    "is_online": true,
    "last_seen": "2024-01-15T10:35:00Z",
    "last_activity": "2024-01-15T10:35:30Z"
  },
  {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "username": "bob",
    "profile_image_url": null,
    "is_online": true,
    "last_seen": "2024-01-15T10:30:00Z",
    "last_activity": "2024-01-15T10:33:15Z"
  }
]
```

**Errors**:
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Server error

## WebSocket Connection

### Connection URL
```
ws://localhost:8000/ws/user-status/?token=ACCESS_TOKEN
wss://api.example.com/ws/user-status/?token=ACCESS_TOKEN (production)
```

### Token Parameter
Authentication token can be passed as:
- URL query parameter: `?token=ACCESS_TOKEN`
- Or through Channels authentication middleware

### Heartbeat/Keep-Alive
Send ping every 30 seconds to maintain connection and update activity:
```json
{"type": "ping"}
```

Server responds with pong:
```json
{"type": "pong"}
```

## Performance Considerations

### Database Queries
- `is_online` is indexed for fast filtering
- `last_activity` auto-updates to track recent activity
- `OnlineUsersView` uses `.filter(is_online=True)` for efficiency

### WebSocket Scalability
- Uses Channels + Redis for distributed connections
- Groups users by `user_status` global group for broadcasting
- Exponential backoff prevents reconnection storms

### Frontend Optimization
- Component re-renders only on actual status changes
- Auto-refresh every 30 seconds (configurable)
- Lightweight data structure in serializer
- Efficient image loading with Next.js Image component

## Troubleshooting

### Users Not Appearing as Online

1. **Check Database Migration**:
   ```bash
   python manage.py showmigrations users
   ```
   Ensure `0009_user_is_online_user_last_activity_user_last_seen` is applied.

2. **Verify WebSocket Connection**:
   Open browser DevTools → Network → WS/WebSocket tab
   Look for `ws://localhost:8000/ws/user-status/`

3. **Check Channels Configuration** in `settings.py`:
   ```python
   ASGI_APPLICATION = "liberty_social.asgi.application"
   CHANNEL_LAYERS = {
       "default": {
           "BACKEND": "channels_redis.core.RedisChannelLayer",
           "CONFIG": {"hosts": [("127.0.0.1", 6379)]},
       }
   }
   ```

4. **Check Redis Connection**:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

### Reconnection Not Working

1. **Check Browser Console** for error messages
2. **Verify Token Validity**:
   ```bash
   # Token should be valid and not expired
   # Default expiration: 24 hours
   ```
3. **Check Max Reconnection Attempts**:
   Hook tries 5 times with exponential backoff. After that, manual reconnection is needed.

### High Memory Usage

1. **Monitor Active WebSocket Connections**:
   ```bash
   redis-cli
   > KEYS "asgi:*" | wc -l
   ```

2. **Consider Connection Timeouts**:
   Users with idle connections > 10 minutes are marked offline by server.

## Future Enhancements

1. **Presence Modes**: Away, Do Not Disturb, Invisible
2. **Activity Indicators**: Show what users are doing (typing, viewing profile, etc.)
3. **Geographic Information**: Display user location/timezone
4. **Session Management**: Track multiple devices per user
5. **Activity History**: Timeline of user joins/leaves
6. **Notifications**: Notify users when specific people come online
7. **Custom Status**: Allow users to set custom status messages

## Related Files

- Backend model migration: `/backend/users/migrations/0009_user_is_online_user_last_activity_user_last_seen.py`
- WebSocket routing: `/backend/liberty_social/routing.py`
- Consumer implementation: `/backend/main/consumers.py`
- API endpoint: `/backend/users/urls.py` + `/backend/users/views.py`
- Frontend component: `/frontend/components/OnlineUsers.tsx`
- Frontend hook: `/frontend/hooks/useUserStatus.ts`
- Frontend provider: `/frontend/lib/user-status-provider.tsx`
