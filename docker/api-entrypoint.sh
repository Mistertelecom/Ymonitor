#!/bin/sh
# 🚀 Y Monitor API Entrypoint Script

set -e

echo "🚀 Starting Y Monitor API..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
until npx prisma db push --preview-feature 2>/dev/null; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "✅ Database is ready!"

# Run database migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client (in case it's not already generated)
echo "🔧 Generating Prisma client..."
npx prisma generate

# Seed database if needed (only in development)
if [ "$NODE_ENV" = "development" ]; then
  echo "🌱 Seeding development database..."
  npx prisma db seed 2>/dev/null || echo "No seed script found or seeding failed"
fi

echo "🎯 Starting application server..."

# Start the application
exec node dist/main