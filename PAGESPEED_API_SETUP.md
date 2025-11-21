# Google PageSpeed Insights API Setup Guide

**Quick Setup:** Get your free API key in 5 minutes to enable Core Web Vitals analysis.

---

## 🚀 Step-by-Step Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click the project dropdown at the top
4. Click **"New Project"**
5. Enter project name: `SEO Audit App` (or any name)
6. Click **"Create"**

### Step 2: Enable PageSpeed Insights API

1. In your new project, go to **"APIs & Services"** → **"Library"**
2. Search for: `PageSpeed Insights API`
3. Click on **"PageSpeed Insights API"**
4. Click **"Enable"**
5. Wait for API to enable (takes ~10 seconds)

### Step 3: Create API Key

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"API Key"**
3. A popup will show your API key (looks like: `AIzaSyB...`)
4. **Copy this key** (you'll need it in a moment)

### Step 4: (Optional) Restrict API Key

**Important:** Restrict your API key to prevent unauthorized usage.

1. In the API key popup, click **"Restrict Key"**
2. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Check only **"PageSpeed Insights API"**
   - Click **"Save"**
3. Under **"Application restrictions"** (optional):
   - Select **"HTTP referrers"** for web apps
   - Or **"IP addresses"** for server-only usage
   - Click **"Save"**

### Step 5: Add API Key to Your Project

1. In your project root, check if `.env.local` exists:
   ```bash
   ls -la .env.local
   ```

2. If it doesn't exist, create it:
   ```bash
   touch .env.local
   ```

3. Open `.env.local` and add your API key:
   ```bash
   # Google PageSpeed Insights API
   PAGESPEED_INSIGHTS_API_KEY=AIzaSyB...your-key-here
   ```

4. **Important:** Make sure `.env.local` is in `.gitignore` (it should be by default)

---

## ✅ Verify Setup

### Test 1: Check Environment Variable

```bash
# In your terminal, verify the variable is set
grep PAGESPEED_INSIGHTS_API_KEY .env.local
```

You should see:
```
PAGESPEED_INSIGHTS_API_KEY=AIzaSyB...
```

### Test 2: Test API Key Works

Run a quick test to verify the API key works:

```bash
# Replace YOUR_API_KEY with your actual key
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&key=YOUR_API_KEY"
```

If you get JSON back (not an error), your API key is working! 🎉

### Test 3: Run an Audit

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Run a test audit:
   ```bash
   npm run audit -- https://example.com
   ```

3. Check the audit results - you should see `pageSpeedData` with mobile and desktop metrics

---

## 📊 API Limits

**Free Tier:**
- **25,000 requests per day** (plenty for most use cases)
- No credit card required
- No cost up to 25k/day

**What Counts as a Request:**
- Each page analyzed = 2 requests (mobile + desktop)
- Example: 10-page audit = 20 API calls
- With 25k/day limit, you can run **1,250 multi-page audits per day**

---

## 🔒 Security Best Practices

1. **Never commit `.env.local` to git** ✅ (should be in `.gitignore`)
2. **Restrict API key** to only PageSpeed Insights API
3. **Monitor usage** in Google Cloud Console → APIs & Services → Dashboard
4. **Set up billing alerts** if you exceed free tier (unlikely but good practice)

---

## 🐛 Troubleshooting

### Error: "API key not valid"
- **Solution:** Double-check the key is copied correctly (no spaces, no line breaks)
- **Solution:** Make sure PageSpeed Insights API is enabled in your project

### Error: "API key not configured"
- **Solution:** Make sure `.env.local` exists and has `PAGESPEED_INSIGHTS_API_KEY=...`
- **Solution:** Restart your dev server after adding the key (`Ctrl+C` then `npm run dev`)

### Error: "Quota exceeded"
- **Solution:** You've hit the 25k/day limit. Wait 24 hours or create a new project
- **Solution:** Check usage in Google Cloud Console → APIs & Services → Dashboard

### PageSpeed data not appearing
- **Solution:** Check browser console for errors
- **Solution:** Verify API key is set: `console.log(process.env.PAGESPEED_INSIGHTS_API_KEY)`
- **Solution:** Check network tab for API requests (should see `pagespeedonline.googleapis.com`)

---

## 🎯 Next Steps

Once your API key is set up:

1. ✅ **Test it:** Run a full audit on a real website
2. ✅ **Check results:** Verify PageSpeed data appears in audit results
3. ✅ **Update PDF templates:** Display Core Web Vitals in PDF reports (when ready)

---

## 💡 Pro Tips

- **Use the same key for all environments** (dev, staging, production)
- **Monitor your usage** in Google Cloud Console to stay under limits
- **The API is free** for reasonable usage (25k/day is generous)
- **PageSpeed checks run only for the main page** (to save API calls)

---

**Need Help?**
- [Google Cloud Console](https://console.cloud.google.com/)
- [PageSpeed Insights API Docs](https://developers.google.com/speed/docs/insights/v5/get-started)
- Check `lib/pagespeed.ts` for implementation details

