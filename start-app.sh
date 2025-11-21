    #!/bin/bash

# SEO Audit App Startup Script
# Double-click this file or run: ./start-app.sh

cd "$(dirname "$0")"

echo "🚀 Starting SEO Audit App..."
echo "📁 Working directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Please create a .env file with required variables."
    echo "   See RUN_INDEPENDENTLY.md for details."
    echo ""
    read -p "Press Enter to continue anyway, or Ctrl+C to exit..."
    echo ""
fi

# Check if database exists
if [ ! -f "prisma/dev.db" ]; then
    echo "📊 Setting up database..."
    npm run db:generate
    npm run db:migrate
    echo ""
fi

echo "✅ Starting development server..."
echo "🌐 App will be available at: http://localhost:3000"
echo "⏹️  Press Ctrl+C to stop the server"
echo ""

npm run dev

