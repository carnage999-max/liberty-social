#!/bin/bash
# ECS Deployment Script for Liberty Social Backend
# This script automates the deployment process to AWS ECS

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID}"
ECR_REPOSITORY_NAME="${ECR_REPOSITORY_NAME:-liberty-social-backend}"
ECS_CLUSTER_NAME="${ECS_CLUSTER_NAME:-liberty-social-backend}"
ECS_SERVICE_NAME="${ECS_SERVICE_NAME:-liberty-social-backend-service}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Validate inputs
validate_inputs() {
    print_header "Validating Inputs"
    
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        print_error "AWS_ACCOUNT_ID is not set"
        echo "Usage: AWS_ACCOUNT_ID=123456789012 ./deploy-ecs.sh"
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    print_success "AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"
    print_success "AWS_REGION: $AWS_REGION"
    print_success "ECR_REPOSITORY: $ECR_REPOSITORY_NAME"
    print_success "ECS_CLUSTER: $ECS_CLUSTER_NAME"
    print_success "ECS_SERVICE: $ECS_SERVICE_NAME"
    echo ""
}

# Build Docker image
build_image() {
    print_header "Building Docker Image"
    
    print_info "Building docker image..."
    docker build -t "$ECR_REPOSITORY_NAME:$IMAGE_TAG" .
    
    print_success "Docker image built: $ECR_REPOSITORY_NAME:$IMAGE_TAG"
    echo ""
}

# Login to ECR
login_to_ecr() {
    print_header "Logging into AWS ECR"
    
    print_info "Getting ECR login credentials..."
    aws ecr get-login-password --region "$AWS_REGION" | \
        docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
    
    print_success "Logged into ECR"
    echo ""
}

# Tag image
tag_image() {
    print_header "Tagging Docker Image"
    
    local ECR_IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME:$IMAGE_TAG"
    
    print_info "Tagging image: $ECR_IMAGE_URI"
    docker tag "$ECR_REPOSITORY_NAME:$IMAGE_TAG" "$ECR_IMAGE_URI"
    
    print_success "Image tagged: $ECR_IMAGE_URI"
    echo ""
}

# Push to ECR
push_to_ecr() {
    print_header "Pushing Image to ECR"
    
    local ECR_IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY_NAME:$IMAGE_TAG"
    
    print_info "Pushing image to ECR..."
    docker push "$ECR_IMAGE_URI"
    
    print_success "Image pushed to ECR: $ECR_IMAGE_URI"
    echo ""
}

# Update ECS service
update_ecs_service() {
    print_header "Updating ECS Service"
    
    print_info "Updating ECS service to deploy new image..."
    aws ecs update-service \
        --cluster "$ECS_CLUSTER_NAME" \
        --service "$ECS_SERVICE_NAME" \
        --force-new-deployment \
        --region "$AWS_REGION"
    
    print_success "ECS service update initiated"
    echo ""
}

# Wait for service to stabilize
wait_for_service() {
    print_header "Waiting for Service Deployment"
    
    print_info "Waiting for service to reach stable state (this may take a few minutes)..."
    
    # Wait for service to stabilize
    aws ecs wait services-stable \
        --cluster "$ECS_CLUSTER_NAME" \
        --services "$ECS_SERVICE_NAME" \
        --region "$AWS_REGION" || {
        print_warning "Service did not stabilize within timeout. Check CloudWatch logs."
        return 1
    }
    
    print_success "Service is stable"
    echo ""
}

# Get service status
get_service_status() {
    print_header "Service Status"
    
    aws ecs describe-services \
        --cluster "$ECS_CLUSTER_NAME" \
        --services "$ECS_SERVICE_NAME" \
        --region "$AWS_REGION" \
        --query 'services[0].[serviceName,status,runningCount,desiredCount,deployments[0].status]' \
        --output table
    
    echo ""
}

# View logs
view_logs() {
    print_header "View Logs Command"
    
    print_info "To view real-time logs, run:"
    echo "  aws logs tail /ecs/liberty-social-backend --follow --region $AWS_REGION"
    echo ""
}

# Main execution
main() {
    print_header "Liberty Social Backend - ECS Deployment"
    
    validate_inputs
    build_image
    login_to_ecr
    tag_image
    push_to_ecr
    update_ecs_service
    wait_for_service
    get_service_status
    view_logs
    
    print_success "Deployment completed successfully! 🚀"
}

# Run main
main
