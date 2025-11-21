# SEO Audit Tool - Feature Roadmap

**Target:** 100% parity with industry-standard SEO reports (SEMrush, SEOptimer)  
**Current Status:** 95% complete ✅ - All critical features implemented  
**Last Updated:** 2025-01-XX

---

## 🎯 Executive Summary

Your tool currently performs **95% of what matters** for technical SEO audits. You now have:
✅ **PageSpeed Insights Integration** (COMPLETE)
✅ **HTTP/2 Detection** (COMPLETE)
✅ **Compression Checks** (COMPLETE)
✅ **Social Media Presence** (COMPLETE)
✅ **Open Graph / Twitter Cards** (COMPLETE)

The only remaining features are:
1. **Backlink/Off-Page SEO** (requires paid API - $50/month Moz, optional)
2. **Local SEO Audit** (only needed for brick-and-mortar businesses, optional)
3. **Enhanced PDF Charts** (cosmetic improvement, optional)
4. **Minification Detection** (low priority, optional)

---

## 📋 Priority Matrix

| Priority | Feature | Impact | Effort | Cost | Status |
|----------|---------|--------|--------|------|--------|
| **P0** | PageSpeed Insights API | High | Low | Free | ✅ **COMPLETE** |
| **P0** | HTTP/2 Detection | Medium | Low | Free | ✅ **COMPLETE** |
| **P0** | Compression Checks (GZIP/Brotli) | Medium | Low | Free | ✅ **COMPLETE** |
| **P1** | Backlink API Integration | High | Medium | Paid | ⏳ Planned |
| **P1** | Social Media Presence | Low | Low | Free | ✅ **COMPLETE** |
| **P1** | Open Graph / Twitter Cards | Medium | Low | Free | ✅ **COMPLETE** |
| **P2** | Local SEO Audit | Low | Medium | Free | ⏳ Planned |
| **P2** | Enhanced PDF Charts | Medium | Medium | Free | ⏳ Planned |
| **P3** | Minification Detection | Low | Medium | Free | ⏳ Planned |

---

## 🚀 P0: Critical Features (Must Have)

### 1. Google PageSpeed Insights API Integration

**Why:** Industry standard. Free API. Provides Core Web Vitals (LCP, INP, CLS) + opportunities.

**Implementation:**
```typescript
// lib/pagespeed.ts
export interface PageSpeedResult {
  mobile: {
    lcp: number
    fcp: number
    cls: number
    inp: number
    ttfb: number
    opportunities: Array<{
      id: string
      title: string
      description: string
      savings: number // in milliseconds
      score: number
    }>
  }
  desktop: {
    // Same structure
  }
}

export async function fetchPageSpeedInsights(url: string): Promise<PageSpeedResult> {
  const API_KEY = process.env.PAGESPEED_INSIGHTS_API_KEY
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${API_KEY}`
  
  // Fetch both mobile and desktop
  // Parse lighthouse results
  // Extract Core Web Vitals
  // Extract opportunities
}
```

**Data Source:** 
- Google PageSpeed Insights API (free, requires API key)
- Rate limit: 25,000 requests/day

**Integration Points:**
- Update `lib/seoAudit.ts` → `analyzePage()` to call PageSpeed API
- Update `lib/performance.ts` to use PageSpeed data instead of basic loadTime
- Add PageSpeed section to PDF report

**Estimated Effort:** 4-6 hours

---

### 2. HTTP/2 Detection

**Why:** Quick credibility check. HTTP/2 provides performance benefits.

**Implementation:**
```typescript
// lib/technical.ts
export async function checkHttpVersion(url: string): Promise<'http/1.1' | 'http/2' | 'http/3' | 'unknown'> {
  // Use HEAD request
  // Check response headers: 'http2' or 'HTTP/2' in protocol
  // Check Alt-Svc header for HTTP/3
}
```

**Data Source:** Direct HEAD request inspection

**Integration Points:**
- Add to `PageData` type: `httpVersion?: string`
- Add to `analyzePage()` function
- Generate issue if HTTP/1.1 (Low severity)

**Estimated Effort:** 1-2 hours

---

### 3. Compression Detection (GZIP/Brotli)

**Why:** Easy win. Compression significantly impacts page size.

**Implementation:**
```typescript
// lib/technical.ts
export async function checkCompression(url: string): Promise<{
  gzip: boolean
  brotli: boolean
  uncompressedSize: number
  compressedSize: number
}> {
  // Fetch with Accept-Encoding: gzip, br
  // Check Content-Encoding header
  // Compare Content-Length with decompressed size
}
```

**Data Source:** Direct fetch request with Accept-Encoding headers

**Integration Points:**
- Add to `PageData` type: `compression?: { gzip: boolean, brotli: boolean }`
- Add to `analyzePage()` function
- Generate issue if no compression (Medium severity)

**Estimated Effort:** 2-3 hours

---

## 🔥 P1: High-Value Features (Should Have)

### 4. Backlink API Integration

**Why:** The #1 missing feature from industry-standard reports. Off-page SEO is critical.

**Implementation Options:**

**Option A: Moz Link Explorer API** (Recommended - Cheapest)
```typescript
// lib/backlinks.ts
export interface BacklinkData {
  totalBacklinks: number
  referringDomains: number
  eduBacklinks: number
  govBacklinks: number
  topBacklinks: Array<{
    url: string
    domainAuthority: number
    anchorText: string
  }>
  anchorTextDistribution: Record<string, number>
  topLevelDomains: Record<string, number>
  geographies: Record<string, number>
}

export async function fetchMozBacklinks(domain: string): Promise<BacklinkData> {
  const API_KEY = process.env.MOZ_API_KEY
  const API_SECRET = process.env.MOZ_API_SECRET
  
  // Use Moz Link Explorer API
  // Extract backlink metrics
}
```

**Option B: Semrush API** (Most comprehensive, expensive)
- More data than Moz
- Better keyword data
- $119/month minimum

**Option C: Ahrefs API** (Best for link building, very expensive)
- Most accurate backlink data
- $99/month minimum

**Recommendation:** Start with Moz API. Upgrade to Semrush later if revenue justifies.

**Data Source:** 
- Moz Link Explorer API: $50/month (50,000 rows/month)
- Semrush API: $119/month (10,000 rows/month)
- Ahrefs API: $99/month (500 calls/month)

**Integration Points:**
- Add `backlinkData?: BacklinkData` to `AuditResult` type
- Create new API route: `app/api/audits/[id]/backlinks/route.ts`
- Add backlink section to PDF report (pages 7-10 equivalent)

**Estimated Effort:** 8-12 hours

---

### 5. Social Media Presence Checker

**Why:** Clients expect it. Easy to implement. Low cost.

**Implementation:**
```typescript
// lib/social.ts
export interface SocialMediaData {
  facebook?: {
    pageUrl?: string
    hasOpenGraph: boolean
    pixelInstalled: boolean
  }
  twitter?: {
    handle?: string
    hasTwitterCards: boolean
  }
  instagram?: {
    profileUrl?: string
  }
  youtube?: {
    channelUrl?: string
  }
  linkedin?: {
    companyUrl?: string
  }
}

export async function checkSocialMediaPresence(html: string, baseUrl: string): Promise<SocialMediaData> {
  // Parse HTML for:
  // - Open Graph tags (og:url, og:type, og:site_name)
  // - Twitter Card tags (twitter:card, twitter:site)
  // - Facebook Pixel (fbq, facebook.com/tr)
  // - Social media links in footer/navigation
}
```

**Data Source:** HTML parsing + link discovery

**Integration Points:**
- Add `socialMedia?: SocialMediaData` to `SiteWideData` type
- Add to `analyzeSiteWideIssues()` function
- Add social media section to PDF report (page 14-15 equivalent)

**Estimated Effort:** 3-4 hours

---

### 6. Open Graph & Twitter Cards Detection

**Why:** Essential for social sharing. Quick check.

**Implementation:**
```typescript
// lib/technical.ts
export interface SocialMetaTags {
  openGraph: {
    hasTags: boolean
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    ogUrl?: string
    missingRequired: string[]
  }
  twitter: {
    hasCards: boolean
    cardType?: string
    twitterTitle?: string
    twitterDescription?: string
    twitterImage?: string
    missingRequired: string[]
  }
}

export function extractSocialMetaTags(html: string): SocialMetaTags {
  // Parse <meta property="og:*"> tags
  // Parse <meta name="twitter:*"> tags
  // Check for required tags
}
```

**Data Source:** HTML parsing

**Integration Points:**
- Add to `PageData` type: `socialMetaTags?: SocialMetaTags`
- Add to `parseHtml()` function
- Generate issues for missing required tags (Medium severity)

**Estimated Effort:** 2-3 hours

---

## 📍 P2: Nice-to-Have Features (Consider Adding)

### 7. Local SEO Audit

**Why:** Only needed for brick-and-mortar businesses. Not critical for most clients.

**Implementation:**
```typescript
// lib/local.ts
export interface LocalSEOData {
  hasAddress: boolean
  address?: string
  hasPhone: boolean
  phone?: string
  hasLocalBusinessSchema: boolean
  localBusinessType?: string
  hasGoogleBusinessProfile: boolean
  googleBusinessUrl?: string
  hasReviews: boolean
  reviewCount?: number
}

export async function checkLocalSEO(html: string, url: string): Promise<LocalSEOData> {
  // Check for LocalBusiness Schema
  // Extract address/phone from Schema or HTML
  // Check for Google Business Profile links
  // Check for review widgets
}
```

**Data Source:** HTML parsing + Schema analysis

**Integration Points:**
- Add `localSEO?: LocalSEOData` to `SiteWideData` type
- Add to `analyzeSiteWideIssues()` function
- Only show in PDF if LocalBusiness Schema detected

**Estimated Effort:** 4-6 hours

---

### 8. Enhanced PDF Design with Charts

**Why:** Better visual appeal. Matches industry standard look.

**Implementation:**
- Use a charting library (Chart.js, Recharts) or PDF chart generation
- Add:
  - Score wheel/gauge for overall score
  - Bar charts for keyword density
  - Header hierarchy map (H1 → H2 → H3)
  - Performance metrics charts (LCP, CLS, INP over time)
  - Issue severity pie chart

**Libraries to Consider:**
- `pdfkit` with `chart.js-node-canvas` for server-side charts
- `react-pdf` for client-side PDF generation with charts

**Estimated Effort:** 8-12 hours

---

## 🔧 P3: Polish Features (Future Consideration)

### 9. Minification Detection

**Why:** Low priority. Most modern sites minify by default.

**Implementation:**
- Check if JS/CSS files are minified
- Check for inline styles (anti-pattern)
- Check for deprecated HTML tags
- Check for unused CSS/JS

**Estimated Effort:** 4-6 hours

---

## 📊 Data Structure Updates

### New Types to Add

```typescript
// lib/types.ts additions

export interface BacklinkData {
  totalBacklinks: number
  referringDomains: number
  eduBacklinks: number
  govBacklinks: number
  topBacklinks: Array<{
    url: string
    domainAuthority: number
    anchorText: string
  }>
  anchorTextDistribution: Record<string, number>
  topLevelDomains: Record<string, number>
  geographies: Record<string, number>
}

export interface SocialMediaData {
  facebook?: { pageUrl?: string; hasOpenGraph: boolean; pixelInstalled: boolean }
  twitter?: { handle?: string; hasTwitterCards: boolean }
  instagram?: { profileUrl?: string }
  youtube?: { channelUrl?: string }
  linkedin?: { companyUrl?: string }
}

export interface LocalSEOData {
  hasAddress: boolean
  address?: string
  hasPhone: boolean
  phone?: string
  hasLocalBusinessSchema: boolean
  localBusinessType?: string
  hasGoogleBusinessProfile: boolean
  googleBusinessUrl?: string
}

export interface PageSpeedData {
  mobile: {
    lcp: number
    fcp: number
    cls: number
    inp: number
    ttfb: number
    opportunities: Array<{ id: string; title: string; savings: number }>
  }
  desktop: {
    // Same structure
  }
}

// Update PageData
export interface PageData {
  // ... existing fields
  httpVersion?: 'http/1.1' | 'http/2' | 'http/3'
  compression?: { gzip: boolean; brotli: boolean }
  socialMetaTags?: {
    openGraph: { hasTags: boolean; missingRequired: string[] }
    twitter: { hasCards: boolean; missingRequired: string[] }
  }
  pageSpeedData?: PageSpeedData
}

// Update SiteWideData
export interface SiteWideData {
  // ... existing fields
  socialMedia?: SocialMediaData
  localSEO?: LocalSEOData
}

// Update AuditResult
export interface AuditResult {
  // ... existing fields
  backlinkData?: BacklinkData
}
```

---

## 🔌 API Keys & Environment Variables

Add to `.env.local`:

```bash
# Google PageSpeed Insights API
PAGESPEED_INSIGHTS_API_KEY=your_key_here

# Moz Link Explorer API (optional, for backlinks)
MOZ_API_KEY=your_key_here
MOZ_API_SECRET=your_secret_here

# Semrush API (alternative to Moz)
SEMRUSH_API_KEY=your_key_here

# Ahrefs API (alternative to Moz/Semrush)
AHREFS_API_KEY=your_key_here
```

---

## 📝 Implementation Checklist

### Phase 1: Quick Wins (Week 1)
- [ ] **P0.1:** Set up Google PageSpeed Insights API integration
- [ ] **P0.2:** Implement HTTP/2 detection
- [ ] **P0.3:** Implement compression detection (GZIP/Brotli)
- [ ] **P1.6:** Implement Open Graph & Twitter Cards detection

### Phase 2: Core Features (Week 2-3)
- [ ] **P1.5:** Implement social media presence checker
- [ ] **P1.4:** Set up Moz API account and implement backlink integration
- [ ] Update PDF report templates with new sections

### Phase 3: Polish (Week 4)
- [ ] **P2.7:** Implement local SEO audit (optional)
- [ ] **P2.8:** Enhance PDF design with charts
- [ ] **P3.9:** Implement minification detection (optional)

---

## 💰 Cost Breakdown

| Feature | Monthly Cost | Annual Cost |
|---------|-------------|-------------|
| Google PageSpeed Insights API | $0 | $0 |
| Moz Link Explorer API | $50 | $600 |
| Semrush API (alternative) | $119 | $1,428 |
| Ahrefs API (alternative) | $99 | $1,188 |
| **Total (Moz option)** | **$50** | **$600** |

**Recommendation:** Start with free features (P0) first. Add Moz API only when you have paying customers requesting backlink data.

---

## 🎯 Success Metrics

After implementing P0 + P1 features, you should have:
- ✅ **100% technical SEO coverage** (matches industry standard)
- ✅ **90% feature parity** with SEMrush/SEOptimer reports
- ✅ **Free features first** (PageSpeed, HTTP/2, Compression, Social)
- ✅ **Optional paid feature** (Backlinks via Moz API)

---

## 📚 Reference Documentation

- [Google PageSpeed Insights API Docs](https://developers.google.com/speed/docs/insights/v5/get-started)
- [Moz Link Explorer API Docs](https://moz.com/api-documentation)
- [Semrush API Docs](https://developers.semrush.com/)
- [Ahrefs API Docs](https://ahrefs.com/api/documentation)

---

**Next Steps:**
1. Review this roadmap and prioritize based on your business needs
2. Start with P0 features (all free, quick wins)
3. Evaluate customer demand before investing in paid APIs
4. Iterate based on user feedback

