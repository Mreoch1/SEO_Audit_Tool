# SEO Audit Pro - Critical Bug List & Fixes

## 🟥 Critical Issues (System-Wide Failures)

### 1. Schema Detection Broken (CRITICAL)
**Severity:** P0 - Blocks core feature  
**Issue:** Schema analyzer only checks initial HTML, missing JS-rendered JSON-LD  
**Impact:** False positives on all modern JS-rendered sites (Linear, Next.js, React apps)  
**Root Cause:** `lib/schemaAnalyzer.ts` analyzes `html` parameter which is initial HTML, not rendered HTML  
**Fix Required:** 
- Pass rendered HTML to `analyzeSchema()` 
- Or extract schema from rendered DOM via Puppeteer
- Check both initial AND rendered HTML

**Files Affected:**
- `lib/schemaAnalyzer.ts` - Main schema detection logic
- `lib/seoAudit.ts` - Where schema analysis is called

---

### 2. PageSpeed API Failing (CRITICAL)
**Severity:** P0 - Core Web Vitals missing  
**Issue:** All pages show "No PageSpeed data - Core Web Vitals unavailable"  
**Impact:** Missing critical performance metrics for all audits  
**Root Causes (to investigate):**
- API key not configured (`process.env.PAGESPEED_INSIGHTS_API_KEY`)
- Quota exceeded
- Timeout too short (60s may be insufficient)
- Wrong API endpoint/version
- Rate limiting

**Files Affected:**
- `lib/pagespeed.ts` - PageSpeed API integration
- `lib/seoAudit.ts` - Where PageSpeed is called

**Fix Required:**
- Add better error logging to identify exact failure
- Check API key configuration
- Implement retry logic with exponential backoff
- Add quota monitoring

---

### 3. Competitor Analysis Only Crawling 1 Competitor (CRITICAL)
**Severity:** P0 - Feature incomplete  
**Issue:** Report shows "Crawled 1 competitor site(s)" when 3 were provided  
**Impact:** Incomplete competitor analysis, missing keyword gaps  
**Root Cause:** Need to check `lib/realCompetitorAnalysis.ts` and `lib/seoAudit.ts` competitor crawling logic

**Files Affected:**
- `lib/realCompetitorAnalysis.ts` - Competitor crawling
- `lib/seoAudit.ts` - Competitor analysis orchestration

**Fix Required:**
- Ensure all competitor URLs are processed
- Add parallel crawling with proper error handling
- Log which competitors succeeded/failed

---

### 4. Rendering Percentage Calculation Wrong (HIGH)
**Severity:** P1 - Data accuracy  
**Issue:** Contradictory values (e.g., 2.6% rendering but 97.5% similarity)  
**Impact:** Confusing/incorrect LLM readability metrics  
**Root Cause:** `lib/llmReadability.ts` has flawed logic when rendered < initial HTML

**Files Affected:**
- `lib/llmReadability.ts` - Rendering percentage calculation

**Fix Required:**
- Rewrite calculation logic to be consistent
- Rendering % should represent: (rendered - initial) / initial * 100
- Similarity should be separate metric (how much initial content remains)
- Handle edge cases (rendered < initial, empty initial, etc.)

---

### 5. Word Count Using Initial HTML Instead of Rendered (HIGH)
**Severity:** P1 - Data accuracy  
**Issue:** Word counts show template shell (745 words repeated) instead of actual page content  
**Impact:** Thin content detection fails, incorrect content scores  
**Root Cause:** Word count extraction happens before JS rendering completes

**Files Affected:**
- `lib/seoAudit.ts` - Word count extraction
- `lib/enhancedContent.ts` - Content depth analysis

**Fix Required:**
- Ensure word count uses rendered HTML/DOM
- Extract text content from rendered DOM, not initial HTML
- Filter out template/navigation content

---

### 6. Title Duplication Logic Treats Templates as Errors (HIGH)
**Severity:** P1 - False positives  
**Issue:** 17 pages flagged for duplicate title "About – Linear" when they're template-based  
**Impact:** Excessive false positives on modern JS-router sites  
**Root Cause:** No template detection logic

**Files Affected:**
- `lib/seoAudit.ts` - Title extraction and duplication detection
- `lib/enhancedOnPage.ts` - On-page issue generation

**Fix Required:**
- Detect template-based pages (same title + same structure + same word count)
- Group template pages and report once, not per-page
- Add logic: "X pages share template title - ensure each has unique title or canonical"

---

## 🟧 Major Logic Issues

### 7. Thin Content Detection Inconsistent (MEDIUM)
**Severity:** P2 - Feature incomplete  
**Issue:** Only 3 pages flagged, but table shows many < 150 words  
**Root Cause:** Threshold too high (300 words) or detection logic incomplete

**Fix Required:**
- Lower threshold for thin content (150-200 words)
- Check rendered content, not initial
- Account for template pages differently

---

### 8. Accessibility Score Doesn't Match Issues (MEDIUM)
**Severity:** P2 - Scoring accuracy  
**Issue:** Score 41/100 but only 2 issues found  
**Root Cause:** Scoring formula in `lib/scoring.ts` may be too harsh or incomplete

**Fix Required:**
- Review `calculateAccessibilityScore()` formula
- Ensure score reflects actual issues found
- Add penalty only for detected issues, not assumptions

---

### 9. Page-Level Content Extraction Capturing Template Shell (MEDIUM)
**Severity:** P2 - Data accuracy  
**Issue:** All pages show identical word counts, alt text counts, link counts  
**Root Cause:** Extracting from template shell before JS hydration

**Fix Required:**
- Extract all page-level data from rendered DOM
- Use Puppeteer to get actual page content after JS execution
- Filter navigation/template content

---

### 10. Script Detection Missing Preload Links (LOW)
**Severity:** P3 - Feature incomplete  
**Issue:** "Render-blocking scripts: 1" when Linear loads many bundles  
**Root Cause:** Only checking `<script>` tags, missing `<link rel="preload">` and dynamic imports

**Fix Required:**
- Check for preload links
- Detect dynamic script loading
- Count all render-blocking resources

---

## 🟩 What's Working Well

✅ Security header checks  
✅ H1 JS-rendering detection  
✅ Missing metadata identification  
✅ Canonical/alt issues  
✅ Report structure & clarity  
✅ Summary & prioritization  

---

## Fix Priority Order

1. **Schema Detection** (P0) - Affects all modern sites
2. **PageSpeed API** (P0) - Core feature missing
3. **Competitor Crawling** (P0) - Feature incomplete
4. **Rendering Percentage** (P1) - Data accuracy
5. **Word Count Extraction** (P1) - Data accuracy
6. **Title Duplication Logic** (P1) - False positives
7. **Thin Content Detection** (P2) - Feature incomplete
8. **Accessibility Scoring** (P2) - Scoring accuracy
9. **Page-Level Extraction** (P2) - Data accuracy
10. **Script Detection** (P3) - Feature incomplete

