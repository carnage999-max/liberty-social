#!/bin/bash
set -euo pipefail

PORT="${PORT:-8000}"
echo "Starting health endpoint on port $PORT and Celery worker..."

# Disable PostgreSQL client certificate requirements for Neon
export PGSSLMODE=require
export PGSSLROOTCERT=""
export PGSSLCERT=""
export PGSSLKEY=""

# Path to Python inside your virtual environment
PYTHON="./venv/bin/python"

# Launch a minimal HTTP health server from the venv Python
$PYTHON - <<'PY' &
import os, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/", "/health", "/_health"):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, *args, **kwargs):  # silence logs
        pass

def run_server():
    port = int(os.getenv("PORT", "8000"))
    server = HTTPServer(("", port), HealthHandler)
    print(f"Health server listening on port {port}", flush=True)
    server.serve_forever()

threading.Thread(target=run_server, daemon=True).start()
time.sleep(2)  # ensure listener is ready before Celery starts
PY

# Start Celery (still from venv)
# Note: Removed --uid nobody --gid nobody to avoid PostgreSQL certificate permission issues
exec ./venv/bin/celery -A liberty_social worker \
  --loglevel=info \
  --concurrency="${CELERY_WORKER_CONCURRENCY:-2}" \
  --max-tasks-per-child="${CELERY_MAX_TASKS_PER_CHILD:-500}" \
  --prefetch-multiplier="${CELERY_PREFETCH_MULTIPLIER:-4}" \
  --without-gossip --without-mingle
