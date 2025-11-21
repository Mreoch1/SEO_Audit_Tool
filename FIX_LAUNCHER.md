# Fix Launcher Icon Issue

If your launcher icon isn't starting the app correctly, try these fixes:

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

The launcher script:
- ✅ Checks if server is already running
- ✅ Installs dependencies if needed
- ✅ Sets up database if needed
- ✅ Starts the development server
- ✅ Opens browser automatically
- ✅ Keeps terminal window open

## Troubleshooting

**If the script closes immediately:**
- The script might be encountering an error
- Try running it directly in Terminal to see the error message

**If nothing happens when you double-click:**
- macOS might not recognize `.command` files
- Use Quick Fix 1 above to set Terminal as default

**If you see "Permission denied":**
- Run: `chmod +x "Launch SEO Audit App.command"`

## Still Not Working?

Try running the app directly:
```bash
cd /Users/michaelreoch/seo-audit-app
npm run dev
```

Then open `http://localhost:3000` in your browser.

