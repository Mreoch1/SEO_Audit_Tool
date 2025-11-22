# Fix Puppeteer Browser Installation

The `Protocol error (Target.setDiscoverTargets): Target closed` error means Puppeteer's Chrome binary is missing or corrupted.

## Quick Fix

Run these commands in your terminal (stop the server first with Ctrl+C):

```bash
cd /Users/michaelreoch/seo-audit-app

# Remove existing Puppeteer and Chrome cache
rm -rf node_modules/puppeteer*
rm -rf ~/.cache/puppeteer

# Reinstall Puppeteer (this will download Chrome)
npm install puppeteer

# Verify Chrome was installed
npx puppeteer browsers list
```

Expected output:
```
chrome@121.0.6167.85 /Users/michaelreoch/.cache/puppeteer/chrome/mac_arm-121.0.6167.85
```

## Alternative: Use System Chrome

If the above doesn't work, you can tell Puppeteer to use your system's installed Chrome:

```bash
# Find your Chrome path
which google-chrome-stable
# or
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --version
```

Then update `.env` file:
```
PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

## Test Puppeteer

After reinstalling, test it works:

```bash
node -e "const puppeteer = require('puppeteer'); (async () => { const browser = await puppeteer.launch({ headless: 'new', pipe: true }); console.log('✅ Browser launched:', browser.isConnected()); await browser.close(); console.log('✅ Browser closed successfully'); })()"
```

If this prints `✅ Browser launched: true` and `✅ Browser closed successfully`, Puppeteer is working.

## Then Restart

```bash
npm run dev
```

Your audits and PDF generation should now work without errors.

