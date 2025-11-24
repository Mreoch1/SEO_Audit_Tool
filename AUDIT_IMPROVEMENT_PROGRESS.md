# SEO Audit Engine Improvement Progress

**Date:** November 24, 2025  
**Target Site:** https://linear.app  
**Current Audit ID:** cmidkp4rw0000oms00d4dcgds  
**Status:** Running

---

## 🎯 Goal

Achieve **10/10 audit engine quality score** by:
- Eliminating false positives and false negatives
- Ensuring internal consistency of metrics and counts
- Making scoring and priorities match real-world SEO impact
- Producing client-ready reports for SaaS companies
- Fixing competitor analysis and Core Web Vitals sections

---

## ✅ Fixes Applied (Iteration 1)

### 1. Competitor Analysis - Keyword Gaps
**Issue:** 50 competitor keywords found but 0 gaps/0 shared keywords  
**Root Cause:** Logic required keywords to appear in 2+ competitors, but Standard tier only analyzes 1 competitor  
**Fix Applied:**
- Modified `lib/realCompetitorAnalysis.ts` to allow gaps with single competitor (minFrequency = 1 for single competitor)
- Updated `lib/seoAudit.ts` to use `findKeywordGaps` for proper similarity matching
- **Status:** ✅ Fixed and committed

### 2. Title Extraction
**Issue:** Only 3 unique titles for 20 pages (all showing "About – Linear")  
**Root Cause:** Extracting from initial HTML instead of rendered DOM  
**Fix Applied:**
- Already fixed in previous iteration: `renderedTitle` extracted from rendered DOM
- **Status:** ✅ Already fixed (needs verification in new audit)

### 3. Accessibility Scoring
**Issue:** Score 14/100 with only 1 issue reported  
**Root Cause:** Scoring formula too harsh, double-penalizing  
**Fix Applied:**
- Already rebalanced in previous iteration
- **Status:** ✅ Already fixed (needs verification in new audit)

### 4. Duplicate Counts
**Issue:** Duplicate title counts don't match (issues=17, siteWide=19)  
**Root Cause:** Different counting logic in different sections  
**Fix Applied:**
- Already fixed in previous iteration: uses single source of truth
- **Status:** ✅ Already fixed (needs verification in new audit)

---

## 🔍 Issues Identified (Pending Verification)

### 1. PageSpeed API Data Missing
**Symptom:** 0/20 pages have PageSpeed data  
**Possible Causes:**
- API timeout (60s might not be enough for complex sites)
- API quota exceeded
- Network/connection issues
- Error handling not catching all failure modes

**Verification Needed:**
- Check if PageSpeed API is actually being called for main page
- Verify error logs show timeout/quota errors
- Test API directly (already tested - works for example.com)

**Next Steps:**
- Wait for new audit to complete
- Check logs for PageSpeed API errors
- If still failing, increase timeout or add retry logic

### 2. Schema Detection
**Symptom:** Reports "Missing schema markup" on 20 pages  
**Possible Causes:**
- Linear.app might actually not have schema (needs verification)
- JS-rendered schema not being extracted correctly
- Schema extraction timing issue

**Verification Needed:**
- Manually check if Linear.app has schema (curl didn't find it in initial HTML)
- Verify `schemaScripts` extraction is working
- Check if schema is injected after page load (timing issue)

**Next Steps:**
- Wait for new audit to complete
- Check if `hasSchemaMarkup` is true for any pages
- If false positives, improve schema detection logic

### 3. Content Analysis Consistency
**Symptom:** Thin content count mismatch (issues=6, pages<300 words=3)  
**Possible Causes:**
- Different word count extraction methods
- Different thresholds for thin content detection
- Template content being counted differently

**Verification Needed:**
- Check word count extraction consistency
- Verify thin content threshold (300 words?)
- Ensure same extraction method used everywhere

**Next Steps:**
- Wait for new audit to complete
- Compare word counts in page table vs thin content issues
- Standardize extraction if needed

---

## 📊 Evaluation Framework

### Quality Score Calculation (0-10)

**Starting Score:** 10

**Deductions:**
- High severity issue: -2 points
- Medium severity issue: -1 point
- Low severity issue: -0.5 points
- Missing PageSpeed data: -1.5 points
- Missing competitor data: -1.5 points
- Schema detection issues: -1 point

**Current Estimated Score:** 0/10 (based on old audit)

**Target Score:** 10/10

---

## 🔄 Iteration Plan

### Iteration 1 (Current)
1. ✅ Fix competitor analysis keyword gaps
2. ⏳ Wait for audit completion
3. ⏳ Evaluate new audit
4. ⏳ Fix remaining issues

### Iteration 2 (If needed)
1. Fix PageSpeed API integration
2. Fix schema detection (if false positives)
3. Fix content analysis consistency
4. Re-run audit and evaluate

### Iteration 3+ (Until 10/10)
- Continue fixing issues identified in evaluation
- Re-run audit after each fix
- Verify improvements with each iteration

---

## 📝 Notes

- Audit is currently running (started at 20:01:57 UTC)
- Background monitoring script is active
- Evaluation will run automatically when audit completes
- All fixes are committed to git

---

## 🚀 Next Actions

1. **Wait for audit completion** (estimated 5-15 more minutes)
2. **Run comprehensive evaluation** using `scripts/comprehensiveAuditEvaluation.ts`
3. **Review evaluation results** and identify remaining issues
4. **Fix highest priority issues** first
5. **Re-run audit** and repeat until score reaches 10/10

---

*Last Updated: 2025-11-24 20:15 UTC*

