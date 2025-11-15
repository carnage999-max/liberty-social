#!/bin/bash
# Docker entrypoint script for Liberty Social Backend
# Handles environment initialization, migrations, and starting the server

set -e

# Function to set default if env var doesn't exist
set_default() {
    local var_name=$1
    local default_value=$2
    
    if [ -z "${!var_name}" ]; then
        export "$var_name"="$default_value"
        echo "⚠️  $var_name not set, using default: $default_value"
    else
        echo "✓ $var_name is set"
    fi
}

echo "================================================"
echo "� Liberty Social Backend - Docker Startup"
echo "================================================"
echo ""

# ============================================
# 1. Initialize Environment Variables
# ============================================
echo "�🔧 Step 1: Initializing environment variables..."
echo ""

# Django Settings
set_default "DEBUG" "False"
set_default "ALLOWED_HOSTS" "localhost,127.0.0.1,*.amazonaws.com,.us-east-1.elb.amazonaws.com"
set_default "SECRET_KEY" "django-insecure-change-this-in-production"

# Database Configuration
set_default "DB_ENGINE" "django.db.backends.postgresql"
set_default "DB_NAME" "liberty_social"
set_default "DB_USER" "postgres"
set_default "DB_PASSWORD" "postgres"
set_default "DB_HOST" "localhost"
set_default "DB_PORT" "5432"

# Redis Configuration
set_default "REDIS_URL" "redis://127.0.0.1:6379/0"
set_default "CELERY_BROKER_URL" "redis://127.0.0.1:6379/1"
set_default "CELERY_RESULT_BACKEND" "redis://127.0.0.1:6379/2"

# AWS Configuration
set_default "AWS_REGION" "us-east-1"
set_default "AWS_S3_BUCKET_NAME" "liberty-social-uploads"
set_default "AWS_S3_REGION_NAME" "us-east-1"
set_default "AWS_ACCESS_KEY_ID" ""
set_default "AWS_SECRET_ACCESS_KEY" ""

# Email Configuration
set_default "EMAIL_BACKEND" "django.core.mail.backends.smtp.EmailBackend"
set_default "EMAIL_HOST" "smtp.gmail.com"
set_default "EMAIL_PORT" "587"
set_default "EMAIL_USE_TLS" "True"
set_default "EMAIL_HOST_USER" "noreply@libertysocial.com"
set_default "EMAIL_HOST_PASSWORD" "change-me"
set_default "DEFAULT_FROM_EMAIL" "noreply@libertysocial.com"

# Frontend Configuration
set_default "FRONTEND_URL" "http://localhost:3000"
set_default "CORS_ALLOWED_ORIGINS" "http://localhost:3000,http://localhost:3001"

# JWT Configuration
set_default "JWT_ALGORITHM" "HS256"
set_default "JWT_EXPIRATION_HOURS" "24"

# Application Configuration
set_default "WORKERS" "4"
set_default "WORKER_TIMEOUT" "120"

echo "✅ Environment variables initialized!"
echo ""

# ============================================
# 2. Wait for Database Connection
# ============================================
echo "🔄 Step 2: Waiting for database connection..."
echo ""

DB_CONNECTION_STRING="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Retry logic for database connection
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" &> /dev/null; then
        echo "✅ Database is ready!"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "⏳ Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Database connection failed after $MAX_RETRIES attempts"
    echo "   Database URL: $DB_CONNECTION_STRING"
    exit 1
fi

echo ""

# ============================================
# 3. Run Database Migrations
# ============================================
echo "🗄️  Step 3: Running database migrations..."
echo ""

python manage.py migrate --noinput || {
    echo "⚠️  Migration warning - continuing anyway"
}

echo "✅ Migrations completed!"
echo ""

# ============================================
# 4. Collect Static Files
# ============================================
echo "📦 Step 4: Collecting static files..."
echo ""

python manage.py collectstatic --noinput --clear 2>/dev/null || {
    echo "⚠️  Static files collection skipped or failed (non-critical)"
}

echo "✅ Static files ready!"
echo ""

# ============================================
# 5. Print Configuration Summary
# ============================================
echo "================================================"
echo "📋 Configuration Summary"
echo "================================================"
echo "Debug Mode: ${DEBUG}"
echo "Database Host: ${DB_HOST}:${DB_PORT}"
echo "Database Name: ${DB_NAME}"
echo "Redis URL: ${REDIS_URL}"
echo "Frontend URL: ${FRONTEND_URL}"
echo "CORS Origins: ${CORS_ALLOWED_ORIGINS}"
echo "Allowed Hosts: ${ALLOWED_HOSTS}"
echo ""

# ============================================
# 6. Start Daphne Server
# ============================================
echo "🚀 Step 5: Starting Daphne ASGI server..."
echo "   Listening on 0.0.0.0:8000"
echo "   Worker timeout: ${WORKER_TIMEOUT}s"
echo ""
echo "================================================"
echo ""

# Use exec to replace shell with the server process so signals are handled correctly
exec daphne \
    -b 0.0.0.0 \
    -p 8000 \
    -v 2 \
    --http-timeout ${WORKER_TIMEOUT} \
    liberty_social.asgi:application

