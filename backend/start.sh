#!/bin/bash
set -e

echo "Collecting static files..."
./venv/bin/python manage.py collectstatic --noinput

echo "Running migrations..."
./venv/bin/python manage.py migrate --noinput

echo "Starting Daphne (ASGI)..."
./venv/bin/daphne -b 0.0.0.0 -p 8000 liberty_social.asgi:application
