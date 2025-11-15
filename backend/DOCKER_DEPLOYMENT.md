# Liberty Social Backend - Docker & ECS Deployment Guide

## Overview

This guide covers Docker containerization and deployment to AWS ECS for the Liberty Social backend running Daphne (ASGI server).

## Files Included

- **Dockerfile** - Multi-stage build optimized for production
- **docker-entrypoint.sh** - Entrypoint script with environment initialization
- **docker-compose.yml** - Local development setup with PostgreSQL, Redis, Celery, Mailhog
- **.dockerignore** - Excludes unnecessary files from Docker image
- **.env.example** - Example environment variables

## Quick Start

### 1. Local Development with Docker Compose

```bash
# Copy environment variables
cp .env.example .env

# Start all services (PostgreSQL, Redis, Backend, Celery, Mailhog)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Stop services
docker-compose down
```

**Access Points:**
- Backend API: http://localhost:8000
- Mailhog (Email Testing): http://localhost:8025
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 2. Building Docker Image for Production

```bash
# Build the image
docker build -t liberty-social-backend:latest .

# Test the image locally
docker run --env-file .env \
  -e DB_HOST=host.docker.internal \
  -p 8000:8000 \
  liberty-social-backend:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

docker tag liberty-social-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest

docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest
```

## Environment Variables

### Required for Production

```bash
# Django
SECRET_KEY=your-production-secret-key
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,*.elasticloadbalancing.amazonaws.com

# Database (RDS)
DB_HOST=your-rds-instance.us-east-1.rds.amazonaws.com
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_NAME=liberty_social
DB_PORT=5432

# Redis (ElastiCache)
REDIS_URL=redis://your-elasticache-endpoint.ng.0001.use1.cache.amazonaws.com:6379/0
CELERY_BROKER_URL=redis://your-elasticache-endpoint.ng.0001.use1.cache.amazonaws.com:6379/1
CELERY_RESULT_BACKEND=redis://your-elasticache-endpoint.ng.0001.use1.cache.amazonaws.com:6379/2

# AWS
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=liberty-social-uploads
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Email (SES)
EMAIL_BACKEND=django_ses.SESBackend
DEFAULT_FROM_EMAIL=noreply@yourdomain.com

# Frontend
FRONTEND_URL=https://yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## AWS ECS Deployment

### Step 1: Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name liberty-social-backend \
  --region us-east-1
```

### Step 2: Build and Push Image

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and tag
docker build -t liberty-social-backend:latest .
docker tag liberty-social-backend:latest \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest
```

### Step 3: Create ECS Task Definition

**File: `ecs-task-definition.json`**

```json
{
  "family": "liberty-social-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "liberty-social-backend",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8000,
          "hostPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DEBUG",
          "value": "False"
        },
        {
          "name": "ALLOWED_HOSTS",
          "value": "yourdomain.com,*.elb.amazonaws.com"
        }
      ],
      "secrets": [
        {
          "name": "SECRET_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:liberty-social-backend-secret-key"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:liberty-social-db-password"
        },
        {
          "name": "AWS_SECRET_ACCESS_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:liberty-social-aws-secret-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/liberty-social-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/api/health/ || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 2,
        "startPeriod": 40
      }
    }
  ],
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskRole"
}
```

Register the task definition:
```bash
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json
```

### Step 4: Create ECS Cluster and Service

```bash
# Create cluster
aws ecs create-cluster --cluster-name liberty-social-backend

# Create service (update with your VPC/subnet IDs)
aws ecs create-service \
  --cluster liberty-social-backend \
  --service-name liberty-social-backend-service \
  --task-definition liberty-social-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:<account-id>:targetgroup/liberty-social-backend/xxx,containerName=liberty-social-backend,containerPort=8000
```

### Step 5: Configure RDS and ElastiCache

**Create RDS PostgreSQL:**
```bash
aws rds create-db-instance \
  --db-instance-identifier liberty-social-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password your-secure-password \
  --allocated-storage 20 \
  --db-name liberty_social \
  --publicly-accessible false \
  --vpc-security-group-ids sg-xxx
```

**Create ElastiCache Redis:**
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id liberty-social-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1
```

### Step 6: Configure Security Groups

**ECS Task Security Group (outbound):**
- Allow TCP 6379 to Redis security group
- Allow TCP 5432 to RDS security group
- Allow TCP 443 to internet (for AWS services)

**RDS Security Group (inbound):**
- Allow TCP 5432 from ECS task security group

**Redis Security Group (inbound):**
- Allow TCP 6379 from ECS task security group

### Step 7: Update ECS Service

```bash
# After pushing new image
aws ecs update-service \
  --cluster liberty-social-backend \
  --service liberty-social-backend-service \
  --force-new-deployment
```

## Troubleshooting

### View Logs
```bash
# CloudWatch logs
aws logs tail /ecs/liberty-social-backend --follow

# Container logs
docker-compose logs -f backend
```

### Common Issues

**Database Connection Failed:**
- Check security group rules
- Verify RDS endpoint in environment variables
- Ensure database is created

**Redis Connection Failed:**
- Check ElastiCache security group
- Verify Redis endpoint format (no auth token for basic setup)
- Ensure Redis cluster is in the same VPC

**Health Check Failing:**
- Check if API endpoint exists: `GET /api/health/`
- Verify Daphne is running: `docker logs <container-id>`
- Check logs for errors

**Out of Memory:**
- Increase ECS task memory (current: 512MB)
- Monitor with CloudWatch

## Performance Optimization

### Daphne Settings in entrypoint.sh
- `--http-timeout 120` - Request timeout
- `--verbosity 2` - Logging verbosity
- Workers handled by OS process limits

### Recommended ECS Configuration
- **CPU:** 256+ (for 1 concurrent connection)
- **Memory:** 512MB+ (512MB minimum for Django + Daphne)
- **Replicas:** 2+ for HA
- **Auto-scaling:** Enable with CPU/Memory metrics

## Monitoring and Logging

### CloudWatch Integration
```bash
# View logs
aws logs tail /ecs/liberty-social-backend --follow

# Create alarms
aws cloudwatch put-metric-alarm \
  --alarm-name liberty-backend-cpu-high \
  --alarm-description "Alert when CPU is high" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

## CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to ECS

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

env:
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com
  ECR_REPOSITORY: liberty-social-backend

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to ECR
        run: aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
      
      - name: Build and push
        working-directory: ./backend
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:latest .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
      
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster liberty-social-backend \
            --service liberty-social-backend-service \
            --force-new-deployment
```

## Health Checks

The application includes a health check endpoint (requires setup):

```python
# Add to your urls.py
@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({
        'status': 'healthy',
        'timestamp': timezone.now(),
    }, status=200)
```

Route: `GET /api/health/`

## Support

For issues or questions, refer to:
- [Django Documentation](https://docs.djangoproject.com/)
- [Daphne Documentation](https://github.com/django/daphne)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [ElastiCache Documentation](https://docs.aws.amazon.com/elasticache/)
