#!/bin/bash

# Script to create a proper macOS app launcher

echo "🎨 Creating SEO Audit App Launcher..."
echo ""

# Create the app bundle structure
APP_NAME="SEO Audit App.app"
APP_PATH="$HOME/Desktop/$APP_NAME"
CONTENTS_PATH="$APP_PATH/Contents"
MACOS_PATH="$CONTENTS_PATH/MacOS"
RESOURCES_PATH="$CONTENTS_PATH/Resources"

# Remove existing app if it exists
if [ -d "$APP_PATH" ]; then
    echo "⚠️  Removing existing app..."
    rm -rf "$APP_PATH"
fi

# Create directory structure
mkdir -p "$MACOS_PATH"
mkdir -p "$RESOURCES_PATH"

# Create Info.plist
cat > "$CONTENTS_PATH/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>seo-audit-app</string>
    <key>CFBundleIdentifier</key>
    <string>com.seoauditapp.launcher</string>
    <key>CFBundleName</key>
    <string>SEO Audit App</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
</dict>
</plist>
EOF

# Create the executable script
cat > "$MACOS_PATH/seo-audit-app" << 'SCRIPT'
#!/bin/bash

cd /Users/michaelreoch/seo-audit-app

# Check if already running
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    osascript -e 'display notification "Server is already running at http://localhost:3000" with title "SEO Audit App"'
    open http://localhost:3000
    exit 0
fi

# Show notification
osascript -e 'display notification "Starting SEO Audit App server..." with title "SEO Audit App"'

# Open Terminal and start the server
osascript << 'APPLESCRIPT'
tell application "Terminal"
    activate
    set newTab to do script "cd /Users/michaelreoch/seo-audit-app && clear && echo '🚀 Starting SEO Audit App Server...' && echo '📁 Directory: ' && pwd && echo '' && echo '✅ Starting development server...' && echo '🌐 Server will be available at: http://localhost:3000' && echo '⏹️  Press Ctrl+C to stop the server' && echo '' && npm run dev"
end tell
APPLESCRIPT

# Wait for server to start then open browser
sleep 8
open http://localhost:3000
SCRIPT

# Make executable
chmod +x "$MACOS_PATH/seo-audit-app"

# Create a simple icon (using system icon as placeholder)
# User can replace this later
echo "📝 App created at: $APP_PATH"
echo ""
echo "✅ Launcher app created!"
echo ""
echo "📝 Next steps:"
echo "   1. The app is on your Desktop: $APP_NAME"
echo "   2. Double-click it to start the app"
echo "   3. To add a custom icon:"
echo "      - Right-click app → Get Info"
echo "      - Drag an icon image onto the icon in Get Info"
echo "   4. Drag to Dock for one-click access!"
echo ""

