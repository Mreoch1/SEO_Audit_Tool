#!/bin/bash

# SEO Audit App - Server Launcher
# Double-click this file to start the development server

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the app directory
cd "$SCRIPT_DIR" || {
    echo "❌ Error: Could not change to directory: $SCRIPT_DIR"
    echo ""
    echo "Press Enter to exit..."
    read -r
    exit 1
}

# Keep terminal window open and visible
clear
echo "═══════════════════════════════════════════════════════"
echo "  🚀 SEO Audit App - Starting Server"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📁 Directory: $(pwd)"
echo ""

# Function to check if server is actually responding
# More robust check - verifies HTTP response code
check_server_health() {
    # Try to get HTTP response code
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
    # Server is healthy if we get a valid HTTP response (2xx, 3xx, or even 4xx/5xx means server is responding)
    if [ -n "$http_code" ] && [ "$http_code" != "000" ] && [ "$http_code" != "" ]; then
        return 0
    else
        return 1
    fi
}

# Check if port 3000 is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 3000 is in use!"
    echo ""
    
    # Check if it's actually our Next.js server and responding
    echo "🔍 Checking if server is responding..."
    if check_server_health; then
        echo "✅ Next.js server is running and responding!"
        echo "🌐 Opening http://localhost:3000"
        open http://localhost:3000
        echo ""
        echo "Server is already running. You can close this window."
        echo ""
        echo "Press Enter to exit..."
        read -r
        exit 0
    else
        echo "⚠️  Port 3000 is in use, but the server is NOT responding."
        echo "   This usually means the previous server process is stuck."
        echo ""
        echo "🛑 Automatically killing stuck process and starting fresh..."
        echo ""
        
        # Kill the stuck process
        lsof -ti:3000 | xargs kill -9 2>/dev/null
        sleep 2
        
        # Verify port is free
        if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "⚠️  Process still running, trying again..."
            sleep 1
            lsof -ti:3000 | xargs kill -9 2>/dev/null
            sleep 1
        fi
        
        if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "❌ Could not free port 3000. Please close the application using it manually."
            echo ""
            echo "You can try: lsof -ti:3000 | xargs kill -9"
            echo ""
            echo "Press Enter to exit..."
            read -r
            exit 1
        else
            echo "✅ Port 3000 is now free"
            echo "   Continuing with server startup..."
            echo ""
        fi
    fi
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed or not in PATH"
    echo "   Please install Node.js from https://nodejs.org/"
    echo ""
    echo "Press Enter to exit..."
    read -r
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    echo "   This may take a few minutes..."
    if ! npm install; then
        echo ""
        echo "❌ Error: Failed to install dependencies"
        echo "   Please check your internet connection and try again"
        echo ""
        echo "Press Enter to exit..."
        read -r
        exit 1
    fi
    echo "✅ Dependencies installed successfully"
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found!"
    echo "📝 Please create a .env file with required variables."
    echo "   See LOCAL_SETUP.md for details."
    echo ""
    echo "The app may still work, but some features might be limited."
    read -p "Press Enter to continue anyway, or Ctrl+C to exit..."
    echo ""
fi

# Check if database exists
if [ ! -f "prisma/dev.db" ]; then
    echo "📊 Setting up database..."
    echo "   Generating Prisma client..."
    if ! npm run db:generate; then
        echo ""
        echo "❌ Error: Failed to generate database"
        echo "   Please check your Prisma configuration"
        echo ""
        echo "Press Enter to exit..."
        read -r
        exit 1
    fi
    echo "   Running database migrations..."
    if ! npm run db:migrate; then
        echo ""
        echo "❌ Error: Failed to migrate database"
        echo "   Please check your database configuration"
        echo ""
        echo "Press Enter to exit..."
        read -r
        exit 1
    fi
    echo "✅ Database setup complete"
    echo ""
fi

echo "✅ Starting development server..."
echo "🌐 Server will be available at: http://localhost:3000"
echo "⏹️  Press Ctrl+C to stop the server"
echo ""
echo "═══════════════════════════════════════════════════════"
echo ""

# Open browser after server starts (in background)
# Wait for server to actually be ready before opening browser
(sleep 3 && (
    # Wait up to 30 seconds for server to be ready
    for i in {1..30}; do
        if check_server_health; then
            echo ""
            echo "🌐 Server is ready! Opening browser..."
            open http://localhost:3000
            break
        fi
        sleep 1
    done
)) &

# Start the development server (this keeps terminal open)
# Capture any errors
if ! npm run dev; then
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  ❌ Server failed to start"
    echo "═══════════════════════════════════════════════════════"
    echo ""
    echo "Common issues:"
    echo "  • Port 3000 might be in use by another application"
    echo "  • Dependencies might not be installed correctly"
    echo "  • Database might need to be reset"
    echo ""
    echo "Try running: npm run dev"
    echo ""
    read -r -p "Press Enter to close this window..."
    exit 1
fi

# Keep window open if server stops
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Server stopped"
echo "═══════════════════════════════════════════════════════"
echo ""
read -r -p "Press Enter to close this window..."
