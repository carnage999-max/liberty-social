#!/bin/bash

# Get the log group name from ECS task definition
LOG_GROUP="/aws/ecs/liberty-social-api"

# Get recent logs (last 5 minutes) and filter for call-related messages
echo "Checking CloudWatch logs for call-related messages (last 5 minutes)..."
echo "================================================================"

# Check if AWS CLI is configured
if ! command -v aws &> /dev/null; then
    echo "AWS CLI not found. Please install it first."
    exit 1
fi

# Get logs for call_id 94 (the most recent call from the logs)
echo ""
echo "Searching for call_id=94..."
aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time $(($(date +%s) - 600))000 \
    --filter-pattern "94" \
    --query 'events[*].[timestamp,message]' \
    --output text | \
    grep -E "(CHATWS|NotificationWS|CALL)" || echo "No logs found for call_id=94"

echo ""
echo "================================================================"
echo "Searching for call routing messages..."
aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time $(($(date +%s) - 600))000 \
    --filter-pattern "Routing call" \
    --query 'events[*].message' \
    --output text || echo "No routing logs found"

echo ""
echo "================================================================"
echo "Searching for call.offer messages..."
aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time $(($(date +%s) - 600))000 \
    --filter-pattern "call.offer" \
    --query 'events[*].message' \
    --output text || echo "No call.offer logs found"

echo ""
echo "================================================================"
echo "Searching for errors in consumers..."
aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time $(($(date +%s) - 600))000 \
    --filter-pattern "Error" \
    --query 'events[*].message' \
    --output text | \
    grep -E "(call|CHATWS|NotificationWS)" || echo "No consumer errors found"

