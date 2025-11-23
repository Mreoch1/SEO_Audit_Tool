# Fix Launcher Icon Issue

If your launcher icon isn't starting the app correctly, try these fixes:

## 🚀 Quick Fix 0: Run the Fix Script (Easiest)

Double-click `fix-launcher.sh` or run:
```bash
cd /Users/michaelreoch/seo-audit-app
./fix-launcher.sh
```

This will:
- Check if port 3000 is stuck
- Fix launcher permissions
- Test the launcher script
- Offer to kill stuck processes

## Quick Fix 1: Set Terminal as Default for .command Files

1. **Right-click** on `Launch SEO Audit App.command`
2. Select **"Get Info"** (or press `Cmd+I`)
3. Under **"Open with:"**, select **Terminal**
4. Click **"Change All..."** to set Terminal as default for all `.command` files
5. Close the Get Info window

## Quick Fix 2: Re-register the File Type

Run this in Terminal:
```bash
cd /Users/michaelreoch/seo-audit-app
chmod +x "Launch SEO Audit App.command"
```

## Quick Fix 3: Test the Script Directly

Run this in Terminal to test:
```bash
cd /Users/michaelreoch/seo-audit-app
./Launch\ SEO\ Audit\ App.command
```

If this works, the issue is with macOS file associations, not the script itself.

## Quick Fix 4: Create an AppleScript Launcher (Alternative)

If the `.command` file still doesn't work, you can create an AppleScript app instead:

1. Open **Script Editor** (Applications > Utilities)
2. Paste this code:
```applescript
tell application "Terminal"
    activate
    do script "cd '/Users/michaelreoch/seo-audit-app' && './Launch SEO Audit App.command'"
end tell
```
3. Save as **"SEO Audit App.app"** (File Format: Application)
4. Move to Applications folder or Desktop
5. Double-click to launch

## What the Script Does

The improved launcher script now:
- ✅ Checks if server is already running AND responding
- ✅ Detects stuck processes and offers to kill them
- ✅ Verifies npm is installed before proceeding
- ✅ Installs dependencies if needed (with progress feedback)
- ✅ Sets up database if needed (with error handling)
- ✅ Starts the development server with error capture
- ✅ Opens browser automatically after 10 seconds
- ✅ Keeps terminal window open on errors
- ✅ Provides clear error messages and troubleshooting tips

## Troubleshooting

**If the script closes immediately:**
- The script might be encountering an error
- Try running it directly in Terminal to see the error message
- Check if there's a stuck process: `lsof -i :3000`

**If nothing happens when you double-click:**
- macOS might not recognize `.command` files
- Use Quick Fix 1 above to set Terminal as default
- Try the AppleScript launcher (Quick Fix 4)

**If you see "Permission denied":**
- Run: `chmod +x "Launch SEO Audit App.command"`
- Or run: `./fix-launcher.sh`

**If port 3000 is stuck:**
- The launcher will now detect this and offer to kill the stuck process
- Or manually run: `lsof -ti:3000 | xargs kill -9`

**If server starts but browser doesn't open:**
- Wait a few seconds - browser opens after 10 seconds
- Manually open: `http://localhost:3000`

## Still Not Working?

Try running the app directly:
```bash
cd /Users/michaelreoch/seo-audit-app
npm run dev
```

Then open `http://localhost:3000` in your browser.

