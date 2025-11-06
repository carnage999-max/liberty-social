#!/bin/bash
set -e

echo "Starting celery worker..."
./venv/bin/celery -A liberty_social worker --loglevel=info
