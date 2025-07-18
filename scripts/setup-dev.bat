@echo off
REM Y Monitor Development Setup Script for Windows

echo 🚀 Starting Y Monitor development setup...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Copy environment files
echo ⚙️  Setting up environment files...
if not exist "apps\api\.env" (
    copy "apps\api\.env.example" "apps\api\.env"
    echo 📝 Created apps\api\.env from example
)

if not exist "apps\web\.env.local" (
    copy "apps\web\.env.example" "apps\web\.env.local"
    echo 📝 Created apps\web\.env.local from example
)

if not exist ".env" (
    copy ".env.example" ".env"
    echo 📝 Created .env from example
)

REM Start database services
echo 🐳 Starting database services with Docker...
npm run docker:dev

REM Wait for databases to be ready
echo ⏳ Waiting for databases to be ready...
timeout /t 30 /nobreak >nul

REM Generate Prisma client
echo 🔧 Generating Prisma client...
cd apps\api
npm run db:generate

REM Run database migrations
echo 📊 Running database migrations...
npm run db:migrate

cd ..\..

echo ✅ Development environment setup completed!
echo.
echo 🎉 Next steps:
echo 1. Review and update environment variables in:
echo    - apps\api\.env
echo    - apps\web\.env.local
echo    - .env
echo.
echo 2. Start the development servers:
echo    npm run dev
echo.
echo 3. Access the applications:
echo    - Web App: http://localhost:3000
echo    - API: http://localhost:3001
echo    - API Docs: http://localhost:3001/api
echo    - Grafana: http://localhost:3030 (admin/admin)
echo    - Prometheus: http://localhost:9090
echo.
echo Happy coding! 🚀
pause