#!/bin/bash
set -e

echo "Collecting static files..."
./venv/bin/python manage.py collectstatic --noinput

echo "Running migrations..."
./venv/bin/python manage.py migrate --noinput

echo "Starting Gunicorn..."
./venv/bin/gunicorn liberty_social.wsgi:application --bind 0.0.0.0:8000 --workers 3
