# AWS ECS Deployment Checklist & Step-by-Step Guide

**Last Updated:** November 21, 2025  
**Status:** 🟡 Ready for Deployment (Prerequisites Required)

---

## 📋 Pre-Deployment Requirements

### 1. AWS Account Setup
- [ ] AWS Account created and active
- [ ] AWS CLI installed and configured (`aws --version`)
- [ ] Docker installed and running (`docker --version`)
- [ ] Appropriate IAM permissions for:
  - ECR (push/pull images)
  - ECS (create/update tasks and services)
  - RDS (create/manage databases)
  - ElastiCache (create/manage Redis)
  - Secrets Manager (create/update secrets)
  - CloudWatch (create log groups)

### 2. AWS Resources Status
- [ ] **ECR Repository created**: `liberty-social-backend`
- [ ] **RDS PostgreSQL 15** deployed and accessible
  - Endpoint: `____________________`
  - Database name: `liberty_social`
  - Master user: `postgres`
- [ ] **Valkey/ElastiCache Redis** deployed and accessible
  - Endpoint: `____________________`
  - Port: `6379`
- [ ] **S3 Bucket created**: `liberty-social-uploads`
  - IAM policy configured for ECS task role
- [ ] **VPC & Security Groups** configured:
  - ECS security group created
  - RDS allows inbound from ECS (port 5432)
  - ElastiCache allows inbound from ECS (port 6379)
  - S3 accessible via IAM role
- [ ] **Application Load Balancer** configured
  - Target group listening on port 8000
- [ ] **CloudWatch Log Group** created: `/ecs/liberty-social-backend`

---

## 🔑 Step 1: Create AWS Secrets

Before deploying, store sensitive data in **AWS Secrets Manager**:

```bash
# Replace the values below with your actual production values

# 1. Django Secret Key (generate new)
aws secretsmanager create-secret \
  --name liberty-social/SECRET_KEY \
  --secret-string "$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')" \
  --region us-east-1

# 2. Database Password (use your RDS password)
aws secretsmanager create-secret \
  --name liberty-social/DB_PASSWORD \
  --secret-string "your-rds-password-here" \
  --region us-east-1

# 3. AWS S3 Credentials
aws secretsmanager create-secret \
  --name liberty-social/AWS_ACCESS_KEY_ID \
  --secret-string "your-iam-access-key" \
  --region us-east-1

aws secretsmanager create-secret \
  --name liberty-social/AWS_SECRET_ACCESS_KEY \
  --secret-string "your-iam-secret-key" \
  --region us-east-1

# 4. Email Configuration (if using SES)
aws secretsmanager create-secret \
  --name liberty-social/DEFAULT_FROM_EMAIL \
  --secret-string "noreply@yourdomain.com" \
  --region us-east-1
```

**Verify secrets were created:**
```bash
aws secretsmanager list-secrets --region us-east-1 --query 'SecretList[?contains(Name, `liberty-social`)].Name'
```

---

## 🏗️ Step 2: Update ECS Task Definition

Edit `ecs-task-definition.json` and replace placeholders:

```bash
# Set your AWS Account ID
export AWS_ACCOUNT_ID="123456789012"

# Update the task definition file
sed -i "s|YOUR_ACCOUNT_ID|$AWS_ACCOUNT_ID|g" ecs-task-definition.json
```

**Manual updates needed in `ecs-task-definition.json`:**

1. Replace `YOUR_ACCOUNT_ID` with actual AWS Account ID
2. Update `ALLOWED_HOSTS`:
   ```json
   "value": "yourdomain.com,www.yourdomain.com,*.elb.amazonaws.com"
   ```
3. Update `CORS_ALLOWED_ORIGINS`:
   ```json
   "value": "https://yourdomain.com,https://www.yourdomain.com"
   ```
4. Update `FRONTEND_URL`:
   ```json
   "value": "https://yourdomain.com"
   ```
5. Update `DB_HOST` (your RDS endpoint):
   ```json
   {"name": "DB_HOST", "value": "liberty-social-db.xxxxx.us-east-1.rds.amazonaws.com"}
   ```
6. Update `REDIS_URL` (your ElastiCache endpoint):
   ```json
   {"name": "REDIS_URL", "value": "redis://liberty-social-redis.xxxxx.ng.0001.use1.cache.amazonaws.com:6379/0"}
   ```

---

## 🐳 Step 3: Build and Push Docker Image

### Option A: Using the automated script (Recommended)

```bash
cd /home/binary/Desktop/liberty-social/backend

# Make script executable
chmod +x deploy-ecs.sh

# Set your AWS Account ID and deploy
export AWS_ACCOUNT_ID="123456789012"
export AWS_REGION="us-east-1"
./deploy-ecs.sh
```

### Option B: Manual steps

```bash
cd /home/binary/Desktop/liberty-social/backend

export AWS_ACCOUNT_ID="123456789012"
export AWS_REGION="us-east-1"
export ECR_REPO="liberty-social-backend"

# 1. Build the image
echo "Building Docker image..."
docker build -t $ECR_REPO:latest .

# 2. Login to ECR
echo "Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# 3. Tag the image
echo "Tagging image..."
docker tag $ECR_REPO:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

# 4. Push to ECR
echo "Pushing to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

echo "✅ Docker image pushed to ECR!"
```

---

## 📝 Step 4: Register ECS Task Definition

```bash
# Register the task definition
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json \
  --region us-east-1

# Verify it was registered
aws ecs list-task-definitions \
  --family-prefix liberty-social-backend \
  --region us-east-1
```

**Expected output:** Task definition version (e.g., `liberty-social-backend:1`)

---

## 🚀 Step 5: Create or Update ECS Service

### If service doesn't exist yet:

```bash
# Get your VPC subnet IDs
aws ec2 describe-subnets \
  --region us-east-1 \
  --query 'Subnets[0:2].[SubnetId]' \
  --output text

# Get your ECS security group
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=ecs-*" \
  --region us-east-1 \
  --query 'SecurityGroups[0].GroupId'

# Get your ALB target group ARN
aws elbv2 describe-target-groups \
  --region us-east-1 \
  --query 'TargetGroups[?TargetGroupName==`liberty-social-backend`].TargetGroupArn' \
  --output text

# Create the service
aws ecs create-service \
  --cluster liberty-social-backend \
  --service-name liberty-social-backend-service \
  --task-definition liberty-social-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=liberty-social-backend,containerPort=8000 \
  --region us-east-1
```

### If service already exists (update deployment):

```bash
aws ecs update-service \
  --cluster liberty-social-backend \
  --service liberty-social-backend-service \
  --force-new-deployment \
  --region us-east-1
```

---

## ✅ Step 6: Verify Deployment

### Check service status:
```bash
aws ecs describe-services \
  --cluster liberty-social-backend \
  --services liberty-social-backend-service \
  --region us-east-1 \
  --query 'services[0].[serviceName,status,runningCount,desiredCount,deployments[0].status]' \
  --output table
```

### Wait for tasks to be running:
```bash
# Check every 10 seconds until desiredCount == runningCount
watch -n 10 'aws ecs describe-services \
  --cluster liberty-social-backend \
  --services liberty-social-backend-service \
  --region us-east-1 \
  --query "services[0].[desiredCount,runningCount,pendingCount]"'
```

### View real-time logs:
```bash
aws logs tail /ecs/liberty-social-backend --follow --region us-east-1
```

### Get load balancer URL:
```bash
aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query 'LoadBalancers[0].DNSName'
```

---

## 🧪 Step 7: Test the Deployment

```bash
# Get load balancer URL
LB_URL=$(aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Test API health endpoint
curl -v http://$LB_URL/api/health/

# Expected response:
# {"status": "healthy", "timestamp": "2024-01-15T10:30:45.123456Z"}
```

---

## 🔧 Troubleshooting

### Task fails to start

**Check logs:**
```bash
aws logs tail /ecs/liberty-social-backend --follow
```

**Common issues:**

1. **Database connection refused**
   - Verify RDS is running
   - Check RDS security group allows ECS traffic on port 5432
   - Verify DB_HOST is correct in task definition

2. **Redis connection timeout**
   - Verify ElastiCache cluster is running
   - Check ElastiCache security group allows ECS traffic on port 6379
   - Verify REDIS_URL is correct

3. **Secrets not found**
   - Verify Secrets Manager secrets exist
   - Check task role IAM policy has `secretsmanager:GetSecretValue` permission
   - Verify secret ARNs are correct in task definition

4. **Health check failing**
   - Check API endpoint exists: `GET /api/health/`
   - Increase health check timeout in ECS task definition
   - View container logs for errors

### Scale the service:

```bash
aws ecs update-service \
  --cluster liberty-social-backend \
  --service liberty-social-backend-service \
  --desired-count 3 \
  --region us-east-1
```

### Roll back to previous version:

```bash
# Get previous task definition
aws ecs describe-services \
  --cluster liberty-social-backend \
  --services liberty-social-backend-service \
  --region us-east-1 \
  --query 'services[0].taskDefinition' \
  --output text

# Update service to use previous version
aws ecs update-service \
  --cluster liberty-social-backend \
  --service liberty-social-backend-service \
  --task-definition liberty-social-backend:PREVIOUS_VERSION \
  --region us-east-1
```

---

## 📊 Monitoring Setup

### Create CloudWatch Alarms

```bash
# High CPU usage alert
aws cloudwatch put-metric-alarm \
  --alarm-name liberty-backend-cpu-high \
  --alarm-description "Alert when CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ServiceName,Value=liberty-social-backend-service Name=ClusterName,Value=liberty-social-backend

# High memory usage alert
aws cloudwatch put-metric-alarm \
  --alarm-name liberty-backend-memory-high \
  --alarm-description "Alert when memory > 80%" \
  --metric-name MemoryUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=ServiceName,Value=liberty-social-backend-service Name=ClusterName,Value=liberty-social-backend

# Task failures alert
aws cloudwatch put-metric-alarm \
  --alarm-name liberty-backend-task-failures \
  --alarm-description "Alert on ECS task failures" \
  --metric-name TaskFailures \
  --namespace AWS/ECS \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions Name=ServiceName,Value=liberty-social-backend-service Name=ClusterName,Value=liberty-social-backend
```

---

## 🎯 Production Checklist Before Going Live

- [ ] **Database**
  - [ ] RDS backups enabled (30+ day retention)
  - [ ] RDS Multi-AZ enabled (for HA)
  - [ ] Database password is strong and stored in Secrets Manager
  - [ ] Automated backups tested and restored successfully

- [ ] **Application**
  - [ ] All environment variables set in task definition
  - [ ] All secrets created in Secrets Manager
  - [ ] Health check endpoint responding correctly
  - [ ] Static files served properly (S3/CloudFront configured)
  - [ ] Email sending tested (if using SES)

- [ ] **Infrastructure**
  - [ ] Load balancer health checks passing
  - [ ] At least 2 tasks running for HA
  - [ ] Auto-scaling configured (optional but recommended)
  - [ ] Security groups properly configured
  - [ ] CloudWatch alarms set up

- [ ] **Monitoring**
  - [ ] CloudWatch Logs configured
  - [ ] Error alarms set up
  - [ ] Resource usage alerts configured
  - [ ] On-call procedures documented

- [ ] **DNS & HTTPS**
  - [ ] Domain registered and pointed to ALB
  - [ ] ACM certificate created and assigned to load balancer
  - [ ] HTTPS working and redirecting HTTP traffic

---

## 📞 Support & Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [AWS ElastiCache Documentation](https://docs.aws.amazon.com/elasticache/)
- [Daphne ASGI Server](https://github.com/django/daphne)
- [Django Deployment Guide](https://docs.djangoproject.com/en/5.2/howto/deployment/)

---

**Next Steps:**
1. ✅ Complete all pre-deployment requirements
2. ✅ Create AWS secrets
3. ✅ Update ECS task definition
4. ✅ Build and push Docker image
5. ✅ Register task definition
6. ✅ Create/update ECS service
7. ✅ Verify deployment
8. ✅ Test endpoints
9. ✅ Set up monitoring
10. ✅ Configure DNS and HTTPS

**Deployment Status:** 🟡 Ready to proceed (pending AWS account setup)
