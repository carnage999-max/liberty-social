#!/bin/bash
set -e

echo "Running migrations..."
./venv/bin/python manage.py migrate --noinput

echo "Starting celery worker..."
./venv/bin/celery -A liberty_social worker --loglevel=info
