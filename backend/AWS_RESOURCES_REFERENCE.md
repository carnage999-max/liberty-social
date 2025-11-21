# AWS Resources Reference - Liberty Social Backend

**Complete resource mapping for AWS ECS deployment**

---

## 🗺️ Resource Dependency Map

```
┌─────────────────────────────────────────────────────────┐
│ Users / External Traffic                                 │
└──────────────────────┬──────────────────────────────────┘
                       │ (port 443/80 - HTTPS/HTTP)
                       ↓
┌──────────────────────────────────────────────────────────┐
│ AWS Route 53 (DNS)                                       │
│ - Points domain to ALB DNS name                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────┐
│ AWS Certificate Manager (ACM)                            │
│ - HTTPS Certificate                                      │
│ - Attached to ALB                                        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────┐
│ Application Load Balancer (ALB)                          │
│ - Name: liberty-social-backend-alb                       │
│ - VPC: Your VPC                                          │
│ - Subnets: 2+ public subnets                             │
│ - Security Group: Allows 80/443 inbound                  │
│ - Port 443: Routes to target group (port 8000)           │
│ - Port 80: Redirects to 443                              │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────┐
│ Target Group                                             │
│ - Name: liberty-social-backend-tg                        │
│ - Protocol: HTTP                                         │
│ - Port: 8000                                             │
│ - Health Check: /api/health/ (every 30s)                 │
│ - Healthy Threshold: 2, Unhealthy: 3                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────┐
│ AWS ECS Cluster (Fargate)                                │
│ - Name: liberty-social-backend                           │
│ - Launch Type: FARGATE                                   │
│ - VPC: Your VPC                                          │
│ - Subnets: 2+ private subnets                            │
│ - Security Group: Allows 8000 from ALB                   │
└──────────────────────┬──────────────────────────────────┘
                       │
           ┌───────────┼───────────┐
           │           │           │
           ↓           ↓           ↓
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Task 1   │ │ Task 2   │ │ Task N   │
    │ Daphne   │ │ Daphne   │ │ Daphne   │
    │ Port 8000│ │ Port 8000│ │ Port 8000│
    └────┬─────┘ └────┬─────┘ └────┬─────┘
         │            │             │
         └────────────┼─────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
          ↓           ↓           ↓
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ RDS      │ │ElastiCache│ │ S3       │
    │PostgreSQL│ │ Redis    │ │ Uploads  │
    │ Port 5432│ │ Port 6379│ │ Bucket   │
    └──────────┘ └──────────┘ └──────────┘
         │             │            │
         └─────────────┼────────────┘
                       │
                       ↓
          ┌─────────────────────────┐
          │ CloudWatch Logs         │
          │ /ecs/liberty-social-*   │
          │ - Application logs      │
          │ - Error tracking        │
          │ - Performance metrics   │
          └─────────────────────────┘
```

---

## 📦 AWS Resources Checklist

### Compute Services

#### ECS Cluster
```yaml
Service: AWS Elastic Container Service
Name: liberty-social-backend
LaunchType: FARGATE
NetworkMode: awsvpc
Region: us-east-1
Status: [ ] Created
```

#### ECS Service
```yaml
Service: AWS ECS Service
Cluster: liberty-social-backend
ServiceName: liberty-social-backend-service
TaskDefinition: liberty-social-backend:1
DesiredCount: 2 (minimum for HA)
LaunchType: FARGATE
LoadBalancer: 
  - TargetGroup: liberty-social-backend-tg
  - ContainerPort: 8000
Status: [ ] Created
```

#### ECS Task Definition
```yaml
Service: AWS ECS Task Definition
Family: liberty-social-backend
Revision: 1
NetworkMode: awsvpc
RequiresCompatibilities: [FARGATE]
CPU: 256 (units, 0.25 vCPU)
Memory: 512 (MB, 0.5 GB)
ExecutionRole: ecsTaskExecutionRole
TaskRole: ecsTaskRole
ContainerDefinitions:
  - name: liberty-social-backend
    image: {account-id}.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend:latest
    portMappings:
      - containerPort: 8000
        hostPort: 8000
    environment: [See Environment Variables below]
    secrets: [See Secrets below]
    logConfiguration:
      logDriver: awslogs
      options:
        awslogs-group: /ecs/liberty-social-backend
        awslogs-region: us-east-1
        awslogs-stream-prefix: ecs
Status: [ ] Registered
```

### Storage Services

#### RDS PostgreSQL Database
```yaml
Service: AWS RDS
Engine: PostgreSQL
EngineVersion: 15.latest
DatabaseName: liberty_social
MasterUsername: postgres
MasterUserPassword: [In Secrets Manager]
AllocatedStorage: 20 GB (min, scale as needed)
StorageType: gp3
MultiAZ: true (recommended for production)
BackupRetentionPeriod: 30 days
EnableEncryption: true
DBInstanceClass: db.t3.micro (or larger for production)
Endpoint: liberty-social-db.{random}.us-east-1.rds.amazonaws.com
Port: 5432
Status: [ ] Created
```

#### ElastiCache Redis / Valkey
```yaml
Service: AWS ElastiCache
Engine: redis (or valkey)
EngineVersion: 7.0.latest
CacheNodeType: cache.t3.micro (or larger for production)
NumCacheNodes: 1
Port: 6379
CacheSubnetGroup: Your VPC subnet group
SecurityGroup: Allows inbound from ECS (port 6379)
AutomaticFailover: disabled (for single node)
Endpoint: liberty-social-redis.{random}.ng.0001.use1.cache.amazonaws.com
Status: [ ] Created
```

#### S3 Bucket
```yaml
Service: AWS S3
BucketName: liberty-social-uploads
Region: us-east-1
VersioningEnabled: true (recommended)
PublicAccessBlockConfiguration:
  BlockPublicAcls: true
  BlockPublicPolicy: true
  IgnorePublicAcls: true
  RestrictPublicBuckets: true
CORSConfiguration:
  - AllowedMethods: [GET, PUT, POST, DELETE]
    AllowedOrigins: [https://yourdomain.com]
    AllowedHeaders: [*]
LifecycleConfiguration: [Optional - delete old files]
Status: [ ] Created
```

### Networking Services

#### Virtual Private Cloud (VPC)
```yaml
Service: AWS VPC
CIDR: 10.0.0.0/16 (example)
Subnets:
  PublicSubnets: 2+ (for ALB)
    - CIDR: 10.0.1.0/24
    - CIDR: 10.0.2.0/24
  PrivateSubnets: 2+ (for ECS/RDS/ElastiCache)
    - CIDR: 10.0.10.0/24
    - CIDR: 10.0.11.0/24
NatGateway: In public subnet (for private subnet internet access)
Status: [ ] Created
```

#### Security Groups
```yaml
ALB Security Group:
  Name: alb-sg
  Inbound:
    - HTTP (80) from 0.0.0.0/0
    - HTTPS (443) from 0.0.0.0/0
  Outbound: All traffic allowed
  Status: [ ] Created

ECS Task Security Group:
  Name: ecs-sg
  Inbound:
    - TCP 8000 from alb-sg
  Outbound:
    - TCP 5432 to rds-sg (database)
    - TCP 6379 to elasticache-sg (redis)
    - TCP 443 to 0.0.0.0/0 (HTTPS for AWS APIs, PyPI, etc.)
  Status: [ ] Created

RDS Security Group:
  Name: rds-sg
  Inbound:
    - TCP 5432 from ecs-sg
  Outbound: Default allow all
  Status: [ ] Created

ElastiCache Security Group:
  Name: elasticache-sg
  Inbound:
    - TCP 6379 from ecs-sg
  Outbound: Default allow all
  Status: [ ] Created
```

#### Application Load Balancer
```yaml
Service: AWS Application Load Balancer
Name: liberty-social-alb
Scheme: internet-facing
VPC: Your VPC
Subnets: 2+ public subnets
SecurityGroup: alb-sg
Listeners:
  - Port: 80
    Protocol: HTTP
    DefaultAction: Redirect to HTTPS
  - Port: 443
    Protocol: HTTPS
    Certificate: ACM certificate
    DefaultAction: Forward to liberty-social-backend-tg
TargetGroup:
  Name: liberty-social-backend-tg
  Protocol: HTTP
  Port: 8000
  VPC: Your VPC
  HealthCheckPath: /api/health/
  HealthCheckProtocol: HTTP
  HealthCheckIntervalSeconds: 30
  HealthCheckTimeoutSeconds: 5
  HealthyThresholdCount: 2
  UnhealthyThresholdCount: 3
Status: [ ] Created
```

### Container Registry

#### ECR Repository
```yaml
Service: AWS Elastic Container Registry
RepositoryName: liberty-social-backend
Region: us-east-1
RepositoryUri: {account-id}.dkr.ecr.us-east-1.amazonaws.com/liberty-social-backend
ImageScanningConfiguration:
  ScanOnPush: true (recommended)
EncryptionConfiguration:
  EncryptionType: AES256
Status: [ ] Created
```

### Secrets & IAM

#### AWS Secrets Manager
```yaml
Service: AWS Secrets Manager

Secrets:
  1. liberty-social/SECRET_KEY
     Type: String
     Value: [Django secret key - generate new]
     Status: [ ] Created

  2. liberty-social/DB_PASSWORD
     Type: String
     Value: [RDS master password]
     Status: [ ] Created

  3. liberty-social/AWS_ACCESS_KEY_ID
     Type: String
     Value: [IAM access key for S3]
     Status: [ ] Created

  4. liberty-social/AWS_SECRET_ACCESS_KEY
     Type: String
     Value: [IAM secret key for S3]
     Status: [ ] Created

  5. liberty-social/DEFAULT_FROM_EMAIL
     Type: String
     Value: noreply@yourdomain.com
     Status: [ ] Created
```

#### IAM Roles & Policies

##### ECS Task Execution Role
```yaml
Name: ecsTaskExecutionRole
Service: ECS Tasks
Policies:
  - AmazonECSTaskExecutionRolePolicy (AWS managed)
    - Allows: Pull ECR image, write to CloudWatch Logs
  - Custom: SecretsManagerAccess
    - Action:
        - secretsmanager:GetSecretValue
        - secretsmanager:DescribeSecret
    - Resource: arn:aws:secretsmanager:us-east-1:*:secret:liberty-social/*
Status: [ ] Created
```

##### ECS Task Role
```yaml
Name: ecsTaskRole
Service: ECS Tasks (running application)
Policies:
  - Custom: S3Access
    - Action:
        - s3:GetObject
        - s3:PutObject
        - s3:DeleteObject
        - s3:ListBucket
    - Resource:
        - arn:aws:s3:::liberty-social-uploads
        - arn:aws:s3:::liberty-social-uploads/*
  - Custom: SecretsManagerAccess
    - Action:
        - secretsmanager:GetSecretValue
    - Resource: arn:aws:secretsmanager:us-east-1:*:secret:liberty-social/*
Status: [ ] Created
```

### Logging & Monitoring

#### CloudWatch Logs
```yaml
Service: AWS CloudWatch Logs
LogGroup: /ecs/liberty-social-backend
RetentionInDays: 30 (adjust as needed)
LogStream: ecs/liberty-social-backend/liberty-social-backend/{task-id}
Status: [ ] Created
```

#### CloudWatch Alarms
```yaml
Alarms:
  - liberty-backend-cpu-high
    Metric: CPUUtilization
    Threshold: 80%
    Status: [ ] Created
    
  - liberty-backend-memory-high
    Metric: MemoryUtilization
    Threshold: 80%
    Status: [ ] Created
    
  - liberty-backend-task-failures
    Metric: TaskFailures
    Threshold: 1+
    Status: [ ] Created
```

#### CloudWatch Metrics
```yaml
Metrics Tracked:
  - CPUUtilization (%)
  - MemoryUtilization (%)
  - NetworkBytesIn/Out
  - TaskCount (running vs desired)
  - ServiceDeployments
  - TargetHealth (from ALB)
```

### DNS & SSL/TLS

#### Route 53 (DNS)
```yaml
Service: AWS Route 53
HostedZone: yourdomain.com
RecordName: backend.yourdomain.com (or yourdomain.com)
RecordType: A (Alias)
AliasTarget: liberty-social-alb (ALB DNS)
EvaluateTargetHealth: true
Status: [ ] Created
```

#### Certificate Manager (ACM)
```yaml
Service: AWS Certificate Manager
CertificateName: *.yourdomain.com (or yourdomain.com)
ValidationMethod: DNS
AttachedTo: ALB (HTTPS listener)
AutoRenewal: Enabled
Status: [ ] Created
```

---

## 🔄 Resource Relationships

### Data Flow
```
ALB (receives requests)
  ↓
ECS Tasks (processes requests via Daphne)
  ├→ RDS PostgreSQL (stores persistent data)
  ├→ ElastiCache Redis (caches data & sessions)
  └→ S3 (stores uploaded files)
  ↓
CloudWatch Logs (logs events)
```

### Security Flow
```
Route 53 (DNS)
  ↓
ACM Certificate (HTTPS)
  ↓
ALB Security Group (allows 80/443)
  ↓
ECS Task Security Group (allows 8000 from ALB)
  ├→ RDS Security Group (allows 5432)
  ├→ ElastiCache Security Group (allows 6379)
  └→ Internet Gateway (allows 443 outbound)
```

### Secret Management Flow
```
ECS Task Definition (references secrets)
  ↓
Task Execution Role (has permission)
  ↓
AWS Secrets Manager (stores secrets)
  ↓
Task retrieves at startup (environment variables)
```

---

## 📊 Total Resources Summary

| Category | Count | Created |
|----------|-------|---------|
| **Compute** | 3 | [ ] Cluster, Service, Task Def |
| **Storage** | 3 | [ ] RDS, ElastiCache, S3 |
| **Networking** | 5 | [ ] VPC, Subnets, SGs, ALB, TG |
| **Registry** | 1 | [ ] ECR Repository |
| **Secrets** | 5 | [ ] 5 secrets in Secrets Mgr |
| **IAM** | 2 | [ ] Execution Role, Task Role |
| **Logging** | 1 | [ ] CloudWatch Log Group |
| **DNS/SSL** | 2 | [ ] Route 53, ACM Certificate |
| **Monitoring** | 3 | [ ] 3 CloudWatch Alarms |
| **TOTAL** | **25** | **[ ]** |

---

## 🔍 Verification Checklist

After creating all resources, verify:

```bash
# 1. ECR Repository
aws ecr describe-repositories --repository-names liberty-social-backend

# 2. RDS Database
aws rds describe-db-instances --db-instance-identifier liberty-social-db

# 3. ElastiCache
aws elasticache describe-cache-clusters --cache-cluster-id liberty-social-redis

# 4. S3 Bucket
aws s3api head-bucket --bucket liberty-social-uploads

# 5. ECS Cluster
aws ecs describe-clusters --clusters liberty-social-backend

# 6. Security Groups
aws ec2 describe-security-groups --filters Name=group-name,Values=ecs-sg,rds-sg,elasticache-sg,alb-sg

# 7. Load Balancer
aws elbv2 describe-load-balancers --load-balancer-arns <arn>

# 8. CloudWatch Log Group
aws logs describe-log-groups --log-group-name-prefix /ecs/

# 9. Secrets
aws secretsmanager list-secrets --filters Key=name,Values=liberty-social

# 10. IAM Roles
aws iam get-role --role-name ecsTaskExecutionRole
aws iam get-role --role-name ecsTaskRole
```

---

## 💡 Best Practices Applied

✅ **High Availability**
- Multi-AZ RDS
- Load balanced ECS tasks
- Multiple availability zones

✅ **Security**
- Secrets in Secrets Manager (not in code/config)
- IAM roles (not access keys)
- Security groups (network isolation)
- Non-root container user
- HTTPS enforced

✅ **Scalability**
- Fargate auto-scaling capable
- Separate database tier
- Redis caching
- S3 for static/uploaded files

✅ **Monitoring**
- CloudWatch Logs integration
- Health checks
- Alarms for key metrics
- Task failure detection

---

**Status:** 📋 Use this as your deployment checklist!

**Next:** Cross off each resource as you create it in AWS.
