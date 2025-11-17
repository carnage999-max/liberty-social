# Friend Changes Feature - Troubleshooting Guide

## Issue: 404 Error on Friend Changes Page

### Symptoms
```
GET https://your-domain.com/api/friendship-history/new_friends/ 404 (Not Found)
GET https://your-domain.com/api/friendship-history/former_friends/ 404 (Not Found)
```

### Solution
The frontend needs to use the correct API prefix: `/api/auth/` not `/api/`

✅ **Fixed** - Updated to:
```
GET /api/auth/friendship-history/new_friends/
GET /api/auth/friendship-history/former_friends/
```

---

## Issue: No Friend Changes Showing

### Symptoms
- Page loads successfully but shows "No friend changes in the last 30 days"
- No data appears even though you have friends

### Root Cause
Friend changes are only tracked for:
1. **New friendships** - When a friend request is accepted AFTER the code update
2. **Removals** - When unfriending AFTER the code update

Historical data is not retroactively tracked.

### Solution
Create new friend connections to generate tracking data:
1. Have User A send a friend request to User B
2. User B accepts the request
3. FriendshipHistory records are created automatically
4. Changes appear on Friend Changes page within 30 days

To test with existing friends, use Django shell:
```bash
python3 manage.py shell
```

```python
from django.contrib.auth import get_user_model
from users.models import FriendshipHistory
from datetime import timedelta
from django.utils import timezone

User = get_user_model()

# Get two users (replace with real usernames)
user1 = User.objects.get(username="username1")
user2 = User.objects.get(username="username2")

# Create test history records
FriendshipHistory.objects.create(
    user=user1,
    friend=user2,
    action="added"
)

FriendshipHistory.objects.create(
    user=user1,
    friend=User.objects.exclude(id=user2.id).first(),
    action="removed",
    removal_reason="unfriended_by_user"
)
```

---

## Issue: API Returns Empty Array

### Symptoms
```javascript
// In browser console
GET /api/auth/friendship-history/new_friends/ 200 OK
Response: []
```

### Root Cause
No FriendshipHistory records exist for the current user in the last 30 days.

### Solution
See "No Friend Changes Showing" section above.

---

## Issue: TypeScript Errors in IDE

### Symptoms
```
Type 'FriendshipChange' not found
Property 'removal_reason_display' does not exist
```

### Solution
Ensure types are imported in the file:
```typescript
import type { FriendshipHistory } from "@/lib/types";
```

The types are defined in `/frontend/lib/types.ts`:
```typescript
export interface FriendshipHistory {
  id: number;
  user: string;
  friend: User;
  action: FriendshipAction;
  action_display: string;
  removal_reason?: RemovalReason | null;
  removal_reason_display?: string | null;
  created_at: string;
}
```

---

## Issue: Removal Reason Shows as "null"

### Symptoms
- Former friend shows but removal reason badge is blank
- "removal_reason_display" is null

### Root Cause
The FriendshipHistory record was created without a removal_reason value.

### Check
```python
from users.models import FriendshipHistory
records = FriendshipHistory.objects.filter(action="removed", removal_reason__isnull=True)
print(f"Records without reason: {records.count()}")
```

### Solution
Delete those records and create new ones through the app:
```python
FriendshipHistory.objects.filter(action="removed", removal_reason__isnull=True).delete()
```

Then unfriend normally through the UI to create proper records.

---

## Issue: Friend Changes Button Not Showing on Profile

### Symptoms
- Visiting own profile (`/app/users/[own-id]`)
- "Friend Changes" button doesn't appear

### Root Cause
The button only shows on your own profile (isSelf check).

### Verify
```typescript
// Check in browser console
const profileId = "your-user-id";
const currentUserId = "your-user-id";
const isSelf = profileId === currentUserId; // Should be true
```

### Solution
The button should appear if:
1. You're viewing your own profile
2. You're authenticated
3. The changes were deployed

Refresh the page and clear browser cache if needed.

---

## Issue: Changes Not Updating in Real-time

### Symptoms
- Accept a friend request
- Go to Friend Changes page
- New friend doesn't appear immediately

### Root Cause
Page doesn't auto-refresh. Data is fetched once on page load.

### Solution
Refresh the page (F5 or Cmd+R) to reload the data.

To add auto-refresh, modify the useEffect:
```typescript
useEffect(() => {
  const interval = setInterval(fetchFriendChanges, 5000); // Refresh every 5 seconds
  return () => clearInterval(interval);
}, [accessToken]);
```

---

## Issue: Backend Migration Failed

### Symptoms
```
django.db.utils.OperationalError: column "removal_reason" does not exist
```

### Solution
Apply pending migrations:
```bash
cd backend
python3 manage.py migrate users
```

Verify:
```bash
python3 manage.py showmigrations users | grep friendship
# Should show: [X] 0008_friendshiphistory
```

---

## Issue: Import Errors on Backend

### Symptoms
```
ImportError: cannot import name 'FriendshipHistory' from 'users.models'
```

### Solution
Verify the model exists in `/backend/users/models.py`:
```python
class FriendshipHistory(models.Model):
    # ... model definition ...
```

And verify it's imported in `/backend/users/views.py`:
```python
from .models import FriendshipHistory
```

---

## Verification Checklist

Use this to verify everything is working:

- [ ] Backend migration applied: `python3 manage.py showmigrations users | grep friendship`
- [ ] Model exists: `python3 manage.py shell` → `from users.models import FriendshipHistory` ✓
- [ ] ViewSet created: Check `/backend/users/views.py` for `FriendshipHistoryViewSet`
- [ ] URLs registered: Check `/backend/users/urls.py` includes `FriendshipHistoryViewSet`
- [ ] Frontend page exists: `/frontend/app/app/friends/changes/page.tsx`
- [ ] Navigation links added: `/frontend/app/app/friends/page.tsx` and user profile
- [ ] TypeScript types defined: `/frontend/lib/types.ts` has `FriendshipHistory` interface
- [ ] API URLs correct: Uses `/api/auth/friendship-history/` prefix
- [ ] Test data created (optional): Use Django shell to create sample records

---

## Quick Test

1. **Create test data:**
```bash
cd backend
python3 manage.py shell
```

```python
from django.contrib.auth import get_user_model
from users.models import FriendshipHistory

User = get_user_model()
user = User.objects.first()
other = User.objects.exclude(id=user.id).first()

# Create a test record
FriendshipHistory.objects.create(
    user=user,
    friend=other,
    action="added"
)
print(f"Created record for {user.username}")
```

2. **Visit the page:**
- Go to `/app/friends/changes`
- Should see the test friend in "New Friends" section

3. **Test removal reason:**
```python
FriendshipHistory.objects.create(
    user=user,
    friend=User.objects.exclude(id=other.id).first(),
    action="removed",
    removal_reason="unfriended_by_user"
)
```

- Reload page
- Should see the friend in "Former Friends" with removal reason badge

---

## Getting Help

If issues persist:

1. Check backend logs: `python3 manage.py runserver`
2. Check frontend console: Browser DevTools → Console tab
3. Check network requests: Browser DevTools → Network tab
4. Verify authentication: Make sure you're logged in
5. Check migrations: `python3 manage.py showmigrations`

---

**Last Updated:** November 17, 2025
