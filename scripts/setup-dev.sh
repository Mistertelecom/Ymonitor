#!/bin/bash

# Y Monitor Development Setup Script

set -e

echo "🚀 Starting Y Monitor development setup..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment files
echo "⚙️  Setting up environment files..."
if [ ! -f "apps/api/.env" ]; then
    cp apps/api/.env.example apps/api/.env
    echo "📝 Created apps/api/.env from example"
fi

if [ ! -f "apps/web/.env.local" ]; then
    cp apps/web/.env.example apps/web/.env.local
    echo "📝 Created apps/web/.env.local from example"
fi

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "📝 Created .env from example"
fi

# Start database services
echo "🐳 Starting database services with Docker..."
npm run docker:dev

# Wait for databases to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 30

# Generate Prisma client
echo "🔧 Generating Prisma client..."
cd apps/api
npm run db:generate

# Run database migrations
echo "📊 Running database migrations..."
npm run db:migrate

echo "✅ Development environment setup completed!"
echo ""
echo "🎉 Next steps:"
echo "1. Review and update environment variables in:"
echo "   - apps/api/.env"
echo "   - apps/web/.env.local"
echo "   - .env"
echo ""
echo "2. Start the development servers:"
echo "   npm run dev"
echo ""
echo "3. Access the applications:"
echo "   - Web App: http://localhost:3000"
echo "   - API: http://localhost:3001"
echo "   - API Docs: http://localhost:3001/api"
echo "   - Grafana: http://localhost:3030 (admin/admin)"
echo "   - Prometheus: http://localhost:9090"
echo ""
echo "Happy coding! 🚀"