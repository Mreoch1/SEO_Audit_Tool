# Changelog

## [Unreleased] - Phase 1 & 2 Upgrades Complete

### Phase 2: Advanced Features (Completed)

#### Added
- **LLM Readability Analysis** (`lib/llmReadability.ts`)
  - Measures rendering percentage (initial HTML vs rendered HTML)
  - Detects high rendering percentage (>100%) as potential issue
  - Flags dynamically rendered content that LLMs may miss
  - Capped display at 10,000%+ for extreme values
  
- **Enhanced Schema Detection** (`lib/schemaAnalyzer.ts`)
  - Detects Identity Schema (Organization/Person)
  - Validates required fields (name, url for Organization)
  - Identifies missing or incomplete Identity Schema
  - Generates actionable recommendations
  
- **Real Competitor Analysis**
  - Accepts competitor URLs as input via API
  - Crawls competitor sites (up to 5 pages)
  - Extracts real keywords from competitor content
  - Compares against audited site to find keyword gaps
  - Identifies shared keywords
  - Falls back to pattern-based analysis if no competitor URLs provided

#### Changed
- **PDF Reports**: Now includes Performance Metrics, LLM Readability, and Enhanced Schema Analysis sections
- **Competitor Analysis**: Shows real competitor URLs when provided, otherwise uses pattern-based analysis
- **Page-Level Table**: Added Links column and Load Time with LCP metric
- **Fix Instructions**: Added instructions for LCP, CLS, FID/TBT, TTFB, LLM Readability, and Identity Schema

#### Fixed
- Rendering percentage display for extreme values (>10,000%)
- Core Web Vitals collection improved with longer wait times and double-checking
- CLS metric now properly handles 0 values
- FCP fallback using paint entries

### Phase 1: Core Engine Upgrade (Completed)

#### Added
- **JavaScript Rendering Engine** (`lib/renderer.ts`)
  - Full page rendering with Puppeteer
  - JavaScript execution support
  - Detects dynamically loaded content
  - Browser instance reuse for performance
  
- **Enhanced Image Detection**
  - Detects lazy-loaded images (`data-src`, `loading="lazy"`)
  - Detects CSS background images
  - Detects `<picture>` and `<source>` elements
  - Detects images in data attributes
  - Analyzes images from fully rendered DOM
  
- **Enhanced Link Detection**
  - Detects JS-generated links
  - Detects button-based navigation (onclick handlers)
  - Properly distinguishes internal vs external links
  - Analyzes links from fully rendered DOM
  
- **Core Web Vitals Measurement** (`lib/performance.ts`)
  - LCP (Largest Contentful Paint)
  - FID (First Input Delay)
  - CLS (Cumulative Layout Shift)
  - TBT (Total Blocking Time)
  - FCP (First Contentful Paint)
  - TTFB (Time to First Byte)
  - Improved collection with longer wait times and retry logic
  
- **Performance Issue Generation**
  - Automatic issue generation based on CWV thresholds
  - Actionable recommendations for performance problems
  - Severity levels (High/Medium) based on CWV scores

#### Changed
- **Page Analysis**: Now uses Puppeteer rendering instead of basic fetch
- **Load Time**: Now measures actual render time (5-15s typical) instead of fetch time (~50ms)
- **Image Detection**: Now detects all images including JS-rendered ones
- **Link Detection**: Now detects all links including JS-generated ones
- **Performance Issues**: Now populated with real CWV-based issues
- **API Route**: Added `competitorUrls` parameter support

#### Fixed
- Fixed `imageCount: 0` on JS-heavy sites
- Fixed `internalLinkCount: 0` on JS-heavy sites
- Fixed unrealistic load times (56ms → realistic 5-15s)
- Fixed empty `performanceIssues` array
- Fixed rendering percentage display for extreme values

### Technical Details
- Browser instance reuse for performance
- Fallback to basic fetch if rendering fails
- 30-second timeout per page
- Performance metrics integrated into `PageData` type
- LLM Readability integrated into `PageData` type
- Enhanced Schema Analysis integrated into `PageData` type
- Competitor URLs added to `AuditOptions` type

