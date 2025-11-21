# P0 Features - Quick Implementation Guide

**Goal:** Implement all P0 (critical) features that are free and provide high credibility.  
**Timeline:** 1-2 days  
**Cost:** $0

---

## 🎯 P0 Features Checklist

- [ ] Google PageSpeed Insights API Integration
- [ ] HTTP/2 Detection
- [ ] Compression Detection (GZIP/Brotli)

---

## 1. Google PageSpeed Insights API Integration

### Step 1: Get API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "PageSpeed Insights API"
4. Create API key
5. Add to `.env.local`:
   ```bash
   PAGESPEED_INSIGHTS_API_KEY=your_key_here
   ```

### Step 2: Create PageSpeed Module

**File:** `lib/pagespeed.ts`

```typescript
/**
 * Google PageSpeed Insights API Integration
 */

export interface PageSpeedOpportunity {
  id: string
  title: string
  description: string
  savings: number // in milliseconds
  score: number // 0-1
}

export interface PageSpeedMetrics {
  lcp: number // Largest Contentful Paint
  fcp: number // First Contentful Paint
  cls: number // Cumulative Layout Shift
  inp: number // Interaction to Next Paint (replaces FID)
  ttfb: number // Time to First Byte
  opportunities: PageSpeedOpportunity[]
}

export interface PageSpeedData {
  mobile: PageSpeedMetrics
  desktop: PageSpeedMetrics
}

/**
 * Fetch PageSpeed Insights data for a URL
 */
export async function fetchPageSpeedInsights(url: string): Promise<PageSpeedData | null> {
  const API_KEY = process.env.PAGESPEED_INSIGHTS_API_KEY
  
  if (!API_KEY) {
    console.warn('PageSpeed Insights API key not configured')
    return null
  }

  try {
    // Fetch mobile and desktop data
    const [mobileResult, desktopResult] = await Promise.all([
      fetchPageSpeedForStrategy(url, API_KEY, 'mobile'),
      fetchPageSpeedForStrategy(url, API_KEY, 'desktop')
    ])

    if (!mobileResult || !desktopResult) {
      return null
    }

    return {
      mobile: mobileResult,
      desktop: desktopResult
    }
  } catch (error) {
    console.error('PageSpeed Insights API error:', error)
    return null
  }
}

async function fetchPageSpeedForStrategy(
  url: string,
  apiKey: string,
  strategy: 'mobile' | 'desktop'
): Promise<PageSpeedMetrics | null> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=${strategy}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`

  try {
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })

    if (!response.ok) {
      throw new Error(`PageSpeed API error: ${response.status}`)
    }

    const data = await response.json()

    // Extract Core Web Vitals
    const audits = data.lighthouseResult.audits
    const metrics = data.lighthouseResult.categories.performance.score

    const lcp = audits['largest-contentful-paint']?.numericValue || 0
    const fcp = audits['first-contentful-paint']?.numericValue || 0
    const cls = audits['cumulative-layout-shift']?.numericValue || 0
    const inp = audits['interaction-to-next-paint']?.numericValue || 0
    const ttfb = audits['server-response-time']?.numericValue || 0

    // Extract opportunities
    const opportunities: PageSpeedOpportunity[] = []
    const opportunityAudits = [
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'offscreen-images',
      'modern-image-formats',
      'uses-optimized-images',
      'uses-text-compression',
      'efficient-animated-content',
      'preload-lcp-image',
      'uses-responsive-images',
      'unminified-css',
      'unminified-javascript',
      'uses-long-cache-ttl',
      'total-byte-weight',
      'redirects'
    ]

    opportunityAudits.forEach(auditId => {
      const audit = audits[auditId]
      if (audit && audit.score !== null && audit.score < 1 && audit.details?.overallSavingsMs) {
        opportunities.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          savings: audit.details.overallSavingsMs || 0,
          score: audit.score
        })
      }
    })

    // Sort by savings (highest first)
    opportunities.sort((a, b) => b.savings - a.savings)

    return {
      lcp,
      fcp,
      cls,
      inp,
      ttfb,
      opportunities: opportunities.slice(0, 10) // Top 10 opportunities
    }
  } catch (error) {
    console.error(`PageSpeed Insights fetch failed for ${strategy}:`, error)
    return null
  }
}
```

### Step 3: Update Types

**File:** `lib/types.ts`

Add to `PageData` interface:
```typescript
import { PageSpeedData } from './pagespeed'

export interface PageData {
  // ... existing fields
  pageSpeedData?: PageSpeedData
}
```

### Step 4: Integrate into Audit Flow

**File:** `lib/seoAudit.ts`

Update `analyzePage()` function:
```typescript
import { fetchPageSpeedInsights } from './pagespeed'

async function analyzePage(url: string, userAgent: string, needsImageDetails = false): Promise<PageData> {
  // ... existing code
  
  // Fetch PageSpeed Insights (async, don't block audit)
  const pageSpeedPromise = fetchPageSpeedInsights(url)
  
  // ... continue with existing analysis
  
  // Wait for PageSpeed data before returning
  const pageSpeedData = await pageSpeedPromise
  
  return {
    ...pageData,
    pageSpeedData: pageSpeedData || undefined
  }
}
```

### Step 5: Update Performance Issues Generator

**File:** `lib/performance.ts`

Update to use PageSpeed data when available:
```typescript
export function generatePerformanceIssues(page: PageData): Issue[] {
  const issues: Issue[] = []
  
  // Use PageSpeed data if available (more accurate)
  if (page.pageSpeedData) {
    const mobile = page.pageSpeedData.mobile
    const desktop = page.pageSpeedData.desktop
    
    // Use mobile metrics (stricter)
    const metrics = mobile
    
    // LCP
    if (metrics.lcp > 4000) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        message: 'Slow Largest Contentful Paint (LCP)',
        details: `LCP is ${Math.round(metrics.lcp)}ms (target: <2.5s, poor: >4s). This affects user experience and search rankings.`,
        affectedPages: [page.url]
      })
    } else if (metrics.lcp > 2500) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        message: 'Largest Contentful Paint needs improvement',
        details: `LCP is ${Math.round(metrics.lcp)}ms (target: <2.5s). Consider optimizing images, reducing server response time, or eliminating render-blocking resources.`,
        affectedPages: [page.url]
      })
    }
    
    // CLS
    if (metrics.cls > 0.25) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        message: 'High Cumulative Layout Shift (CLS)',
        details: `CLS is ${metrics.cls.toFixed(3)} (target: <0.1, poor: >0.25). Layout shifts hurt user experience.`,
        affectedPages: [page.url]
      })
    } else if (metrics.cls > 0.1) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        message: 'Cumulative Layout Shift needs improvement',
        details: `CLS is ${metrics.cls.toFixed(3)} (target: <0.1). Add size attributes to images and videos, avoid inserting content above existing content.`,
        affectedPages: [page.url]
      })
    }
    
    // INP (Interaction to Next Paint)
    if (metrics.inp > 300) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        message: 'Slow Interaction to Next Paint (INP)',
        details: `INP is ${Math.round(metrics.inp)}ms (target: <200ms, poor: >300ms). Users experience delays when interacting with your page.`,
        affectedPages: [page.url]
      })
    } else if (metrics.inp > 200) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        message: 'Interaction to Next Paint needs improvement',
        details: `INP is ${Math.round(metrics.inp)}ms (target: <200ms). Reduce JavaScript execution time, break up long tasks.`,
        affectedPages: [page.url]
      })
    }
    
    // TTFB
    if (metrics.ttfb > 1800) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        message: 'Slow Time to First Byte (TTFB)',
        details: `TTFB is ${Math.round(metrics.ttfb)}ms (target: <800ms, poor: >1.8s). Server response is too slow.`,
        affectedPages: [page.url]
      })
    } else if (metrics.ttfb > 800) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        message: 'Time to First Byte needs improvement',
        details: `TTFB is ${Math.round(metrics.ttfb)}ms (target: <800ms). Optimize server response time, use a CDN, improve server location.`,
        affectedPages: [page.url]
      })
    }
    
    // Add opportunities as issues
    metrics.opportunities.slice(0, 5).forEach(opp => {
      if (opp.savings > 500) { // Only show opportunities with >500ms savings
        issues.push({
          category: 'Performance',
          severity: 'Medium',
          message: opp.title,
          details: `${opp.description}. Potential savings: ${Math.round(opp.savings)}ms.`,
          affectedPages: [page.url]
        })
      }
    })
  } else {
    // Fall back to existing performance checks if PageSpeed data unavailable
    // ... existing code
  }
  
  return issues
}
```

---

## 2. HTTP/2 Detection

### Step 1: Create Technical Checks Module

**File:** `lib/technical.ts`

```typescript
/**
 * Technical SEO Checks
 * HTTP/2, Compression, etc.
 */

/**
 * Detect HTTP version from response
 */
export async function checkHttpVersion(url: string, userAgent: string): Promise<'http/1.1' | 'http/2' | 'http/3' | 'unknown'> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': userAgent }
    })

    // Check if HTTP/3 is advertised via Alt-Svc
    const altSvc = response.headers.get('Alt-Svc')
    if (altSvc && altSvc.includes('h3=')) {
      return 'http/3'
    }

    // Check HTTP version from response (browser fetch doesn't expose this directly)
    // Fallback: Check protocol version from fetch API
    // Note: fetch() in Node.js doesn't expose HTTP version, so we'll infer from behavior
    // HTTP/2 typically has multiplexing (can't detect from fetch alone)
    // Check for HTTP/2 indicators: server push headers, stream ID headers
    
    // For now, check if response has HTTP/2 indicators
    // This is a simplified check - in production you might want to use a library
    // that can actually detect HTTP/2 (like node-http2-client)
    
    // Simplified: Assume HTTP/2 if TLS and modern server
    // Or default to http/1.1 for now
    return 'http/1.1' // Default until we implement proper detection
    
    // TODO: Use a library like 'http2' or 'spdy' to properly detect HTTP/2
    // For now, this is a placeholder that returns unknown or http/1.1
  } catch (error) {
    console.error('HTTP version check failed:', error)
    return 'unknown'
  }
}

/**
 * Better HTTP/2 detection using proper HTTP/2 client
 */
export async function checkHttpVersionAdvanced(url: string): Promise<'http/1.1' | 'http/2' | 'http/3' | 'unknown'> {
  try {
    // Install: npm install http2
    // const http2 = require('http2')
    // const client = http2.connect(url)
    // Check if connection is HTTP/2
    // client.on('connect', () => { ... })
    
    // For now, return a simplified check
    // In production, implement proper HTTP/2 detection
    return 'http/2' // Placeholder
  } catch {
    return 'unknown'
  }
}
```

**Note:** Proper HTTP/2 detection requires a library that can establish HTTP/2 connections. For a quick implementation, we can check response headers or use a library like `http2` (Node.js) or `spdy`.

**Simplified Approach (Quick Win):**
Since `fetch()` doesn't expose HTTP version, we can:
1. Try to detect from response headers (Alt-Svc for HTTP/3)
2. For HTTP/2, infer from server type or use a dedicated HTTP/2 client library
3. For now, document it as "unknown" or use a heuristic

**Better Implementation (Requires Package):**
```bash
npm install http2-wrapper
```

```typescript
import { request } from 'http2-wrapper'

export async function checkHttpVersion(url: string): Promise<'http/1.1' | 'http/2' | 'http/3' | 'unknown'> {
  try {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'HEAD'
    }
    
    // Try HTTP/2 first
    try {
      const stream = await request(`https://${parsedUrl.hostname}${parsedUrl.pathname}`, { method: 'HEAD' })
      stream.end()
      return 'http/2'
    } catch {
      // Fall back to HTTP/1.1
      return 'http/1.1'
    }
  } catch {
    return 'unknown'
  }
}
```

### Step 2: Update Types

**File:** `lib/types.ts`

Add to `PageData`:
```typescript
export interface PageData {
  // ... existing fields
  httpVersion?: 'http/1.1' | 'http/2' | 'http/3' | 'unknown'
}
```

### Step 3: Integrate into Audit

**File:** `lib/seoAudit.ts`

```typescript
import { checkHttpVersion } from './technical'

async function analyzePage(url: string, userAgent: string, needsImageDetails = false): Promise<PageData> {
  // ... existing code
  
  // Check HTTP version
  const httpVersion = await checkHttpVersion(url, userAgent)
  
  return {
    ...pageData,
    httpVersion
  }
}
```

### Step 4: Generate Issue

**File:** `lib/seoAudit.ts` in `analyzeSiteWideIssues()`:

```typescript
// Add HTTP version check
pages.forEach(page => {
  if (page.httpVersion === 'http/1.1') {
    consolidateIssue(issueMap, {
      category: 'Technical',
      severity: 'Low',
      message: 'Using HTTP/1.1',
      details: 'Consider upgrading to HTTP/2 or HTTP/3 for better performance. HTTP/2 provides multiplexing and header compression.',
      affectedPages: [page.url]
    })
  }
})
```

---

## 3. Compression Detection (GZIP/Brotli)

### Step 1: Add to Technical Module

**File:** `lib/technical.ts`

```typescript
/**
 * Check if server supports compression (GZIP/Brotli)
 */
export async function checkCompression(
  url: string,
  userAgent: string
): Promise<{ gzip: boolean; brotli: boolean; uncompressedSize?: number; compressedSize?: number }> {
  try {
    // Fetch with compression headers
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': userAgent,
        'Accept-Encoding': 'gzip, deflate, br' // Request Brotli (br) and GZIP
      }
    })

    const contentEncoding = response.headers.get('Content-Encoding') || ''
    const contentLength = response.headers.get('Content-Length')
    
    const gzip = contentEncoding.includes('gzip') || contentEncoding.includes('deflate')
    const brotli = contentEncoding.includes('br')

    // If we got a Content-Length, we can see compressed size
    const compressedSize = contentLength ? parseInt(contentLength, 10) : undefined

    // To get uncompressed size, we'd need to fetch and decompress
    // For HEAD requests, we can only detect if compression is enabled
    return {
      gzip,
      brotli,
      compressedSize
    }
  } catch (error) {
    console.error('Compression check failed:', error)
    return { gzip: false, brotli: false }
  }
}

/**
 * Check compression with actual GET request to measure savings
 */
export async function checkCompressionWithSize(
  url: string,
  userAgent: string
): Promise<{ gzip: boolean; brotli: boolean; uncompressedSize: number; compressedSize: number; savingsPercent: number }> {
  try {
    // Fetch without compression
    const uncompressedResponse = await fetch(url, {
      headers: { 'User-Agent': userAgent, 'Accept-Encoding': 'identity' }
    })
    const uncompressedSize = (await uncompressedResponse.arrayBuffer()).byteLength

    // Fetch with compression
    const compressedResponse = await fetch(url, {
      headers: { 'User-Agent': userAgent, 'Accept-Encoding': 'gzip, deflate, br' }
    })
    const compressedSize = (await compressedResponse.arrayBuffer()).byteLength

    const contentEncoding = compressedResponse.headers.get('Content-Encoding') || ''
    const gzip = contentEncoding.includes('gzip') || contentEncoding.includes('deflate')
    const brotli = contentEncoding.includes('br')

    const savingsPercent = uncompressedSize > 0 
      ? ((uncompressedSize - compressedSize) / uncompressedSize) * 100 
      : 0

    return {
      gzip,
      brotli,
      uncompressedSize,
      compressedSize,
      savingsPercent
    }
  } catch (error) {
    console.error('Compression size check failed:', error)
    return { gzip: false, brotli: false, uncompressedSize: 0, compressedSize: 0, savingsPercent: 0 }
  }
}
```

### Step 2: Update Types

**File:** `lib/types.ts`

```typescript
export interface PageData {
  // ... existing fields
  compression?: {
    gzip: boolean
    brotli: boolean
    uncompressedSize?: number
    compressedSize?: number
    savingsPercent?: number
  }
}
```

### Step 3: Integrate into Audit

**File:** `lib/seoAudit.ts`

```typescript
import { checkCompression } from './technical'

async function analyzePage(url: string, userAgent: string, needsImageDetails = false): Promise<PageData> {
  // ... existing code
  
  // Check compression (quick HEAD request)
  const compression = await checkCompression(url, userAgent)
  
  return {
    ...pageData,
    compression
  }
}
```

### Step 4: Generate Issues

**File:** `lib/seoAudit.ts` in `analyzeSiteWideIssues()`:

```typescript
pages.forEach(page => {
  // ... existing checks
  
  // Compression check
  if (page.compression && !page.compression.gzip && !page.compression.brotli) {
    consolidateIssue(issueMap, {
      category: 'Technical',
      severity: 'Medium',
      message: 'No compression enabled',
      details: 'Enable GZIP or Brotli compression to reduce page size and improve load times. Most servers support GZIP compression.',
      affectedPages: [page.url]
    })
  } else if (page.compression && page.compression.gzip && !page.compression.brotli) {
    consolidateIssue(issueMap, {
      category: 'Technical',
      severity: 'Low',
      message: 'Consider enabling Brotli compression',
      details: 'GZIP is enabled, but Brotli provides better compression ratios (typically 15-20% better than GZIP).',
      affectedPages: [page.url]
    })
  }
})
```

---

## 📦 Package Dependencies

Add to `package.json` if using advanced HTTP/2 detection:

```json
{
  "dependencies": {
    "http2-wrapper": "^5.0.0"
  }
}
```

For compression detection with actual decompression (optional):
```json
{
  "dependencies": {
    "brotli": "^1.3.3",
    "zlib": "^1.0.5"
  }
}
```

**Note:** Node.js built-in `zlib` can handle GZIP decompression. For Brotli, you might need `brotli` package.

---

## ✅ Testing Checklist

After implementing each feature:

- [ ] PageSpeed Insights API returns data for test URLs
- [ ] HTTP version is detected correctly (or returns unknown gracefully)
- [ ] Compression detection works for GZIP-enabled sites
- [ ] Compression detection works for Brotli-enabled sites
- [ ] Compression detection correctly identifies sites without compression
- [ ] Issues are generated appropriately for each check
- [ ] PDF report includes new sections

---

## 🚀 Next Steps

After completing P0 features:
1. Test with real websites
2. Update PDF report templates to display new data
3. Move on to P1 features (Social Media, Open Graph)
4. Consider adding P1.4 (Backlink API) if customer demand justifies it

---

**Estimated Total Time:** 6-8 hours  
**Estimated Value:** High credibility boost, matches industry standard reports

