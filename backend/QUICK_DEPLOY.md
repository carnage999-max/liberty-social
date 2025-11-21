# 🚀 Quick Deployment Guide - Liberty Social Backend

**For when you're ready to deploy to AWS ECS RIGHT NOW**

---

## ⚡ 5-Minute Setup (Prerequisites Completed)

```bash
cd /home/binary/Desktop/liberty-social/backend

# 1. Set your AWS Account ID
export AWS_ACCOUNT_ID="123456789012"
export AWS_REGION="us-east-1"

# 2. Create secrets (one-time setup)
aws secretsmanager create-secret \
  --name liberty-social/SECRET_KEY \
  --secret-string "$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')" \
  --region $AWS_REGION

# 3. Deploy! (automated script handles everything)
chmod +x deploy-ecs.sh
./deploy-ecs.sh
```

**That's it!** The script will:
- ✅ Build Docker image
- ✅ Login to ECR
- ✅ Push image to AWS
- ✅ Update ECS service
- ✅ Wait for deployment to complete
- ✅ Show you the status

---

## 📋 What You Need First

Before running the deployment, make sure you have:

1. **AWS Account** with these services:
   - ✅ ECR (Elastic Container Registry)
   - ✅ ECS (Elastic Container Service)
   - ✅ RDS (PostgreSQL database)
   - ✅ ElastiCache (Redis/Valkey)
   - ✅ Application Load Balancer
   - ✅ CloudWatch Log Group: `/ecs/liberty-social-backend`

2. **AWS CLI configured:**
   ```bash
   aws --version
   aws sts get-caller-identity  # Should show your account
   ```

3. **Docker installed:**
   ```bash
   docker --version
   docker ps  # Should work without sudo
   ```

4. **Your AWS Account ID** (find it here):
   ```bash
   aws sts get-caller-identity --query Account --output text
   ```

---

## 🔧 Manual Deployment (Step by Step)

If the script doesn't work, do this manually:

```bash
cd /home/binary/Desktop/liberty-social/backend

export AWS_ACCOUNT_ID="your-account-id"
export AWS_REGION="us-east-1"
export ECR_REPO="liberty-social-backend"

# Step 1: Build the Docker image
docker build -t $ECR_REPO:latest .

# Step 2: Login to AWS ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Step 3: Tag the image
docker tag $ECR_REPO:latest \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

# Step 4: Push to ECR
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

# Step 5: Register task definition
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json \
  --region $AWS_REGION

# Step 6: Update ECS service
aws ecs update-service \
  --cluster liberty-social-backend \
  --service liberty-social-backend-service \
  --force-new-deployment \
  --region $AWS_REGION

# Step 7: Watch the deployment
aws logs tail /ecs/liberty-social-backend --follow --region $AWS_REGION
```

---

## ✅ Verify Deployment

```bash
# Check service status
aws ecs describe-services \
  --cluster liberty-social-backend \
  --services liberty-social-backend-service \
  --region us-east-1 \
  --query 'services[0].[status,runningCount,desiredCount]'

# View logs
aws logs tail /ecs/liberty-social-backend --follow

# Get load balancer URL
aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query 'LoadBalancers[0].DNSName'

# Test API
curl http://<load-balancer-url>/api/health/
```

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| `Permission denied` | Run `sudo usermod -aG docker $USER` then logout/login |
| `Database connection refused` | Verify RDS security group allows ECS task traffic on 5432 |
| `Redis timeout` | Verify ElastiCache security group allows ECS task traffic on 6379 |
| `Task keeps stopping` | Check logs: `aws logs tail /ecs/liberty-social-backend --follow` |
| `Health check failing` | Verify `/api/health/` endpoint exists in Django URLs |

---

## 📊 After Deployment

### Monitor the application
```bash
# Real-time logs
aws logs tail /ecs/liberty-social-backend --follow

# Check task details
aws ecs describe-tasks \
  --cluster liberty-social-backend \
  --tasks <task-arn> \
  --region us-east-1
```

### Scale the service
```bash
# Run more instances
aws ecs update-service \
  --cluster liberty-social-backend \
  --service liberty-social-backend-service \
  --desired-count 3 \
  --region us-east-1
```

### View metrics in CloudWatch
```bash
# CPU usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=liberty-social-backend-service Name=ClusterName,Value=liberty-social-backend \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

---

## 🎯 You're All Set!

Your Liberty Social backend is now running on AWS ECS! 🎉

- **API Base**: `http://<load-balancer-url>`
- **Health Check**: `GET /api/health/`
- **Logs**: CloudWatch Logs Group `/ecs/liberty-social-backend`
- **Dashboard**: AWS ECS Console

For detailed troubleshooting, see `DEPLOYMENT_CHECKLIST.md`.
