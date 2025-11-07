#!/bin/bash
set -euo pipefail

echo "Starting health endpoint on port ${PORT:-8000} and Celery worker..."

PORT="${PORT:-8000}"

# Launch tiny HTTP server first and give it a second to bind
python - <<'PY' &
import os, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/", "/health", "/_health"):
            self.send_response(200); self.end_headers();g self.wfile.write(b"ok")
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, *args, **kwargs): pass

def run_server():
    server = HTTPServer(("", int(os.getenv("PORT", "8000"))), HealthHandler)
    print(f"Health server listening on port {server.server_port}")
    server.serve_forever()

thread = threading.Thread(target=run_server, daemon=True)
thread.start()
time.sleep(2)  # give it time to bind
PY

# Start Celery from the venv
exec ./venv/bin/celery -A liberty_social worker \
  --loglevel=info \
  --uid nobody --gid nobody \
  --concurrency="${CELERY_WORKER_CONCURRENCY:-2}" \
  --max-tasks-per-child="${CELERY_MAX_TASKS_PER_CHILD:-500}" \
  --prefetch-multiplier="${CELERY_PREFETCH_MULTIPLIER:-4}" \
  --without-gossip --without-mingle
