#!/bin/bash

# Quick fix script for launcher issues
# Run this if the launcher isn't working properly

echo "🔧 SEO Audit App - Launcher Fix"
echo "═══════════════════════════════════════════════════════"
echo ""

cd "$(dirname "$0")"

# Check if port 3000 is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 3000 is in use"
    echo ""
    echo "Checking if server is responding..."
    
    if curl -s http://localhost:3000 >/dev/null 2>&1; then
        echo "✅ Server is running and responding"
    else
        echo "⚠️  Server is not responding (may be stuck)"
        echo ""
        read -p "Kill the stuck process? (y/n): " kill_choice
        
        if [ "$kill_choice" = "y" ] || [ "$kill_choice" = "Y" ]; then
            echo "🛑 Killing process on port 3000..."
            lsof -ti:3000 | xargs kill -9 2>/dev/null
            sleep 2
            echo "✅ Port 3000 is now free"
        fi
    fi
else
    echo "✅ Port 3000 is free"
fi

echo ""
echo "🔧 Fixing launcher permissions..."
chmod +x "Launch SEO Audit App.command"
echo "✅ Permissions fixed"

echo ""
echo "📋 Testing launcher..."
echo "   (This will just check the script, not start the server)"
echo ""

# Test if script is readable and executable
if [ -x "Launch SEO Audit App.command" ]; then
    echo "✅ Launcher is executable"
else
    echo "❌ Launcher is not executable"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Fix complete!"
echo ""
echo "You can now:"
echo "  1. Double-click 'Launch SEO Audit App.command'"
echo "  2. Or run: ./Launch\\ SEO\\ Audit\\ App.command"
echo ""
read -p "Press Enter to exit..."

