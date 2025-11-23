# Critical Fixes V2 - Implementation Plan

Based on NASA 20-page audit sample review.

## ✅ FIXED

1. **CMS-specific recommendations** - Fixed platform detection to be more strict, added government site detection

## 🔄 IN PROGRESS

2. **Schema logic conflict** - Need to merge schema detection across all pages
3. **Title length logic** - Need contextual rules (homepage brand names OK, news 35-60)
4. **Thin content detection** - Already fixed but need to verify rendered DOM extraction
5. **Readability scoring** - Need to extract only from <main>/<article>
6. **Identity Schema detection** - Need to merge results from all pages
7. **Competitor analysis** - Already has conditional logic, need to verify

## 📋 TODO

8-19. Medium and low priority fixes

