# 🚀 Sprint 1 Implementation Guide

**Status**: IN PROGRESS  
**Goal**: Fix all critical bugs to make audit engine trustworthy

---

## ✅ Task 1.1: Crawl Diagnostics (COMPLETE)

**File Created**: `lib/crawlDiagnostics.ts`

**Features**:
- Detects crawl status (success/partial/failed)
- Identifies platform (Wix, WordPress, Squarespace, etc.)
- Detects specific issues (404s, parking pages, robots blocking, JS-heavy)
- Generates actionable recommendations
- Provides HTML for report integration

**Next**: Integrate into `lib/seoAudit.ts`

---

## 🔄 Task 1.2: Filter 404 Pages (IN PROGRESS)

**Goal**: Don't audit error pages for SEO issues

**Implementation Plan**:

### Step 1: Add page filtering function
```typescript
// In lib/seoAudit.ts
function filterValidPages(pages: PageData[]): {
  validPages: PageData[]
  errorPages: PageData[]
} {
  const validPages = pages.filter(p => p.statusCode >= 200 && p.statusCode < 400)
  const errorPages = pages.filter(p => p.statusCode >= 400 || p.statusCode === 0)
  
  return { validPages, errorPages }
}
```

### Step 2: Update issue generation
```typescript
// Only run SEO checks on validPages
const { validPages, errorPages } = filterValidPages(pages)

// Generate issues ONLY from validPages
const issues = generateAllIssues(validPages, siteWide)

// Add broken page issue separately
if (errorPages.length > 0) {
  issues.push({
    type: 'broken-pages',
    severity: 'high',
    category: 'technical',
    title: 'Broken pages detected',
    description: `${errorPages.length} pages returned errors`,
    affectedPages: errorPages.map(p => p.url),
    howToFix: 'Fix or remove broken pages...'
  })
}
```

### Step 3: Update scores
```typescript
// Calculate scores based on validPages only
const scores = calculateAllScores(validPages, issues, siteWide)
```

---

## 🔄 Task 1.3: Deduplicate URLs (IN PROGRESS)

**Goal**: No duplicate URLs in page-level table

**Implementation Plan**:

### Step 1: Add deduplication function
```typescript
// In lib/seoAudit.ts
function deduplicatePages(pages: PageData[]): PageData[] {
  const seen = new Map<string, PageData>()
  
  for (const page of pages) {
    const normalizedUrl = normalizeUrlNew(page.url)
    
    if (seen.has(normalizedUrl)) {
      const existing = seen.get(normalizedUrl)!
      
      // Keep the entry with more data
      if (page.wordCount > existing.wordCount || 
          (existing.statusCode === 0 && page.statusCode > 0) ||
          (existing.statusCode >= 400 && page.statusCode < 400)) {
        seen.set(normalizedUrl, page)
      }
    } else {
      seen.set(normalizedUrl, page)
    }
  }
  
  return Array.from(seen.values())
}
```

### Step 2: Apply after crawling
```typescript
// In runAudit()
const crawledPages = await crawlPages(...)
const uniquePages = deduplicatePages(crawledPages)
```

---

## 🔄 Task 1.4: Fix Keyword Extraction (IN PROGRESS)

**Goal**: No garbage keywords like "tconne cted"

**Implementation Plan**:

### Step 1: Update keyword extraction
```typescript
// In lib/keywordProcessor.ts
import { decode } from 'html-entities'

export function extractKeywords(text: string, statusCode?: number): string[] {
  // Don't extract from error pages
  if (statusCode && statusCode >= 400) {
    return []
  }
  
  // 1. Decode HTML entities
  let decoded = decode(text)
  
  // 2. Normalize whitespace
  decoded = decoded.replace(/\s+/g, ' ').trim()
  
  // 3. Extract words (alphanumeric + hyphens)
  const words = decoded.toLowerCase()
    .match(/\b[a-z0-9]+(?:-[a-z0-9]+)*\b/gi) || []
  
  // 4. Filter out:
  // - Very short words (< 3 chars)
  // - Common stop words
  // - Broken fragments
  const STOP_WORDS = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'])
  
  const filtered = words.filter(word => {
    if (word.length < 3) return false
    if (STOP_WORDS.has(word)) return false
    if (word.includes(' ')) return false // Broken spacing
    return true
  })
  
  // 5. Get unique keywords
  return [...new Set(filtered)]
}
```

---

## 🔄 Task 1.5: Tier Management (IN PROGRESS)

**Goal**: Report shows correct tier (Standard/Advanced)

**Implementation Plan**:

### Step 1: Pass tier through audit
```typescript
// In lib/seoAudit.ts - runAudit()
export async function runAudit(
  url: string,
  options: AuditOptions = {}
): Promise<AuditResult> {
  // ... existing code ...
  
  return {
    url,
    tier: options.tier || 'standard', // NEW: Include tier in result
    timestamp: new Date().toISOString(),
    scores,
    issues,
    pages: uniquePages,
    siteWide,
    // ... rest of result
  }
}
```

### Step 2: Update AuditResult type
```typescript
// In lib/types.ts
export interface AuditResult {
  url: string
  tier: AuditTier // NEW
  timestamp: string
  scores: {
    overall: number
    technical: number
    onPage: number
    content: number
    accessibility: number
  }
  // ... rest of fields
}
```

### Step 3: Show tier in report
```typescript
// In lib/pdf.ts - generatePDF()
<h2>Service Details</h2>
<p><strong>Service Tier:</strong> ${result.tier.charAt(0).toUpperCase() + result.tier.slice(1)}</p>
```

---

## 🔄 Task 1.6: Fix Competitor Analysis Fallback (IN PROGRESS)

**Goal**: Show real data or honest "unable to analyze" message

**Implementation Plan**:

### Step 1: Update competitor analysis logic
```typescript
// In lib/realCompetitorAnalysis.ts

export async function analyzeCompetitors(
  competitorUrls: string[] | undefined,
  siteKeywords: Set<string>,
  userAgent: string
): Promise<CompetitorAnalysis> {
  console.log('[Competitor] Starting analysis')
  console.log('[Competitor] URLs provided:', competitorUrls)
  console.log('[Competitor] Site keywords:', Array.from(siteKeywords))
  
  // If no URLs provided
  if (!competitorUrls || competitorUrls.length === 0) {
    console.log('[Competitor] No URLs provided, using fallback')
    return generateFallbackKeywordSuggestions(siteKeywords)
  }
  
  // Try real crawling
  try {
    console.log('[Competitor] Attempting real crawl...')
    const result = await crawlCompetitors(competitorUrls, userAgent)
    console.log('[Competitor] Real crawl succeeded')
    return result
  } catch (error) {
    console.log('[Competitor] Real crawl failed:', error)
    console.log('[Competitor] Using fallback')
    return generateFallbackKeywordSuggestions(siteKeywords)
  }
}
```

### Step 2: Improve fallback suggestions
```typescript
export function generateFallbackKeywordSuggestions(
  siteKeywords: Set<string>
): CompetitorAnalysis {
  const keywords = Array.from(siteKeywords)
  
  // Industry-specific patterns
  const INDUSTRY_PATTERNS = {
    construction: ['contractor', 'renovation', 'remodeling', 'builder', 'construction'],
    restaurant: ['restaurant', 'menu', 'dining', 'food', 'cuisine'],
    lawyer: ['lawyer', 'attorney', 'legal', 'law', 'firm'],
    doctor: ['doctor', 'medical', 'health', 'clinic', 'practice'],
    // ... more industries
  }
  
  // Detect industry from keywords
  let industry = 'general'
  for (const [key, terms] of Object.entries(INDUSTRY_PATTERNS)) {
    if (keywords.some(kw => terms.some(term => kw.includes(term)))) {
      industry = key
      break
    }
  }
  
  // Generate industry-specific suggestions
  const suggestions = generateIndustrySuggestions(industry, keywords)
  
  return {
    competitorUrl: `Pattern-based suggestions for ${industry} industry`,
    sharedKeywords: suggestions.shared,
    keywordGaps: suggestions.gaps,
    competitorKeywords: suggestions.competitor
  }
}
```

---

## 📋 Integration Checklist

### Files to Modify:
- [x] `lib/crawlDiagnostics.ts` - NEW (created)
- [ ] `lib/seoAudit.ts` - Integrate all fixes
- [ ] `lib/keywordProcessor.ts` - Fix extraction
- [ ] `lib/realCompetitorAnalysis.ts` - Improve fallback
- [ ] `lib/types.ts` - Add tier to AuditResult
- [ ] `lib/pdf.ts` - Show crawl status and tier
- [ ] `app/audits/[id]/page.tsx` - Show crawl status in UI

### Testing:
- [ ] Test on Carter Renovations (404 site)
- [ ] Test on NASA (working site)
- [ ] Test with competitor URLs
- [ ] Test without competitor URLs
- [ ] Verify no duplicate URLs
- [ ] Verify no 404s in SEO issues
- [ ] Verify clean keywords
- [ ] Verify correct tier shown

---

## 🎯 Next Steps

1. Implement all 6 tasks in `lib/seoAudit.ts`
2. Update supporting files
3. Test on multiple sites
4. Mark Sprint 1 complete
5. Move to Sprint 2 (Local SEO)

---

**Status**: Ready to implement all Sprint 1 fixes in one batch

