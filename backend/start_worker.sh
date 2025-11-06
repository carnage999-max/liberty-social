#!/bin/bash
set -euo pipefail

echo "Starting health endpoint and Celery worker..."

# Default port that App Runner probes
export PORT="${PORT:-8000}"

# --- tiny health server ---
python - <<'PY' &
import os, threading
from http.server import BaseHTTPRequestHandler, HTTPServer

class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/", "/health", "/_health"):
            self.send_response(200); self.end_headers(); self.wfile.write(b"ok")
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, *args, **kwargs):
        pass

def serve():
    HTTPServer(("", int(os.getenv("PORT", "8000"))), HealthHandler).serve_forever()

threading.Thread(target=serve, daemon=True).start()
PY

# --- run celery ---
exec ./venv/bin/celery -A liberty_social worker \
  --loglevel=info \
  --uid nobody --gid nobody \
  --concurrency="${CELERY_WORKER_CONCURRENCY:-2}" \
  --max-tasks-per-child="${CELERY_MAX_TASKS_PER_CHILD:-500}" \
  --prefetch-multiplier="${CELERY_PREFETCH_MULTIPLIER:-4}" \
  --without-gossip --without-mingle
