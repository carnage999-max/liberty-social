# Upstash Redis Setup Guide

## Overview

This guide explains how to configure Upstash Redis for Django Channels and Celery in the Liberty Social application.

## Why Upstash?

- **No VPC Configuration**: Upstash is publicly accessible over TLS, eliminating the need for VPC connectors in AWS App Runner
- **Free Tier**: Upstash offers a generous free tier perfect for development and small-scale production
- **Managed Service**: Fully managed Redis with automatic backups and high availability
- **Global Edge Network**: Low latency connections from anywhere

## Setup Steps

### 1. Create Upstash Redis Database

1. Sign up at [https://upstash.com](https://upstash.com)
2. Create a new Redis database
3. Choose a region close to your App Runner service (e.g., `us-east-1`)
4. Select the free tier plan
5. Note the following from the Upstash dashboard:
   - **Endpoint**: e.g., `default-xxx.upstash.io`
   - **Port**: Usually `6379` for TLS or `6380` for non-TLS
   - **Password**: Your Redis password

### 2. Get Redis Connection URL

In the Upstash dashboard, you'll see a connection string. It should look like:
```
rediss://default:<password>@<endpoint>.upstash.io:6379
```

**Important Notes:**
- Use `rediss://` (with double 's') for TLS/SSL connections
- Upstash requires TLS by default
- If your password contains special characters, URL-encode them:
  - `@` becomes `%40`
  - `:` becomes `%3A`
  - `#` becomes `%23`
  - etc.

### 3. Configure Environment Variables

In your App Runner service configuration (or Secrets Manager), set:

```bash
REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379/0
# Optionally set these explicitly (they default to REDIS_URL):
# CELERY_BROKER_URL=rediss://default:<password>@<endpoint>.upstash.io:6379/0
# CELERY_RESULT_BACKEND=rediss://default:<password>@<endpoint>.upstash.io:6379/0
```

**Example:**
```bash
REDIS_URL=rediss://default:AbC123XyZ@default-abc123.upstash.io:6379/0
```

**Important:** The Django settings automatically add `ssl_cert_reqs=none` to the Redis URL when using `rediss://` for Celery. This is required by Celery's Redis backend. You don't need to add this parameter manually - it's handled automatically by the `get_redis_url_with_ssl()` function in `settings.py`.

### 4. Verify Configuration

The Django Channels configuration in `backend/liberty_social/settings.py` automatically handles TLS when the URL starts with `rediss://`:

```python
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [REDIS_URL],
        },
    }
}
```

### 5. Test Connection

Use the diagnostic endpoints to verify Redis connectivity:

```bash
# Test Redis health (public endpoint, no auth required)
curl https://your-app-runner-domain/api/redis-health/

# Expected response:
{
  "channel_layer_available": true,
  "redis_configured": true,
  "redis_connected": true,
  "redis_test_result": "ok"
}
```

### 6. Test WebSocket Infrastructure

Test the full WebSocket setup (requires authentication):

```bash
# Get your JWT token first, then:
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-app-runner-domain/api/ws-diagnostic/

# Expected response:
{
  "user_authenticated": true,
  "user_id": 1,
  "channel_layer_available": true,
  "redis_configured": true,
  "redis_connected": true,
  "redis_test_result": "ok",
  "notification_group_name": "notifications.user.1",
  "allowed_hosts": ["*"],
  "redis_url_configured": true
}
```

## Upstash Free Tier Limits

**Connection Limits:**
- Maximum 30 concurrent connections
- If you exceed this limit, new connections will be refused

**Rate Limits:**
- 10,000 commands per day
- If you exceed this, requests will be rate-limited

**Recommendations:**
- Monitor connection usage in the Upstash dashboard
- Consider upgrading to a paid plan for production if you need more connections
- Use connection pooling to minimize connection usage
- Implement rate limiting on your application side

## Troubleshooting

### Connection Refused Errors

**Symptoms:**
- `redis_connected: false` in diagnostic endpoint
- WebSocket connections fail
- Celery tasks fail to connect

**Solutions:**
1. Verify `REDIS_URL` is correctly formatted
2. Check that the password is URL-encoded if it contains special characters
3. Verify the endpoint URL from Upstash dashboard
4. Check Upstash dashboard for connection limits (free tier: 30 connections)
5. Verify the Redis database is running in Upstash dashboard

### Rate Limit Errors

**Symptoms:**
- Intermittent connection failures
- 429 errors in logs
- Commands failing after high usage

**Solutions:**
1. Check Upstash dashboard for daily command usage
2. Upgrade to a paid plan if you need more than 10,000 commands/day
3. Optimize your application to reduce Redis commands
4. Implement caching to reduce Redis load

### TLS/SSL Errors

**Symptoms:**
- SSL certificate verification errors
- Connection timeouts
- `rediss://` URL not working
- Celery worker failing with "ssl_cert_reqs parameter missing" error

**Solutions:**
1. Ensure you're using `rediss://` (with double 's') not `redis://`
2. Verify the endpoint URL is correct
3. Check that your Python environment has up-to-date SSL certificates
4. **For Celery errors**: The settings automatically add `ssl_cert_reqs=none` to Redis URLs when using `rediss://`. If you're still getting errors:
   - Verify the `get_redis_url_with_ssl()` function is working correctly
   - Check that `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` have the SSL parameter
   - Ensure `CELERY_BROKER_TRANSPORT_OPTIONS` is set correctly in settings
5. If using a custom CA, configure it in the CHANNEL_LAYERS config

### Connection Pool Exhausted

**Symptoms:**
- "Connection pool exhausted" errors
- WebSocket connections failing after initial success
- High connection count in Upstash dashboard

**Solutions:**
1. Check Upstash dashboard for active connections
2. Ensure connections are properly closed after use
3. Reduce the number of concurrent WebSocket connections
4. Upgrade to a paid plan for more connections
5. Implement connection pooling and reuse

## Migration from ElastiCache

If you're migrating from ElastiCache to Upstash:

1. **Update Environment Variables:**
   - Change `REDIS_URL` from ElastiCache endpoint to Upstash endpoint
   - Remove VPC connector configuration from App Runner (no longer needed)

2. **Update Security Groups:**
   - Remove security group rules for ElastiCache (no longer needed)
   - App Runner can connect to Upstash without security group configuration

3. **Test Connection:**
   - Use the diagnostic endpoints to verify connectivity
   - Test WebSocket connections
   - Test Celery task execution

4. **Monitor:**
   - Check Upstash dashboard for connection usage
   - Monitor rate limits
   - Check application logs for any Redis errors

## Best Practices

1. **Password Security:**
   - Store Redis password in AWS Secrets Manager, not in code
   - Use environment variables for configuration
   - Rotate passwords periodically

2. **Connection Management:**
   - Use connection pooling (Django Channels handles this automatically)
   - Close connections properly when done
   - Monitor connection usage in Upstash dashboard

3. **Error Handling:**
   - Implement retry logic for Redis operations
   - Handle rate limit errors gracefully
   - Log Redis errors for debugging

4. **Monitoring:**
   - Monitor Upstash dashboard for usage and errors
   - Set up alerts for connection limits
   - Track Redis command usage

5. **Scaling:**
   - Upgrade to paid plan when approaching free tier limits
   - Consider multiple Redis instances for high-traffic scenarios
   - Implement Redis clustering if needed

## References

- [Upstash Documentation](https://docs.upstash.com/)
- [Upstash Redis Guide](https://docs.upstash.com/redis)
- [Django Channels Documentation](https://channels.readthedocs.io/)
- [Channels Redis Backend](https://github.com/django/channels_redis)

