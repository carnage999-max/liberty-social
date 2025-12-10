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

# Step 1: Verify local code is valid before building
echo "Step 1a: Verifying local code..."
if ! python3 -m py_compile users/passkey_views.py 2>/dev/null; then
    echo "❌ ERROR: users/passkey_views.py has syntax errors!"
    echo "   Please fix the code before deploying."
    exit 1
fi
echo "✓ Local code syntax is valid"
echo ""

# Step 1b: Build Docker image
# Use --no-cache to ensure we get a completely fresh build with the latest code
# This is important when fixing bugs to ensure the fix is included
echo "Step 1b: Building Docker image (no cache to ensure fresh build)..."
# Enable BuildKit for better performance
export DOCKER_BUILDKIT=1
sudo -E docker build --no-cache \
    -t ${IMAGE_NAME}:${VERSION_TAG} \
    -t ${IMAGE_NAME}:latest \
    .
echo "✓ Build complete"
echo ""

# Step 2: Tag the image
echo "Step 2: Tagging image as ${VERSION_TAG}..."
sudo -E docker tag ${IMAGE_NAME}:${VERSION_TAG} ${FULL_IMAGE_NAME}
echo "✓ Image tagged"
echo ""

# Step 3: Login to ECR
echo "Step 3: Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | sudo -E docker login --username AWS --password-stdin ${ECR_REGISTRY}
echo "✓ ECR login successful"
echo ""

# Step 4: Push to ECR
echo "Step 4: Pushing image to ECR..."
sudo -E docker push ${FULL_IMAGE_NAME}
echo "✓ Image pushed successfully"
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

