# Upstash Redis Quick Reference

## Connection URL Format

```
rediss://default:<password>@<endpoint>.upstash.io:6379/0
```

**Note:** For Celery, the settings automatically add `ssl_cert_reqs=none` to the URL. You don't need to add this manually.

## Environment Variables

```bash
REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379/0
CELERY_BROKER_URL=rediss://default:<password>@<endpoint>.upstash.io:6379/0
CELERY_RESULT_BACKEND=rediss://default:<password>@<endpoint>.upstash.io:6379/0
```

## Free Tier Limits

- **Connections**: 30 concurrent connections
- **Commands**: 10,000 commands per day
- **Storage**: 256 MB

## Quick Test

```bash
# Test Redis connectivity
curl https://your-app-runner-domain/api/redis-health/

# Test WebSocket infrastructure (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-app-runner-domain/api/ws-diagnostic/
```

## Common Issues

### Connection Refused
- Check `REDIS_URL` format (must start with `rediss://`)
- Verify password is URL-encoded if it contains special characters
- Check Upstash dashboard for connection limits

### Rate Limit Exceeded
- Check daily command usage in Upstash dashboard
- Upgrade to paid plan if needed
- Optimize Redis usage

### TLS/SSL Errors
- Ensure URL uses `rediss://` (double 's') not `redis://`
- Verify endpoint URL from Upstash dashboard
- Check Python SSL certificates are up to date

## URL Encoding Special Characters

If your password contains special characters, URL-encode them:
- `@` → `%40`
- `:` → `%3A`
- `#` → `%23`
- `/` → `%2F`
- `?` → `%3F`
- `&` → `%26`
- `=` → `%3D`
- `%` → `%25`

## Upstash Dashboard

- Monitor connections: [https://console.upstash.com](https://console.upstash.com)
- Check usage and limits
- View connection strings
- Monitor performance metrics

## Migration Checklist

- [ ] Create Upstash Redis database
- [ ] Get connection URL from Upstash dashboard
- [ ] Update `REDIS_URL` in App Runner environment variables
- [ ] Remove VPC connector configuration (not needed for Upstash)
- [ ] Test Redis connectivity with `/api/redis-health/`
- [ ] Test WebSocket infrastructure with `/api/ws-diagnostic/`
- [ ] Verify WebSocket connections work
- [ ] Monitor Upstash dashboard for usage and limits

