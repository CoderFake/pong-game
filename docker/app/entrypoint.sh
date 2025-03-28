#!/bin/sh

echo "Waiting for PostgreSQL..."
while ! nc -z db 5432; do
  sleep 0.1
done
echo "PostgreSQL started"

echo "Applying migrations..."
python manage.py makemigrations
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

if [ "$DJANGO_SUPERUSER_USERNAME" ] && [ "$DJANGO_SUPERUSER_PASSWORD" ] && [ "$DJANGO_SUPERUSER_EMAIL" ]; then
  python manage.py createsuperuser --noinput
fi

exec "$@"