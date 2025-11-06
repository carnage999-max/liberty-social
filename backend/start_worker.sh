#!/bin/bash
set -euo pipefail

echo "Starting celery worker..."

CELERY_CMD="./venv/bin/celery"

# Ensure the venv binary is executable by non-root (usually already 755)
chmod +x ./venv/bin/celery || true

# Celery sometimes writes temp files; make sure we use a writable dir
export TMPDIR=/tmp

# Optional: keep pid/logs in /tmp (writeable by 'nobody'); remove if you don't want files
PIDFILE=/tmp/celery-worker.pid
LOGFILE=/tmp/celery-worker.log

# Run as non-root (user 'nobody' exists in the App Runner Python image)
exec "$CELERY_CMD" -A liberty_social worker \
  --loglevel=info \
  --uid nobody --gid nobody \
  --concurrency="${CELERY_WORKER_CONCURRENCY:-2}" \
  --max-tasks-per-child=500 \
  --prefetch-multiplier=4 \
  --without-gossip --without-mingle \
  --pidfile="$PIDFILE" \
  --logfile="$LOGFILE"
