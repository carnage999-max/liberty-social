# Docker Build Deep Dive - Debugging & Troubleshooting

**Understanding the Liberty Social Backend Docker build process**

---

## 📦 What the Dockerfile Does

### Stage 1: Builder Stage
```dockerfile
FROM python:3.11-slim as builder
```

- Creates a **temporary build container** with Python 3.11
- Installs **gcc** and **libpq-dev** (needed to compile Python packages)
- Creates **wheels** (pre-compiled Python packages) for all dependencies
- This stage gets **discarded** after building - keeps final image small

### Stage 2: Runtime Stage
```dockerfile
FROM python:3.11-slim
```

- Creates the **final production image**
- Only installs **runtime dependencies** (no build tools)
- Installs **wheels from builder stage** (fast, no compilation needed)
- Sets up **non-root user** for security
- Collects **Django static files**
- Configures **health checks**
- Runs **entrypoint script** on startup

---

## 🔧 Build Requirements

### System Requirements
- **Docker**: 20.10+
- **Disk Space**: 2-3 GB (for Python and dependencies)
- **Memory**: 2+ GB
- **Network**: Needed to download packages from PyPI

### Python Compatibility
- **Python 3.11-slim**: Lightweight official Python image
- **Dependencies**: All listed in `requirements.txt`
- **Total size**: ~450MB final image

---

## 🐛 Common Build Issues & Solutions

### Issue 1: "gcc: command not found"
**Problem:** Build stage can't compile certain packages
**Solution:** Dockerfile already includes `gcc` in builder stage - usually means corrupted cache
```bash
docker build --no-cache -t liberty-social-backend:latest .
```

### Issue 2: "libpq-dev: unable to locate package"
**Problem:** PostgreSQL development libraries not found
**Solution:** Dockerfile includes `libpq-dev` - clear cache:
```bash
docker system prune --all
docker build -t liberty-social-backend:latest .
```

### Issue 3: "setuptools/pip wheel errors"
**Problem:** Old pip version trying to build packages
**Solution:** Dockerfile upgrades pip/setuptools - already included:
```bash
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
```

### Issue 4: "final image is over 1GB"
**Problem:** Build stage not removed correctly
**Symptom:** `docker build` succeeds but image is huge
**Solution:** Check multi-stage syntax - already correct in our Dockerfile

---

## 🧪 Testing the Build Locally

### Full build test:
```bash
cd /home/binary/Desktop/liberty-social/backend

# Build with no cache (slowest, but catches everything)
docker build --no-cache -t liberty-social-backend:test .

# Check image size
docker images liberty-social-backend:test

# Run a test container
docker run --rm \
  -e DEBUG=True \
  -e SECRET_KEY=test-key \
  -e DB_HOST=host.docker.internal \
  -e DB_NAME=test_db \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e REDIS_URL=redis://host.docker.internal:6379/0 \
  -p 8000:8000 \
  liberty-social-backend:test

# In another terminal, test if it starts
sleep 10 && curl http://localhost:8000/api/health/
```

### Quick layer inspection:
```bash
docker inspect liberty-social-backend:latest --format='{{.Layers}}'

# Or see build history
docker history liberty-social-backend:latest
```

---

## 📊 Build Performance Optimization

### Current optimizations already in place:
1. ✅ **Multi-stage build** - Removes build tools from final image
2. ✅ **--no-cache-dir** - Reduces layer size
3. ✅ **Slim base image** - Only 115MB vs 900MB for full Python
4. ✅ **Wheels caching** - Pre-compiled packages install faster
5. ✅ **Minimal runtime dependencies** - Only `libpq5`, `curl`, `bash`

### If build is slow:
```bash
# Check network connection
ping -c 1 registry.hub.docker.com

# Build with progress output
docker build --progress=plain -t liberty-social-backend:latest .

# Increase Docker resources
# Docker Desktop: Preferences → Resources → Memory (set to 4GB+)
```

---

## 🔐 Security Considerations

### What's already implemented:
- ✅ **Non-root user**: Running as `appuser` (UID 1000)
- ✅ **Secrets from Secrets Manager**: Not hardcoded
- ✅ **Health checks**: Periodic verification of service health
- ✅ **Environment variable separation**: Config from code
- ✅ **.dockerignore**: Excludes sensitive files from image

### Additional security options (optional):
```dockerfile
# Add these to Dockerfile if needed:

# Read-only root filesystem (requires volume mounts)
RUN chmod -R a-w /app

# Remove shell for extra security (requires exec-form CMD)
# Don't use for this app - we need bash in entrypoint.sh

# Pin specific versions (already done in requirements.txt)
```

---

## 📈 Monitoring Build Issues

### Docker daemon logs:
```bash
# On Linux
sudo journalctl -u docker -f

# On Mac
log stream --predicate 'process == "Docker"'

# On Windows
Get-EventLog -LogName Application -Source "Docker" -Newest 20
```

### Build cache inspection:
```bash
# See what's cached
docker builder prune --all

# Show build cache usage
docker system df

# Clear everything
docker system prune --all --volumes
```

---

## 🔄 Rebuild Scenarios

### Scenario 1: Update Python packages only
```bash
# Fast rebuild - uses Docker cache for base layers
docker build -t liberty-social-backend:latest .
```

### Scenario 2: Change base image or system packages
```bash
# Must rebuild entire image
docker build --no-cache -t liberty-social-backend:latest .
```

### Scenario 3: Update application code only
```bash
# With docker-compose (better for local development)
docker-compose up -d --build backend

# Or standalone
docker build -t liberty-social-backend:latest .
docker-compose up -d
```

---

## 🚀 Production Build Best Practices

### Before pushing to ECR:

```bash
# 1. Test image locally
docker build -t liberty-social-backend:v1.0.0 .

# 2. Run with production-like env
docker run --env-file .env.production \
  -p 8000:8000 \
  liberty-social-backend:v1.0.0

# 3. Test critical endpoints
curl http://localhost:8000/api/health/

# 4. Check image security
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image liberty-social-backend:v1.0.0

# 5. Tag and push
docker tag liberty-social-backend:v1.0.0 \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:v1.0.0

docker push \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:v1.0.0
```

---

## 📝 Docker Build Checklist

- [ ] Docker daemon is running (`docker ps` works)
- [ ] Sufficient disk space (2-3 GB available)
- [ ] Sufficient memory (2+ GB)
- [ ] Network connectivity to PyPI
- [ ] `requirements.txt` is valid
- [ ] `Dockerfile` is in backend directory
- [ ] `.dockerignore` exists and is updated
- [ ] `docker-entrypoint.sh` is executable
- [ ] No sensitive data in Docker context (check `.dockerignore`)
- [ ] Build completes without errors
- [ ] Image size is reasonable (~450-500 MB)
- [ ] Can run container successfully
- [ ] Health check endpoint responds

---

## 🎯 Full Build & Deploy Flow

```bash
#!/bin/bash
# Complete build and deploy workflow

set -e

export AWS_ACCOUNT_ID="123456789012"
export AWS_REGION="us-east-1"
export VERSION="v$(date +%Y%m%d-%H%M%S)"

cd /home/binary/Desktop/liberty-social/backend

echo "🔨 Building Docker image..."
docker build -t liberty-social-backend:$VERSION .

echo "✅ Build successful!"
echo "📊 Image info:"
docker images liberty-social-backend:$VERSION

echo "🧪 Testing image locally..."
docker run --rm \
  -e DEBUG=False \
  -e SECRET_KEY=test \
  -e DB_HOST=localhost \
  --entrypoint python \
  liberty-social-backend:$VERSION \
  -c "import django; print('Django import successful')"

echo "✅ Local test successful!"

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo "🏷️  Tagging image..."
docker tag liberty-social-backend:$VERSION \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/liberty-social-backend:$VERSION

echo "📤 Pushing to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/liberty-social-backend:$VERSION

echo "✅ Deployment successful!"
echo "📍 Image location: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/liberty-social-backend:$VERSION"

echo "🚀 To deploy to ECS:"
echo "   aws ecs update-service \\"
echo "     --cluster liberty-social-backend \\"
echo "     --service liberty-social-backend-service \\"
echo "     --force-new-deployment \\"
echo "     --region $AWS_REGION"
```

---

## 📞 Getting Help

**For Docker issues:**
- [Docker Official Documentation](https://docs.docker.com/)
- [Docker Troubleshooting](https://docs.docker.com/config/daemon/)
- Run with verbose logging: `docker build --progress=plain -t tag .`

**For Python/Django issues:**
- [Python Official Docs](https://docs.python.org/3/)
- [Django Documentation](https://docs.djangoproject.com/)

**For deployment issues:**
- Check `DEPLOYMENT_CHECKLIST.md`
- Check `QUICK_DEPLOY.md`
- View ECS logs: `aws logs tail /ecs/liberty-social-backend --follow`
