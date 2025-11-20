# AWS ECS Deployment Readiness Assessment

**Date:** November 20, 2025  
**Status:** ✅ READY FOR ECS DEPLOYMENT (with minor configurations)

---

## ✅ Strengths & What's Already in Place

### 1. **Docker Setup** ✅
- **Multi-stage build** - Optimized for production
- **Non-root user** - Appuser (UID 1000) for security
- **Health checks** - Built-in Docker health check via `/api/health/`
- **Daphne ASGI** - Modern async Python server
- **Static files collection** - Automated in Dockerfile

### 2. **Application Server** ✅
- **Daphne 4.2.1** - Async ASGI server (better than Gunicorn for Django Channels)
- **Production-ready configuration** - Proper timeout settings
- **Graceful shutdown** - Using `exec` in entrypoint for signal handling

### 3. **Database Setup** ✅
- **PostgreSQL 15** - Production-grade database
- **Psycopg2-binary** - Correct driver installed
- **Connection pooling** - Can be added if needed
- **Entrypoint waits for DB** - Migration on startup

### 4. **Redis/Caching** ✅
- **Redis 7.0.1** - Latest stable
- **Channels Redis** - For WebSocket support
- **Celery configured** - For async tasks
- **URL parsing with SSL support** - Ready for Valkey (which is Redis-compatible)

### 5. **AWS Integration** ✅
- **Boto3 + Botocore** - AWS SDK installed
- **ECS task definition exists** - AWS Secrets Manager integration
- **IAM role support** - Execution and task roles defined
- **CloudWatch logs** - Configured in task definition
- **S3 bucket integration** - For file uploads

### 6. **Security** ✅
- **Non-root Docker user** - Running as appuser
- **Secrets via AWS Secrets Manager** - Not hardcoded in task definition
- **Environment variables** - Externalized configuration
- **CORS headers** - django-cors-headers installed

---

## ⚠️ Items Needing Configuration for Production

### 1. **Environment Variables to Set in AWS Secrets Manager**

Before deploying, create these secrets in **AWS Secrets Manager**:

```bash
# Required secrets
liberty-social/SECRET_KEY           # New Django secret key (don't use default)
liberty-social/DB_HOST              # Your RDS endpoint
liberty-social/DB_PASSWORD          # RDS password
liberty-social/REDIS_URL            # Your Valkey endpoint (format: valkey://host:6379/0)
liberty-social/CELERY_BROKER_URL    # valkey://host:6379/1
liberty-social/CELERY_RESULT_BACKEND # valkey://host:6379/2
liberty-social/AWS_ACCESS_KEY_ID    # IAM credentials for S3
liberty-social/AWS_SECRET_ACCESS_KEY # IAM credentials for S3
liberty-social/DEFAULT_FROM_EMAIL   # SES sender email
```

### 2. **Update ECS Task Definition**

Edit `ecs-task-definition.json` before deploying:

```json
{
  "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest",
  "environment": [
    {
      "name": "ALLOWED_HOSTS",
      "value": "your-domain.com,www.your-domain.com,*.elb.amazonaws.com"
    },
    {
      "name": "CORS_ALLOWED_ORIGINS",
      "value": "https://your-domain.com,https://www.your-domain.com"
    },
    {
      "name": "FRONTEND_URL",
      "value": "https://your-domain.com"
    }
  ]
}
```

### 3. **Database Prerequisites**

- **RDS PostgreSQL 15** or higher
- **Multi-AZ enabled** (for production HA)
- **Backup retention 30+ days**
- **VPC Security Group** allowing inbound from ECS tasks

### 4. **Valkey/ElastiCache Setup**

You already have **Elasticache Valkey cluster**. Ensure:

```
Connection format: valkey://cluster-node-url:6379
TLS enabled: rediss:// (if using encryption in transit)
```

Update these in task definition secrets:
```
REDIS_URL=rediss://your-elasticache-endpoint:6379/0?ssl_cert_reqs=none
CELERY_BROKER_URL=rediss://your-elasticache-endpoint:6379/1?ssl_cert_reqs=none
CELERY_RESULT_BACKEND=rediss://your-elasticache-endpoint:6379/2?ssl_cert_reqs=none
```

### 5. **S3 Bucket Setup**

Ensure bucket exists with:
- **Public access blocked** (recommended)
- **IAM policy** allowing ECS task to read/write
- **CORS configured** for frontend access
- **CloudFront distribution** (optional, recommended for performance)

### 6. **SES Configuration**

For production email:
- **Verify domain** in AWS SES (or add sender email to verified list)
- **Request production access** (if still in sandbox)
- **Update EMAIL_BACKEND** in task definition to `django_ses.SESBackend`

---

## 🚀 Deployment Steps

### Step 1: Build and Push Docker Image

```bash
cd backend

# Build image
docker build -t liberty-social-backend:latest .

# Tag for ECR
docker tag liberty-social-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Push to ECR
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest
```

### Step 2: Create AWS Secrets in Secrets Manager

```bash
aws secretsmanager create-secret \
  --name liberty-social/SECRET_KEY \
  --secret-string "your-new-random-secret-key-here" \
  --region us-east-1

# Repeat for all other secrets...
```

### Step 3: Register Task Definition

```bash
# Update ecs-task-definition.json with your values first

aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json \
  --region us-east-1
```

### Step 4: Create/Update ECS Service

```bash
aws ecs create-service \
  --cluster liberty-social-prod \
  --service-name liberty-social-backend \
  --task-definition liberty-social-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/liberty-social-backend/xxx,containerName=liberty-social-backend,containerPort=8000 \
  --region us-east-1
```

---

## 📋 Pre-Deployment Checklist

- [ ] **AWS Account**: Have AWS account with appropriate IAM permissions
- [ ] **RDS Database**: PostgreSQL 15+ running in VPC
- [ ] **Elasticache**: Valkey cluster set up and accessible
- [ ] **S3 Bucket**: Created and IAM policy configured
- [ ] **SES**: Domain verified for email sending
- [ ] **ECR Repository**: Created for Docker images
- [ ] **VPC/Security Groups**: Configured for ECS tasks to communicate with RDS/ElastiCache/S3
- [ ] **CloudWatch**: Log group created `/ecs/liberty-social-backend`
- [ ] **Application Load Balancer**: Created with target group for port 8000
- [ ] **Docker Image**: Built and tested locally
- [ ] **Environment Variables**: All secrets created in Secrets Manager
- [ ] **Task Definition**: Updated with correct account ID, domain, secrets ARNs

---

## 🔧 Optional Enhancements

### 1. **Celery Worker Deployment**

Create separate task definition for Celery workers:

```json
{
  "family": "liberty-social-celery-worker",
  "containerDefinitions": [
    {
      "name": "celery-worker",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest",
      "command": ["celery", "-A", "liberty_social", "worker", "-l", "info"],
      // ... same secrets and environment
    }
  ]
}
```

### 2. **Auto-scaling**

```bash
# Create auto-scaling target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/liberty-social-prod/liberty-social-backend \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10 \
  --region us-east-1

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --policy-name cpu-scaling \
  --service-namespace ecs \
  --resource-id service/liberty-social-prod/liberty-social-backend \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

### 3. **Cost Optimization**

- Use **Fargate Spot** for non-critical tasks (up to 70% savings)
- **Reserved Capacity** for baseline load
- **CloudFront** for static content caching

---

## 🐛 Common Issues & Solutions

### Issue 1: "Database connection refused"
**Cause:** RDS security group doesn't allow ECS task traffic
**Fix:** Add ECS security group to RDS inbound rules on port 5432

### Issue 2: "Connection to Valkey timeout"
**Cause:** Elasticache security group doesn't allow ECS traffic
**Fix:** Add ECS security group to Elasticache inbound on port 6379

### Issue 3: "S3 access denied"
**Cause:** Task role IAM policy missing S3 permissions
**Fix:** Add S3 bucket permissions to task role policy

### Issue 4: "Email sending failed"
**Cause:** SES still in sandbox or sender not verified
**Fix:** Request production access or verify sender email in SES

### Issue 5: "Static files 404"
**Cause:** STATIC_URL configuration issue
**Fix:** Ensure S3 is configured for static files or use CloudFront

---

## 📊 Performance Recommendations

### Daphne Configuration
- **Current:** `--http-timeout 120`
- **For API:** Increase to 300-600 for long-running requests
- **For WebSockets:** Keep default, add `--ws-per-message-deflate 0` if compression issues

### Database Tuning
- **Connection pool size:** 10-20 for small loads, 30-50 for high load
- **RDS instance:** Start with `db.t3.small`, scale to `db.t3.large` as needed

### Redis/Valkey Tuning
- **Memory policy:** `allkeys-lru` for cache invalidation
- **Replication:** Enable for production HA

### Task Sizing
- **Current:** 256 CPU, 512 MB memory
- **Recommended:** 512 CPU (0.5 vCPU), 1024 MB (1 GB) for production
- **High load:** 1024 CPU (1 vCPU), 2048 MB (2 GB)

---

## ✅ Final Validation

Before going live:

1. **Test locally:**
   ```bash
   docker-compose up -d
   curl http://localhost:8000/api/health/
   ```

2. **Test in ECS (one task):**
   - Verify migrations run
   - Verify static files accessible
   - Verify Celery tasks complete

3. **Test with load balancer:**
   - Configure DNS
   - Test HTTPS (ACM certificate)
   - Verify all endpoints respond

4. **Monitor in CloudWatch:**
   - Set up alarms for errors
   - Set up alarms for high CPU/memory
   - Set up alarms for task failures

---

## 📞 Support & Troubleshooting

**View logs:**
```bash
aws logs tail /ecs/liberty-social-backend --follow
```

**SSH into task (ECS Exec):**
```bash
aws ecs execute-command \
  --cluster liberty-social-prod \
  --task <task-id> \
  --container liberty-social-backend \
  --interactive \
  --command "/bin/bash"
```

**Restart service:**
```bash
aws ecs update-service \
  --cluster liberty-social-prod \
  --service liberty-social-backend \
  --force-new-deployment
```

---

**Deployment Status:** 🟢 Ready for Production
**Next Step:** Configure AWS resources and deploy!
