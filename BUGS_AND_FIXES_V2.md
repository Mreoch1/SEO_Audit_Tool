# SEO Audit Engine - Critical Bugs & Fix Plan

**Date:** November 24, 2024  
**Audit:** Linear.app  
**Status:** Multiple systemic issues identified

---

## 🟥 CRITICAL BUGS (Must Fix Immediately)

### 1. Schema Detection Still Broken
**Severity:** 🔴 CRITICAL  
**Issue:** Not detecting JavaScript-rendered JSON-LD schema  
**Impact:** False positives on all modern sites (Next.js, React, etc.)  
**Current Behavior:** Reports "Missing schema markup" on 20 pages when schema exists  
**Root Cause:** Schema extraction only checks initial HTML, not rendered DOM  
**Fix Required:**
- ✅ Already implemented `schemaScripts` extraction from rendered DOM
- ❌ But `analyzeSchema` may not be processing `schemaScripts` correctly
- Need to verify schema extraction is working end-to-end

**Files to Check:**
- `lib/renderer.ts` - `extractSchemaScriptsFromDOM`
- `lib/schemaAnalyzer.ts` - `analyzeSchema` function
- `lib/seoAudit.ts` - Schema detection flow

---

### 2. Page Title Extraction Incorrect
**Severity:** 🔴 CRITICAL  
**Issue:** All pages show "About – Linear" or incorrect titles  
**Impact:** Client trust destroyed - they know their own site  
**Current Behavior:** Title extraction failing on JS-rendered content  
**Root Cause:** Extracting from initial HTML instead of rendered DOM  
**Fix Required:**
- Extract title from rendered DOM using Puppeteer
- Fallback to initial HTML if rendered title is empty
- Handle Next.js SSR title injection

**Files to Fix:**
- `lib/renderer.ts` - Add title extraction from rendered DOM
- `lib/seoAudit.ts` - Use rendered title instead of initial HTML title

---

### 3. Core Web Vitals API Failing
**Severity:** 🔴 CRITICAL  
**Issue:** "No PageSpeed data – Core Web Vitals unavailable" on all pages  
**Impact:** Missing critical performance metrics  
**Root Cause:** PageSpeed Insights API call failing (quota, timeout, or API key)  
**Fix Required:**
- Add detailed error logging for PageSpeed API failures
- Implement retry logic with exponential backoff
- Add fallback to Lighthouse local runs
- Verify API key and quota status

**Files to Fix:**
- `lib/seoAudit.ts` - PageSpeed API integration
- Add error handling and logging

---

### 4. Competitor Analysis Malfunctioning
**Severity:** 🔴 CRITICAL  
**Issue:** Only 1 competitor crawled, confidence = 0%, no keyword gaps  
**Impact:** Entire feature appears broken to clients  
**Root Cause:** Competitor crawling failing silently or keyword extraction broken  
**Fix Required:**
- Add detailed logging for each competitor crawl
- Fix keyword extraction logic
- Implement proper error handling
- Add retry logic for failed crawls

**Files to Fix:**
- `lib/seoAudit.ts` - Competitor analysis section
- Add comprehensive logging

---

## 🟧 HIGH PRIORITY BUGS (Fix Soon)

### 5. Thin Content Calculation Inconsistent
**Severity:** 🟠 HIGH  
**Issue:** Thin content list shows 110 words, but page table shows 720 words  
**Impact:** Data inconsistency undermines credibility  
**Root Cause:** Different word count extraction methods used in different sections  
**Fix Required:**
- Standardize word count extraction to use same method everywhere
- Use rendered DOM content, not initial HTML
- Filter out template boilerplate
- Ensure thin content detection uses same word count as page table

**Files to Fix:**
- `lib/seoAudit.ts` - Word count extraction
- `lib/pdf.ts` - Thin content section (use same word count)

---

### 6. Duplicate Title/Meta Description Counts Don't Match
**Severity:** 🟠 HIGH  
**Issue:** Duplicate title count (2 pages) doesn't match page table (17 pages)  
**Impact:** Confusing and contradictory data  
**Root Cause:** Different counting logic in different sections  
**Fix Required:**
- Use single source of truth for duplicate detection
- Ensure page table and summary sections use same data
- Fix template detection logic for duplicates

**Files to Fix:**
- `lib/seoAudit.ts` - Duplicate detection logic
- `lib/pdf.ts` - Ensure using same data source

---

### 7. LLM Rendering Percentage Formula Wrong
**Severity:** 🟠 HIGH  
**Issue:** Rendering percentages don't correlate with HTML size differences  
**Impact:** Rendering analysis appears broken  
**Root Cause:** Incorrect formula for calculating rendering percentage  
**Example:** Initial 2.55M chars, Rendered 1.60M chars, shows 37.27% (should be ~63% added)  
**Fix Required:**
- Review and fix rendering percentage calculation
- Ensure formula matches the explanation in report
- Add validation to catch impossible values

**Files to Fix:**
- `lib/seoAudit.ts` - Rendering percentage calculation
- Verify formula: `(rendered - initial) / initial * 100` or similar

---

### 8. Accessibility Score Disproportionately Low
**Severity:** 🟠 HIGH  
**Issue:** Only 2 accessibility issues but score is 14/100  
**Impact:** Scoring appears broken to clients  
**Root Cause:** Accessibility scoring formula too harsh or missing issues  
**Fix Required:**
- Review accessibility scoring formula
- Ensure all accessibility issues are being detected
- Rebalance scoring to match issue count

**Files to Fix:**
- `lib/seoAudit.ts` - Accessibility scoring
- Ensure all accessibility checks are running

---

## 🟨 MEDIUM PRIORITY BUGS

### 9. Page Table Shows Repeated Boilerplate Values
**Severity:** 🟡 MEDIUM  
**Issue:** Missing alt text always shows 6, word count shows 720/745 repeatedly  
**Impact:** Appears like template reuse, not real scraping  
**Root Cause:** Extracting template content instead of page-specific content  
**Fix Required:**
- Improve content extraction to get page-specific data
- Filter out template boilerplate
- Ensure each page gets unique analysis

**Files to Fix:**
- `lib/renderer.ts` - Content extraction
- `lib/seoAudit.ts` - Page-level analysis

---

### 10. Word Count Extraction Not Using Rendered DOM
**Severity:** 🟡 MEDIUM  
**Issue:** Word counts appear to be from initial HTML, not rendered content  
**Impact:** Inaccurate content analysis for JS-rendered sites  
**Root Cause:** Word count extraction happening before JS hydration  
**Fix Required:**
- Extract word count from rendered DOM
- Wait for content to load before counting
- Filter out navigation, footer, header boilerplate

**Files to Fix:**
- `lib/renderer.ts` - Add word count extraction from rendered DOM
- `lib/seoAudit.ts` - Use rendered word count

---

## 🔧 FIX IMPLEMENTATION PLAN

### Phase 1: Critical Fixes (Do First)
1. ✅ Verify schema detection is working (check if `schemaScripts` is being processed)
2. Fix page title extraction from rendered DOM
3. Fix Core Web Vitals API integration
4. Fix competitor analysis with proper logging

### Phase 2: High Priority Fixes
5. Standardize word count extraction
6. Fix duplicate detection consistency
7. Fix rendering percentage formula
8. Rebalance accessibility scoring

### Phase 3: Medium Priority Fixes
9. Improve page-specific content extraction
10. Ensure all metrics use rendered DOM

---

## 📊 Testing Checklist

After fixes, verify:
- [ ] Schema detected on pages that have it
- [ ] Page titles match actual page content
- [ ] Core Web Vitals data appears in report
- [ ] Competitor analysis shows real data
- [ ] Word counts are accurate and unique per page
- [ ] Duplicate counts match across all sections
- [ ] Rendering percentages are mathematically correct
- [ ] Accessibility score matches issue count
- [ ] Page table shows unique values per page

---

## 🎯 Success Criteria

A fixed audit should:
1. Detect schema on pages that have it (no false positives)
2. Show correct page titles for each page
3. Include Core Web Vitals data
4. Show meaningful competitor analysis
5. Have consistent word counts across all sections
6. Have matching duplicate counts
7. Show mathematically correct rendering percentages
8. Have accessibility scores that match issue severity
9. Show unique values in page table

---

**Next Steps:** Start with Phase 1 critical fixes, then move to Phase 2.

