# Title Extraction Fix for Next.js/SPA Apps

**Date:** November 24, 2025  
**Issue:** Only 3 unique titles found for 20 pages on Linear.app (Next.js app)

---

## Problem

Linear.app is a Next.js app with client-side routing. The initial HTML contains different titles for each page:
- Homepage: "Linear – Plan and build products"
- /plan: "Linear Plan – Set the product direction"
- /build: "Linear Build – Issue tracking & sprint planning"

But the audit was only finding 3 unique titles, suggesting the client-side JavaScript wasn't updating titles before extraction.

---

## Root Cause

1. **Wait Strategy:** Using `waitUntil: 'domcontentloaded'` doesn't wait for client-side JavaScript to complete
2. **Timing:** Only waiting 2000ms wasn't enough for Next.js hydration
3. **Title Updates:** Next.js updates titles after client-side routing, which happens after `domcontentloaded`

---

## Fix Applied

### 1. Changed Wait Strategy
```typescript
// Before:
waitUntil: 'domcontentloaded'

// After:
waitUntil: 'networkidle0'  // Waits for network to be idle (ensures client-side routing completes)
```

### 2. Increased Wait Time
```typescript
// Before:
await page.waitForTimeout(2000)

// After:
await page.waitForTimeout(3000)  // More time for Next.js hydration
```

### 3. Added Title Verification
```typescript
// Wait for title to exist before extraction
await page.waitForFunction(
  () => {
    const title = document.title || document.querySelector('title')?.textContent
    return title && title.trim().length > 0
  },
  { timeout: 5000 }
)
```

---

## Expected Results

After this fix:
- Should extract more unique titles (closer to 20 unique titles for 20 pages)
- Titles should match what's in the initial HTML
- Client-side routing should complete before title extraction

---

## Testing

Running test audit to verify the fix works.

---

*Fix committed and ready for testing.*

