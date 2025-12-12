#!/bin/sh
set -e

echo "Starting Simple Backup..."

# Load environment variables from Docker secrets if available
if [ -f "/run/secrets/DATABASE_URL" ]; then
  export DATABASE_URL=$(cat /run/secrets/DATABASE_URL)
  echo "Loaded DATABASE_URL from secret"
fi

if [ -f "/run/secrets/JWT_SECRET" ]; then
  export JWT_SECRET=$(cat /run/secrets/JWT_SECRET)
  echo "Loaded JWT_SECRET from secret"
fi

if [ -f "/run/secrets/ENCRYPTION_KEY" ]; then
  export ENCRYPTION_KEY=$(cat /run/secrets/ENCRYPTION_KEY)
  echo "Loaded ENCRYPTION_KEY from secret"
fi

if [ -f "/run/secrets/BACKUP_BASE_PATH" ]; then
  export BACKUP_BASE_PATH=$(cat /run/secrets/BACKUP_BASE_PATH)
  echo "Loaded BACKUP_BASE_PATH from secret"
fi

# Wait for database file to be ready (if using volume)
if [ ! -f "/data/system.db" ]; then
  echo "Database file not found, initializing..."
  mkdir -p /data
fi

# Set default DATABASE_URL if not already set
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/data/system.db"
fi

# Run Prisma migrations
echo "Running Prisma migrations..."
bunx prisma migrate deploy || true

# Generate Prisma Client if needed
echo "Generating Prisma Client..."
bunx prisma generate || true

# Seed database if needed (only in development)
if [ "$NODE_ENV" != "production" ]; then
  echo "Seeding database..."
  bunx prisma db seed || true
fi

echo "Starting application..."
exec "$@"

