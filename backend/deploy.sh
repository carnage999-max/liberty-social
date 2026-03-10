#!/bin/bash

# Backend Deployment Script
# Usage: ./deploy.sh <version_tag>
# Example: ./deploy.sh v19

set -e  # Exit on error

# Configuration
AWS_ACCOUNT_ID="704788056506"
AWS_REGION="us-east-1"
ECR_REPOSITORY="liberty-social-backend"
IMAGE_NAME="liberty-social-backend"
TARGET_PLATFORM="linux/amd64"

require_command() {
    local cmd="$1"
    local install_hint="$2"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: Required command '$cmd' is not installed or not in PATH."
        if [ -n "$install_hint" ]; then
            echo "$install_hint"
        fi
        exit 1
    fi
}

# Check if version tag is provided
if [ -z "$1" ]; then
    echo "Error: Version tag is required"
    echo "Usage: ./deploy.sh <version_tag>"
    echo "Example: ./deploy.sh v19"
    exit 1
fi

VERSION_TAG="$1"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
FULL_IMAGE_NAME="${ECR_REGISTRY}/${ECR_REPOSITORY}:${VERSION_TAG}"

echo "=========================================="
echo "Backend Deployment Script"
echo "=========================================="
echo "Version Tag: ${VERSION_TAG}"
echo "ECR Registry: ${ECR_REGISTRY}"
echo "Full Image: ${FULL_IMAGE_NAME}"
echo "=========================================="
echo ""

echo "Preflight: Checking required tools..."
require_command "python3" "Install Python 3 and ensure 'python3' is available in PATH."
require_command "docker" "Install Docker Desktop or Docker Engine and ensure 'docker' is available in PATH."
require_command "aws" "Install AWS CLI v2, then run 'aws configure' or export AWS credentials before deploying."
if ! docker buildx version >/dev/null 2>&1; then
    echo "Error: docker buildx is required to build ${TARGET_PLATFORM} images."
    exit 1
fi
echo "✓ Required tools are available"
echo ""

# Step 1: Verify local code is valid before building
echo "Step 1a: Verifying local code..."
if ! python3 -m py_compile users/passkey_views.py 2>/dev/null; then
    echo "❌ ERROR: users/passkey_views.py has syntax errors!"
    echo "   Please fix the code before deploying."
    exit 1
fi
echo "✓ Local code syntax is valid"
echo ""

# Step 2: Login to ECR
echo "Step 2: Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | sudo -E docker login --username AWS --password-stdin ${ECR_REGISTRY}
echo "✓ ECR login successful"
echo ""

# Step 3: Build and push a linux/amd64 image for ECS/Fargate
# Apple Silicon hosts otherwise default to arm64, which ECS x86 tasks cannot pull.
echo "Step 3: Building and pushing ${TARGET_PLATFORM} image..."
export DOCKER_BUILDKIT=1
sudo -E docker buildx build \
    --platform ${TARGET_PLATFORM} \
    --push \
    -t ${FULL_IMAGE_NAME} \
    -t ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest \
    .
echo "✓ Image built and pushed successfully"
echo ""

echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo "Image pushed to: ${FULL_IMAGE_NAME}"
echo ""
echo "Next steps:"
echo "1. Update ecs-task-definition.json with image tag: ${VERSION_TAG}"
echo "2. Register new task definition:"
echo "   aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json --region ${AWS_REGION}"
echo "3. Update ECS service with new task definition revision"
echo "=========================================="
