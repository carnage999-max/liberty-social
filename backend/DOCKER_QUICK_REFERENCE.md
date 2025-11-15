# Docker & ECS Quick Reference

## Local Development

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f backend

# Run Django command
docker-compose exec backend python manage.py createsuperuser

# Access services:
# - API: http://localhost:8000
# - Email UI: http://localhost:8025
# - Database: localhost:5432 (postgres/postgres)
# - Redis: localhost:6379
```

## Building for Production

```bash
# Build image
docker build -t liberty-social-backend:latest .

# Test locally
docker run --env-file .env -p 8000:8000 liberty-social-backend:latest
```

## ECS Deployment

### Option 1: Automated Script
```bash
export AWS_ACCOUNT_ID=123456789012
chmod +x deploy-ecs.sh
./deploy-ecs.sh
```

### Option 2: Manual Steps
```bash
# 1. Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# 2. Build and tag
docker build -t liberty-social-backend:latest .
docker tag liberty-social-backend:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest

# 3. Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest

# 4. Update ECS
aws ecs update-service \
  --cluster liberty-social-backend \
  --service liberty-social-backend-service \
  --force-new-deployment
```

## AWS Setup

### Create ECR Repository
```bash
aws ecr create-repository \
  --repository-name liberty-social-backend \
  --region us-east-1
```

### Create ECS Cluster
```bash
aws ecs create-cluster --cluster-name liberty-social-backend
```

### Register Task Definition
```bash
# Update ACCOUNT_ID in ecs-task-definition.json first
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json
```

### Store Secrets in Secrets Manager
```bash
# Store sensitive values
aws secretsmanager create-secret \
  --name liberty-social/SECRET_KEY \
  --secret-string "your-secret-key-value"

aws secretsmanager create-secret \
  --name liberty-social/DB_PASSWORD \
  --secret-string "your-db-password"

# ... repeat for other secrets
```

## Monitoring

### View Logs
```bash
# Real-time logs
aws logs tail /ecs/liberty-social-backend --follow

# Last 50 lines
aws logs tail /ecs/liberty-social-backend --max-items 50

# Specific time range
aws logs filter-log-events \
  --log-group-name /ecs/liberty-social-backend \
  --start-time $(date -d '1 hour ago' +%s)000
```

### Check Service Status
```bash
# Get service details
aws ecs describe-services \
  --cluster liberty-social-backend \
  --services liberty-social-backend-service

# Get task status
aws ecs list-tasks --cluster liberty-social-backend
aws ecs describe-tasks \
  --cluster liberty-social-backend \
  --tasks <task-arn>
```

### View Container Logs
```bash
# Find task
TASK_ARN=$(aws ecs list-tasks \
  --cluster liberty-social-backend \
  --query 'taskArns[0]' \
  --output text)

# Describe task
aws ecs describe-tasks \
  --cluster liberty-social-backend \
  --tasks $TASK_ARN
```

## Scaling

### Update Desired Count
```bash
aws ecs update-service \
  --cluster liberty-social-backend \
  --service liberty-social-backend-service \
  --desired-count 3
```

### Auto Scaling
```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/liberty-social-backend/liberty-social-backend-service \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy (CPU-based)
aws application-autoscaling put-scaling-policy \
  --policy-name cpu-scaling \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/liberty-social-backend/liberty-social-backend-service \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

## Troubleshooting

### Service Won't Start
```bash
# Check logs
aws logs tail /ecs/liberty-social-backend --follow

# Check task details
aws ecs describe-tasks --cluster liberty-social-backend --tasks <task-arn>

# Common issues:
# - Database not reachable (check RDS security group)
# - Redis not reachable (check ElastiCache security group)
# - Environment variables not set (check task definition)
# - Docker image not found (check ECR repository)
```

### Database Migrations Failed
```bash
# SSH into task container via ECS Exec
aws ecs execute-command \
  --cluster liberty-social-backend \
  --task <task-id> \
  --container liberty-social-backend \
  --interactive \
  --command "/bin/bash"

# Run migrations manually
python manage.py migrate
```

### Out of Memory
```bash
# Increase task memory in task definition
# Current: 512MB
# Recommended: 1024MB for production

# Update task definition with new memory
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition-updated.json
```

## Environment Variables Reference

### Required for Production
- `SECRET_KEY` - Django secret (store in Secrets Manager)
- `DEBUG` - False for production
- `DB_HOST` - RDS endpoint
- `DB_PASSWORD` - Database password (store in Secrets Manager)
- `REDIS_URL` - ElastiCache endpoint
- `AWS_ACCESS_KEY_ID` - (store in Secrets Manager)
- `AWS_SECRET_ACCESS_KEY` - (store in Secrets Manager)

### Optional but Recommended
- `ALLOWED_HOSTS` - Comma-separated list of allowed hosts
- `CORS_ALLOWED_ORIGINS` - Frontend URL(s)
- `EMAIL_BACKEND` - django_ses.SESBackend for AWS SES
- `FRONTEND_URL` - Your frontend URL
- `WORKER_TIMEOUT` - Daphne worker timeout (default: 120)

## Health Check

The application includes a health check endpoint:
```bash
curl http://<service-url>/api/health/
```

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123456Z"
}
```

## Useful Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Guide](https://docs.docker.com/compose/)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Django Deployment](https://docs.djangoproject.com/en/5.2/howto/deployment/)
- [Daphne ASGI Server](https://github.com/django/daphne)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
