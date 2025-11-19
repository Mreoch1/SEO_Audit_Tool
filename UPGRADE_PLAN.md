# SEO Audit Tool Upgrade Plan

## Current State Analysis

Based on the competitor analysis and code review, here are the critical gaps:

### Critical Issues Identified

1. **No JavaScript Rendering** ❌
   - Current: Regex-based HTML parsing (removes scripts)
   - Problem: Can't detect JS-rendered images, links, or content
   - Impact: `imageCount: 0`, `internalLinkCount: 0` on JS-heavy sites

2. **Fake Performance Metrics** ❌
   - Current: `loadTime = Date.now() - startTime` (just fetch time)
   - Problem: Shows 56ms when real render takes 3-10 seconds
   - Impact: No real performance insights

3. **Broken Image Detection** ❌
   - Current: Regex `<img[^>]*>` only
   - Problem: Misses lazy-loaded, background, picture elements, CSS images
   - Impact: `imageCount: 0` on modern sites

4. **Broken Link Detection** ❌
   - Current: Regex `<a[^>]*href` only
   - Problem: Misses JS-generated links, button navigation
   - Impact: `internalLinkCount: 0`, `externalLinkCount: 0`

5. **Empty Performance Issues** ❌
   - Current: `performanceIssues: []` (placeholder)
   - Problem: No actual Core Web Vitals analysis
   - Impact: Missing critical performance insights

6. **Surface-Level Keyword Extraction** ⚠️
   - Current: Text scraping from title/H1/meta
   - Problem: Not real keyword research
   - Impact: Generic, low-value keywords

7. **Placeholder Competitor Analysis** ❌
   - Current: Generated patterns, not real competitor data
   - Problem: `competitorUrl` is prose, not a URL
   - Impact: No actionable competitor insights

8. **Missing Advanced Schema** ⚠️
   - Current: Basic JSON-LD/microdata detection
   - Problem: No Identity Schema, no validation
   - Impact: Missing E-E-A-T signals

9. **No LLM Readability** ❌
   - Current: Not implemented
   - Problem: Can't measure rendering percentage
   - Impact: Missing modern SEO factor

10. **No Visual Previews** ❌
    - Current: Not implemented
    - Problem: No device rendering, no SERP preview
    - Impact: Less valuable reports

---

## Upgrade Roadmap

### Phase 1: Core Engine Upgrade (Critical - Week 1-2)

#### 1.1 JavaScript Rendering Engine
**Priority: CRITICAL**

**Implementation:**
- Add Puppeteer or Playwright dependency
- Create `lib/renderer.ts` with headless browser rendering
- Modify `analyzePage()` to use browser rendering instead of fetch
- Wait for page load, network idle, and JS execution

**Code Changes:**
```typescript
// lib/renderer.ts (NEW)
import puppeteer from 'puppeteer'

export async function renderPage(url: string): Promise<{
  html: string
  renderedHtml: string
  loadTime: number
  metrics: {
    lcp?: number
    fid?: number
    cls?: number
    tbt?: number
  }
}> {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  
  const startTime = Date.now()
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
  const loadTime = Date.now() - startTime
  
  // Get rendered HTML (after JS execution)
  const renderedHtml = await page.content()
  
  // Get Core Web Vitals
  const metrics = await page.evaluate(() => {
    // Measure LCP, FID, CLS, TBT
    // Return metrics object
  })
  
  await browser.close()
  
  return {
    html: renderedHtml,
    renderedHtml,
    loadTime,
    metrics
  }
}
```

**Update `analyzePage()`:**
```typescript
async function analyzePage(url: string, userAgent: string): Promise<PageData> {
  // Use renderer instead of fetch
  const { html, loadTime, metrics } = await renderPage(url)
  return parseHtml(html, url, 200, loadTime, 'text/html', metrics)
}
```

**Benefits:**
- Detects JS-rendered images and links
- Real performance metrics
- Actual render time (not fetch time)

---

#### 1.2 Enhanced Image Detection
**Priority: HIGH**

**Implementation:**
- Parse rendered DOM for all image sources
- Check `<img>`, `<picture>`, `<source>`, background images, lazy-loaded
- Use browser's `document.images` and computed styles

**Code Changes:**
```typescript
// In parseHtml() or new analyzeImages()
async function analyzeImages(page: Page): Promise<{
  imageCount: number
  missingAltCount: number
  images: Array<{
    src: string
    alt?: string
    isLazy: boolean
    isBackground: boolean
  }>
}> {
  return await page.evaluate(() => {
    const images: any[] = []
    
    // Regular img tags
    document.querySelectorAll('img').forEach(img => {
      images.push({
        src: img.src,
        alt: img.alt || undefined,
        isLazy: img.loading === 'lazy' || img.hasAttribute('data-src'),
        isBackground: false
      })
    })
    
    // Picture elements
    document.querySelectorAll('picture source').forEach(source => {
      if (source.srcset) {
        images.push({
          src: source.srcset,
          alt: undefined,
          isLazy: false,
          isBackground: false
        })
      }
    })
    
    // Background images (CSS)
    document.querySelectorAll('*').forEach(el => {
      const bgImage = window.getComputedStyle(el).backgroundImage
      if (bgImage && bgImage !== 'none') {
        const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/)
        if (match) {
          images.push({
            src: match[1],
            alt: undefined,
            isLazy: false,
            isBackground: true
          })
        }
      }
    })
    
    return {
      imageCount: images.length,
      missingAltCount: images.filter(img => !img.alt).length,
      images
    }
  })
}
```

---

#### 1.3 Enhanced Link Detection
**Priority: HIGH**

**Implementation:**
- Parse all `<a>` tags from rendered DOM
- Check button-based navigation (onclick handlers)
- Detect dynamically created links

**Code Changes:**
```typescript
async function analyzeLinks(page: Page, baseUrl: string): Promise<{
  internalLinkCount: number
  externalLinkCount: number
  links: Array<{ href: string; text: string; isInternal: boolean }>
}> {
  return await page.evaluate((base) => {
    const links: any[] = []
    const baseHost = new URL(base).hostname
    
    // Regular anchor tags
    document.querySelectorAll('a[href]').forEach(a => {
      try {
        const url = new URL(a.href, base)
        links.push({
          href: a.href,
          text: a.textContent?.trim() || '',
          isInternal: url.hostname === baseHost
        })
      } catch {
        // Relative URL - count as internal
        links.push({
          href: a.href,
          text: a.textContent?.trim() || '',
          isInternal: true
        })
      }
    })
    
    // Button-based navigation (onclick with window.location or similar)
    document.querySelectorAll('button, [role="button"]').forEach(btn => {
      const onclick = btn.getAttribute('onclick') || ''
      const match = onclick.match(/(?:window\.location|location\.href)\s*=\s*['"]([^'"]+)['"]/)
      if (match) {
        try {
          const url = new URL(match[1], base)
          links.push({
            href: match[1],
            text: btn.textContent?.trim() || '',
            isInternal: url.hostname === baseHost
          })
        } catch {}
      }
    })
    
    return {
      internalLinkCount: links.filter(l => l.isInternal).length,
      externalLinkCount: links.filter(l => !l.isInternal).length,
      links
    }
  }, baseUrl)
}
```

---

#### 1.4 Real Performance Metrics (Core Web Vitals)
**Priority: CRITICAL**

**Implementation:**
- Measure LCP (Largest Contentful Paint)
- Measure FID (First Input Delay) / INP (Interaction to Next Paint)
- Measure CLS (Cumulative Layout Shift)
- Measure TBT (Total Blocking Time)
- Calculate actual render time

**Code Changes:**
```typescript
// lib/performance.ts (NEW)
export async function measureCoreWebVitals(page: Page): Promise<{
  lcp?: number
  fid?: number
  cls?: number
  tbt?: number
  fcp?: number
  ttfb?: number
}> {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      const metrics: any = {}
      
      // LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as any
        metrics.lcp = lastEntry.renderTime || lastEntry.loadTime
      }).observe({ entryTypes: ['largest-contentful-paint'] })
      
      // CLS
      let clsValue = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        }
        metrics.cls = clsValue
      }).observe({ entryTypes: ['layout-shift'] })
      
      // FID
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          metrics.fid = entry.processingStart - entry.startTime
        }
      }).observe({ entryTypes: ['first-input'] })
      
      // TBT (Total Blocking Time)
      const longTasks: number[] = []
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.duration > 50) {
            longTasks.push(entry.duration - 50)
          }
        }
        metrics.tbt = longTasks.reduce((a, b) => a + b, 0)
      }).observe({ entryTypes: ['longtask'] })
      
      // FCP
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            metrics.fcp = entry.startTime
          }
        }
      }).observe({ entryTypes: ['paint'] })
      
      // TTFB
      const navigation = performance.getEntriesByType('navigation')[0] as any
      if (navigation) {
        metrics.ttfb = navigation.responseStart - navigation.requestStart
      }
      
      // Wait 5 seconds for all metrics to collect
      setTimeout(() => resolve(metrics), 5000)
    })
  })
}
```

**Update `PageData` type:**
```typescript
export interface PageData {
  // ... existing fields
  performanceMetrics?: {
    lcp?: number
    fid?: number
    cls?: number
    tbt?: number
    fcp?: number
    ttfb?: number
  }
}
```

**Generate performance issues:**
```typescript
// In analyzeSiteWideIssues()
if (page.performanceMetrics) {
  const { lcp, cls, fid, tbt } = page.performanceMetrics
  
  if (lcp && lcp > 2500) {
    issues.push({
      category: 'Performance',
      severity: lcp > 4000 ? 'High' : 'Medium',
      message: 'Slow Largest Contentful Paint (LCP)',
      details: `LCP is ${Math.round(lcp)}ms (target: <2.5s)`,
      affectedPages: [page.url]
    })
  }
  
  if (cls && cls > 0.1) {
    issues.push({
      category: 'Performance',
      severity: cls > 0.25 ? 'High' : 'Medium',
      message: 'High Cumulative Layout Shift (CLS)',
      details: `CLS is ${cls.toFixed(3)} (target: <0.1)`,
      affectedPages: [page.url]
    })
  }
  
  // ... similar for FID, TBT
}
```

---

### Phase 2: Advanced Features (Week 3-4)

#### 2.1 LLM Readability Analysis
**Priority: MEDIUM**

**Implementation:**
- Compare initial HTML vs rendered HTML
- Calculate rendering percentage
- Flag high rendering percentage as issue

**Code Changes:**
```typescript
// lib/llmReadability.ts (NEW)
export function calculateRenderingPercentage(
  initialHtml: string,
  renderedHtml: string
): number {
  const initialLength = initialHtml.length
  const renderedLength = renderedHtml.length
  
  if (initialLength === 0) return 0
  
  const percentage = ((renderedLength - initialLength) / initialLength) * 100
  return Math.max(0, percentage)
}

// In analyzePage()
const initialResponse = await fetch(url) // Get initial HTML
const initialHtml = await initialResponse.text()
const { html: renderedHtml } = await renderPage(url)
const renderingPercentage = calculateRenderingPercentage(initialHtml, renderedHtml)

if (renderingPercentage > 100) {
  issues.push({
    category: 'Technical',
    severity: renderingPercentage > 150 ? 'High' : 'Medium',
    message: 'High rendering percentage (LLM Readability)',
    details: `Rendering percentage: ${renderingPercentage.toFixed(1)}%. LLMs may miss dynamically rendered content.`,
    affectedPages: [url]
  })
}
```

---

#### 2.2 Enhanced Schema Detection
**Priority: MEDIUM**

**Implementation:**
- Detect Identity Schema (Organization/Person)
- Validate schema completeness
- Check for missing required fields

**Code Changes:**
```typescript
// lib/schemaAnalyzer.ts (NEW)
export interface SchemaAnalysis {
  hasSchema: boolean
  schemaTypes: string[]
  hasIdentitySchema: boolean
  identityType?: 'Organization' | 'Person'
  missingFields?: string[]
}

export function analyzeSchema(html: string, url: string): SchemaAnalysis {
  const analysis: SchemaAnalysis = {
    hasSchema: false,
    schemaTypes: [],
    hasIdentitySchema: false
  }
  
  // Parse JSON-LD
  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  
  jsonLdMatches.forEach(script => {
    try {
      const jsonContent = script.replace(/<script[^>]*>([\s\S]*?)<\/script>/i, '$1')
      const parsed = JSON.parse(jsonContent)
      const schemas = Array.isArray(parsed) ? parsed : [parsed]
      
      schemas.forEach((schema: any) => {
        if (schema['@type']) {
          analysis.hasSchema = true
          analysis.schemaTypes.push(schema['@type'])
          
          // Check for Identity Schema
          if (schema['@type'] === 'Organization' || schema['@type'] === 'Person') {
            analysis.hasIdentitySchema = true
            analysis.identityType = schema['@type']
            
            // Validate required fields
            const requiredFields = schema['@type'] === 'Organization' 
              ? ['name', 'url']
              : ['name']
            analysis.missingFields = requiredFields.filter(field => !schema[field])
          }
        }
      })
    } catch {}
  })
  
  return analysis
}
```

---

#### 2.3 Real Competitor Analysis
**Priority: MEDIUM**

**Implementation:**
- Accept competitor URLs as input
- Crawl competitor sites
- Extract their keywords
- Compare against audited site

**Code Changes:**
```typescript
// lib/competitorAnalysis.ts (NEW)
export interface CompetitorAnalysis {
  competitorUrl: string
  competitorKeywords: string[]
  keywordGaps: string[]
  sharedKeywords: string[]
  competitorPages: number
}

export async function analyzeCompetitor(
  competitorUrl: string,
  siteKeywords: string[],
  options: AuditOptions
): Promise<CompetitorAnalysis> {
  // Crawl competitor site
  const competitorAudit = await runAudit(competitorUrl, {
    ...options,
    maxPages: 10, // Limit competitor crawl
    maxDepth: 2
  })
  
  // Extract competitor keywords
  const competitorKeywords = new Set<string>()
  competitorAudit.pages.forEach(page => {
    if (page.extractedKeywords) {
      page.extractedKeywords.forEach(kw => competitorKeywords.add(kw))
    }
  })
  
  const competitorKeywordsArray = Array.from(competitorKeywords)
  const siteKeywordSet = new Set(siteKeywords.map(k => k.toLowerCase()))
  
  // Find gaps (competitor has, site doesn't)
  const keywordGaps = competitorKeywordsArray.filter(kw => {
    const kwLower = kw.toLowerCase()
    return !Array.from(siteKeywordSet).some(sk => {
      const skLower = sk.toLowerCase()
      return skLower === kwLower || skLower.includes(kwLower) || kwLower.includes(skLower)
    })
  })
  
  // Find shared keywords
  const sharedKeywords = competitorKeywordsArray.filter(kw => {
    const kwLower = kw.toLowerCase()
    return Array.from(siteKeywordSet).some(sk => {
      const skLower = sk.toLowerCase()
      return skLower === kwLower || skLower.includes(kwLower) || kwLower.includes(skLower)
    })
  })
  
  return {
    competitorUrl,
    competitorKeywords: competitorKeywordsArray.slice(0, 25),
    keywordGaps: keywordGaps.slice(0, 20),
    sharedKeywords: sharedKeywords.slice(0, 15),
    competitorPages: competitorAudit.pages.length
  }
}
```

**Update API to accept competitor URLs:**
```typescript
// app/api/audits/route.ts
export async function POST(req: Request) {
  const { url, tier, addOns, competitorUrls } = await req.json()
  
  let competitorAnalysis: CompetitorAnalysis | undefined
  if (addOns?.competitorAnalysis && competitorUrls?.length > 0) {
    // Analyze first competitor (can extend to multiple)
    competitorAnalysis = await analyzeCompetitor(
      competitorUrls[0],
      [], // Will be populated after main audit
      { tier, ...addOns }
    )
  }
  
  // ... rest of audit
}
```

---

### Phase 3: Visual Features (Week 5-6)

#### 3.1 Device Rendering Previews
**Priority: LOW**

**Implementation:**
- Generate screenshots at different viewport sizes
- Mobile (375x667), Tablet (768x1024), Desktop (1920x1080)
- Store screenshots, include in PDF

**Code Changes:**
```typescript
// lib/screenshots.ts (NEW)
export async function generateDeviceScreenshots(
  url: string
): Promise<{
  mobile: Buffer
  tablet: Buffer
  desktop: Buffer
}> {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  
  // Mobile
  await page.setViewport({ width: 375, height: 667 })
  await page.goto(url, { waitUntil: 'networkidle2' })
  const mobile = await page.screenshot({ type: 'png', fullPage: true })
  
  // Tablet
  await page.setViewport({ width: 768, height: 1024 })
  await page.goto(url, { waitUntil: 'networkidle2' })
  const tablet = await page.screenshot({ type: 'png', fullPage: true })
  
  // Desktop
  await page.setViewport({ width: 1920, height: 1080 })
  await page.goto(url, { waitUntil: 'networkidle2' })
  const desktop = await page.screenshot({ type: 'png', fullPage: true })
  
  await browser.close()
  
  return { mobile, tablet, desktop }
}
```

---

#### 3.2 SERP Snippet Preview
**Priority: LOW**

**Implementation:**
- Generate visual preview of how page appears in search results
- Include title, URL, meta description
- Style it like Google SERP

**Code Changes:**
```typescript
// lib/serpPreview.ts (NEW)
export function generateSERPPreviewHTML(page: PageData): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
      <div style="color: #1a0dab; font-size: 20px; line-height: 1.3; margin-bottom: 3px;">
        ${page.title || 'Untitled Page'}
      </div>
      <div style="color: #006621; font-size: 14px; line-height: 1.3; margin-bottom: 3px;">
        ${new URL(page.url).hostname} › ${new URL(page.url).pathname}
      </div>
      <div style="color: #545454; font-size: 14px; line-height: 1.5;">
        ${page.metaDescription || 'No meta description available.'}
      </div>
    </div>
  `
}
```

---

## Implementation Priority

### Must-Have (Week 1-2)
1. ✅ JavaScript rendering engine (Puppeteer)
2. ✅ Enhanced image detection
3. ✅ Enhanced link detection
4. ✅ Real Core Web Vitals metrics

### Should-Have (Week 3-4)
5. ✅ LLM Readability analysis
6. ✅ Enhanced schema detection (Identity Schema)
7. ✅ Real competitor analysis

### Nice-to-Have (Week 5-6)
8. ✅ Device rendering previews
9. ✅ SERP snippet preview
10. ✅ Improved keyword extraction (integrate with keyword research API)

---

## Dependencies to Add

```json
{
  "dependencies": {
    "puppeteer": "^21.0.0",
    "@types/puppeteer": "^5.4.0"
  }
}
```

---

## Testing Strategy

1. **Test JS-rendered content detection:**
   - Create test page with React/Vue
   - Verify images and links are detected

2. **Test performance metrics:**
   - Compare against Google PageSpeed Insights
   - Verify LCP, CLS, FID are accurate

3. **Test competitor analysis:**
   - Use real competitor URLs
   - Verify keyword extraction and comparison

---

## Migration Path

1. **Phase 1**: Implement rendering engine, keep old parser as fallback
2. **Phase 2**: Add new features incrementally
3. **Phase 3**: Remove old regex-based parser once rendering is stable

---

## Estimated Timeline

- **Week 1-2**: Core engine upgrade (rendering, images, links, performance)
- **Week 3-4**: Advanced features (LLM, schema, competitors)
- **Week 5-6**: Visual features (screenshots, SERP preview)

**Total: 6 weeks for full upgrade**

---

## Success Metrics

- ✅ Image detection: >95% accuracy on JS-rendered sites
- ✅ Link detection: >95% accuracy on JS-rendered sites
- ✅ Performance metrics: Within 10% of Google PageSpeed Insights
- ✅ Competitor analysis: Real URLs, actionable insights
- ✅ Overall audit time: <30 seconds per page (with rendering)

