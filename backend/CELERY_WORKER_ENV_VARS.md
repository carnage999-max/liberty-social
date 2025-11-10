# Required Environment Variables for Celery Worker

The Celery worker service (running on AWS App Runner) **MUST** have all of these environment variables set to function properly:

## Critical - Required for Worker to Start

### Database Connection
- `DB_HOST` - Database host (e.g., `ep-proud-cherry-ahujvcz0-pooler.c-3.us-east-1.aws.neon.tech`)
- `DB_NAME` - Database name (e.g., `neondb`)
- `DB_USER` - Database user (e.g., `neondb_owner`)
- `DB_PASSWORD` - Database password

### Redis Connection (for Celery broker and result backend)
- `REDIS_URL` - Redis connection URL (e.g., `rediss://default:...@concise-alien-13322.upstash.io:6379?ssl_cert_reqs=CERT_NONE`)
- **OR** explicitly set:
  - `CELERY_BROKER_URL` - Celery broker URL (defaults to REDIS_URL if not set)
  - `CELERY_RESULT_BACKEND` - Celery result backend URL (defaults to CELERY_BROKER_URL if not set)

### Django Settings
- `SECRET_KEY` - Django secret key (must match the API service) - **CRITICAL: Must be the same as API service**
- `DEBUG` - Set to `False` for production
- `ALLOWED_HOSTS` - Set to `*` or your domain

## Required for Push Notifications

### Firebase Configuration
- `PUSH_NOTIFICATIONS_ENABLED` - Set to `True` to enable push notifications
- `FIREBASE_PROJECT_ID` - Firebase project ID (e.g., `ezekiel-okebule`)
- `FIREBASE_CREDENTIALS_JSON` - Firebase service account JSON (can be base64-encoded or raw JSON)

### Frontend URL (for web push notification links)
- `FRONTEND_URL` - Frontend URL (e.g., `https://www.mylibertysocial.com/`)

## Optional but Recommended

### Firebase Web Config (for frontend)
These are only needed if the frontend fetches config from `/api/firebase-config/`:
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_WEB_APP_ID`
- `FIREBASE_WEB_MESSAGING_SENDER_ID`
- `FIREBASE_WEB_PROJECT_ID`
- `FIREBASE_WEB_AUTH_DOMAIN`
- `FIREBASE_WEB_STORAGE_BUCKET`
- `FIREBASE_WEB_MEASUREMENT_ID`
- `FIREBASE_WEB_VAPID_KEY`

### Celery Worker Configuration (optional)
- `CELERY_WORKER_CONCURRENCY` - Number of worker processes (default: 2)
- `CELERY_MAX_TASKS_PER_CHILD` - Max tasks per worker process (default: 500)
- `CELERY_PREFETCH_MULTIPLIER` - Prefetch multiplier (default: 4)

## Important Notes

1. **The Celery worker MUST have the same database connection** as the API service to access notifications and device tokens.

2. **The Celery worker MUST have the same Redis connection** as the API service to receive tasks from the queue.

3. **The Celery worker MUST have Firebase credentials** to send push notifications.

4. **FRONTEND_URL is critical** - Without it, web push notification links will be relative paths which may not work correctly.

5. **SECRET_KEY must match** between API and Celery worker services (they share the same database).

## Verification Checklist

✅ Database connection works (worker can query Notification and DeviceToken models)
✅ Redis connection works (worker can receive tasks from queue)
✅ Firebase credentials are valid (worker can authenticate with Firebase)
✅ PUSH_NOTIFICATIONS_ENABLED=True
✅ FIREBASE_PROJECT_ID matches your Firebase project
✅ FIREBASE_CREDENTIALS_JSON is valid (base64 or JSON format)
✅ FRONTEND_URL is set to your frontend domain

## Testing

To verify the Celery worker is working:
1. Check Celery worker logs for startup messages
2. Create a test notification and check logs for "Sending push notification..." messages
3. Check for any error messages about missing credentials or connection failures

