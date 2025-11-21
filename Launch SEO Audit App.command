#!/bin/bash

# SEO Audit App - Server Launcher
# Double-click this file to start the development server

# Change to the app directory
cd /Users/michaelreoch/seo-audit-app

# Keep terminal window open and visible
clear
echo "═══════════════════════════════════════════════════════"
echo "  🚀 SEO Audit App - Starting Server"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📁 Directory: $(pwd)"
echo ""

# Check if already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Server is already running on port 3000!"
    echo "🌐 Opening http://localhost:3000"
    open http://localhost:3000
    echo ""
    echo "Press any key to exit..."
    read -n 1
    exit 0
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Please create a .env file with required variables."
    echo "   See LOCAL_SETUP.md for details."
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
echo "🌐 Server will be available at: http://localhost:3000"
echo "⏹️  Press Ctrl+C to stop the server"
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""

# Open browser after server starts (in background)
(sleep 8 && open http://localhost:3000) &

# Start the development server (this keeps terminal open)
npm run dev

# Keep window open if server stops
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Server stopped"
echo "═══════════════════════════════════════════════════════"
echo ""
read -p "Press Enter to close this window..."
