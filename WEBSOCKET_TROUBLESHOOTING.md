# WebSocket Notification Troubleshooting Guide

## Problem Summary

WebSocket connections to `/ws/notifications/` are failing in production (AWS App Runner). The browser shows connection failures, and the service falls back to polling. This document outlines the investigation steps and fixes.

## Root Causes

1. **AWS App Runner WebSocket Support**: App Runner may not have WebSocket support enabled
2. **Redis Connectivity**: The ASGI service (Daphne) may not be able to reach Redis
3. **Origin Validation**: `AllowedHostsOriginValidator` may be blocking connections
4. **Authentication**: JWT token validation may be failing silently

## Investigation Steps

### 1. Verify App Runner WebSocket Support

**Check Current Configuration:**
- Navigate to AWS Console → App Runner → Your Service → Configuration
- Look for "WebSocket support" or "Protocol support" settings
- **Note**: App Runner WebSocket support may require:
  - A specific service tier (check pricing/features)
  - Explicit enablement in service configuration
  - Custom VPC connector configuration

**Action Items:**
1. Check if your App Runner service tier supports WebSockets
2. Enable WebSocket support if available in the service configuration
3. If WebSockets aren't supported, consider:
   - Upgrading to a tier that supports WebSockets
   - Using AWS API Gateway with WebSocket API
   - Migrating to ECS/Fargate or EC2 with ALB

### 2. Test Redis Connectivity from API Service

**From App Runner Service (via CloudWatch Logs or SSH if available):**

```bash
# Test Redis connection
redis-cli -u "$REDIS_URL" PING
# Should return: PONG

# Test from Python (add to a management command or test endpoint)
python manage.py shell
>>> from channels.layers import get_channel_layer
>>> layer = get_channel_layer()
>>> import asyncio
>>> asyncio.run(layer.test())
```

**Common Issues:**
- **Upstash Redis**: 
  - Use TLS endpoint URL format: `rediss://default:<password>@<endpoint>.upstash.io:6379/0`
  - Upstash is publicly accessible, so no VPC configuration needed
  - Ensure the password is correctly encoded in the URL (URL-encode special characters)
  - Check Upstash dashboard for connection limits and rate limits
- **ElastiCache Redis**:
  - Redis URL format: Should be `redis://host:port/db` or `rediss://host:port/db` (SSL)
  - Security groups: App Runner service needs outbound access to Redis port (6379 or 6380 for SSL)
  - VPC configuration: If Redis is in a VPC, App Runner needs a VPC connector
  - Network ACLs: Check that Redis allows connections from App Runner's IP range
- **General Redis Issues**:
  - Verify Redis URL is correctly formatted
  - Check Redis instance is running and accessible
  - Verify credentials are correct
  - Check connection limits (Upstash free tier has connection limits)

**Action Items:**
1. Verify `REDIS_URL` environment variable is set correctly in App Runner
   - For Upstash: Format should be `rediss://default:<password>@<endpoint>.upstash.io:6379/0`
   - Ensure password is URL-encoded if it contains special characters
2. Test Redis connectivity from the API service container
   - Use the `/api/redis-health/` diagnostic endpoint
   - Check CloudWatch logs for Redis connection errors
3. **For ElastiCache only**: Check security groups and VPC configuration
4. **For Upstash**: 
   - Verify endpoint is accessible (check Upstash dashboard)
   - Check connection limits (free tier: 30 concurrent connections)
   - Verify rate limits aren't exceeded (free tier: 10,000 commands/day)
5. Verify Redis is accessible from App Runner's network
   - Upstash: Should be accessible from anywhere (public TLS endpoint)
   - ElastiCache: Requires VPC connector configuration

### 3. Check WebSocket Handshake Status

**In Browser DevTools:**
1. Open DevTools → Network → WS (WebSocket) tab
2. Attempt to connect to WebSocket
3. Check the status code:
   - **101 Switching Protocols**: Success (but may still fail after upgrade)
   - **403 Forbidden**: Origin/auth issue
   - **502 Bad Gateway**: Proxy/load balancer issue
   - **504 Gateway Timeout**: Timeout during upgrade
   - **No status line**: Connection closed immediately (likely App Runner blocking)

**Action Items:**
1. Capture the exact HTTP status code from DevTools
2. Check App Runner logs for corresponding connection attempts
3. Look for errors in Daphne/ASGI logs

### 4. Verify Origin Validation

**Current Configuration:**
```python
# backend/liberty_social/asgi.py
AllowedHostsOriginValidator(
    URLRouter(liberty_social.routing.websocket_urlpatterns)
)
```

**Check `ALLOWED_HOSTS` in settings:**
```python
# backend/liberty_social/settings.py
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*', cast=Csv())
```

**Action Items:**
1. Ensure `ALLOWED_HOSTS` includes your App Runner domain
2. Temporarily disable `AllowedHostsOriginValidator` for testing (NOT for production)
3. Check CORS settings if WebSocket origin differs from API origin

### 5. Test JWT Authentication

**Test WebSocket Authentication:**
```python
# Create a test management command
python manage.py shell
>>> from rest_framework_simplejwt.tokens import AccessToken
>>> from django.contrib.auth import get_user_model
>>> User = get_user_model()
>>> user = User.objects.first()
>>> token = AccessToken.for_user(user)
>>> print(str(token))
```

**Test WebSocket Connection with Token:**
```javascript
// In browser console
const token = 'YOUR_ACCESS_TOKEN';
const ws = new WebSocket(`wss://your-app-runner-domain/ws/notifications/?token=${token}`);
ws.onopen = () => console.log('Connected!');
ws.onerror = (e) => console.error('Error:', e);
ws.onclose = (e) => console.log('Closed:', e.code, e.reason);
```

**Action Items:**
1. Verify JWT token is valid and not expired
2. Test WebSocket connection with token in query string
3. Test with token in Authorization header (if frontend supports it)
4. Check App Runner logs for authentication errors

## Diagnostic Script

Create a diagnostic endpoint to test WebSocket infrastructure:

```python
# backend/main/views.py
from django.http import JsonResponse
from channels.layers import get_channel_layer
import asyncio

class WebSocketDiagnosticView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        diagnostics = {
            'redis_configured': False,
            'redis_connected': False,
            'channel_layer_available': False,
        }
        
        try:
            layer = get_channel_layer()
            if layer:
                diagnostics['channel_layer_available'] = True
                # Test Redis connection
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    result = loop.run_until_complete(layer.test())
                    diagnostics['redis_connected'] = True
                except Exception as e:
                    diagnostics['redis_error'] = str(e)
                finally:
                    loop.close()
        except Exception as e:
            diagnostics['error'] = str(e)
        
        return JsonResponse(diagnostics)
```

Add to URLs:
```python
# backend/main/urls.py
path("ws-diagnostic/", WebSocketDiagnosticView.as_view(), name="ws-diagnostic"),
```

## Fixes

### Fix 1: Enable App Runner WebSocket Support

**Option A: Enable in Service Configuration**
1. AWS Console → App Runner → Your Service → Configuration → Edit
2. Look for "WebSocket support" or "Protocol support"
3. Enable WebSocket support
4. Save and redeploy

**Option B: Use API Gateway (Alternative)**
If App Runner doesn't support WebSockets:
1. Create an API Gateway WebSocket API
2. Point it to your App Runner service (HTTP backend)
3. Update frontend `NEXT_PUBLIC_WS_BASE_URL` to API Gateway endpoint

**Option C: Migrate to ECS/Fargate**
1. Deploy to ECS with Application Load Balancer (supports WebSockets)
2. Update DNS to point to ALB
3. Update frontend configuration

### Fix 2: Ensure Redis Connectivity

**Verify Environment Variables:**
```bash
# In App Runner service configuration

# For Upstash (recommended - no VPC needed):
REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379/0
# Note: URL-encode the password if it contains special characters

# For ElastiCache (requires VPC):
REDIS_URL=redis://your-redis-host:6379/0
# Or with SSL:
REDIS_URL=rediss://your-redis-host:6380/0
```

**Check Security Groups (ElastiCache only):**
1. Redis security group must allow inbound from App Runner
2. App Runner security group must allow outbound to Redis
3. If using VPC, ensure VPC connector is configured

**Upstash Considerations:**
1. No VPC configuration needed - Upstash is publicly accessible over TLS
2. Check Upstash dashboard for:
   - Connection limits (free tier: 30 connections)
   - Rate limits (free tier: 10,000 commands/day)
   - Endpoint status and region
3. Verify the Redis endpoint URL from Upstash dashboard matches your `REDIS_URL`
4. Ensure password is correctly URL-encoded if it contains special characters

**Test Connection:**
Add a health check endpoint that tests Redis:
```python
# backend/main/views.py
class RedisHealthView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        try:
            from channels.layers import get_channel_layer
            import asyncio
            
            layer = get_channel_layer()
            if not layer:
                return JsonResponse({'status': 'error', 'message': 'No channel layer'}, status=500)
            
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(layer.test())
                return JsonResponse({'status': 'ok', 'redis': 'connected'})
            except Exception as e:
                return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
            finally:
                loop.close()
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
```

### Fix 3: Improve Error Logging

**Add Better Logging to Consumer:**
```python
# backend/main/consumers.py
import logging

logger = logging.getLogger(__name__)

class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        logger.info(f"WebSocket connection attempt from {self.scope.get('client')}")
        user = self.scope.get("user")
        if not user or user.is_anonymous:
            logger.warning("WebSocket connection rejected: anonymous user")
            await self.close(code=4401)
            return

        try:
            self.user = user
            self.group_name = notification_group_name(user.id)
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.info(f"WebSocket connected for user {user.id}")
            await self.send_json({"type": "connection.ack"})
        except Exception as e:
            logger.exception(f"Error during WebSocket connect: {e}")
            await self.close(code=4500)
    
    async def disconnect(self, code):
        logger.info(f"WebSocket disconnected with code {code}")
        if hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception as e:
                logger.exception(f"Error during disconnect: {e}")
```

### Fix 4: Add Connection Timeout Handling

**Update Frontend to Handle Timeouts:**
```typescript
// frontend/hooks/useNotifications.ts
const connectSocket = useCallback(
  (token: string) => {
    const base = resolveWebSocketBase();
    const urlBase = base ? `${base}/ws/notifications/` : "/ws/notifications/";
    const socketUrl = `${urlBase}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(socketUrl);
    websocketRef.current = ws;

    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.warn("WebSocket connection timeout, closing...");
        ws.close();
      }
    }, 10000); // 10 second timeout

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      setSocketActive(true);
      // ... rest of onopen
    };

    ws.onerror = (error) => {
      clearTimeout(connectionTimeout);
      console.error("WebSocket error:", error);
      ws.close();
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      // ... rest of onclose
    };
  },
  [scheduleRefresh]
);
```

## Testing Checklist

- [ ] App Runner WebSocket support is enabled
- [ ] Redis is accessible from App Runner service
- [ ] `REDIS_URL` is correctly configured
- [ ] `ALLOWED_HOSTS` includes App Runner domain
- [ ] JWT tokens are valid and not expired
- [ ] WebSocket handshake returns 101 status code
- [ ] Connection stays open after handshake
- [ ] Ping/pong messages work
- [ ] Notifications are received via WebSocket
- [ ] Fallback polling works when WebSocket fails

## Next Steps

1. **Immediate**: Check App Runner service configuration for WebSocket support
2. **Immediate**: Test Redis connectivity from App Runner service
3. **Short-term**: Add diagnostic endpoints to verify infrastructure
4. **Short-term**: Improve error logging in WebSocket consumer
5. **Long-term**: Consider alternative deployment if App Runner doesn't support WebSockets

## References

- [AWS App Runner WebSocket Support](https://docs.aws.amazon.com/apprunner/)
- [Django Channels Documentation](https://channels.readthedocs.io/)
- [Channels Redis Backend](https://github.com/django/channels_redis)

