# Changelog

## [Unreleased] - Major Updates (2025-11-22)

### Latest: AI-Powered Competitor Detection & Report Quality Assurance (2025-11-23)

#### Added
- **DeepSeek AI-Powered Competitor Detection** (`lib/deepseekCompetitorDetection.ts`)
  - Automatically classifies website industry/niche using DeepSeek LLM
  - Generates real competitor URLs based on detected industry
  - Validates competitor URLs via HEAD requests before crawling
  - Falls back to OpenAI GPT-4o-mini if DeepSeek unavailable
  - Multi-layer fallback: DeepSeek → OpenAI → Industry Taxonomy → Pattern-based
  - Integrated into competitor analysis workflow when no URLs provided
  - Environment variable: `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`

- **Report Quality Assurance Module** (`lib/reportValidation.ts`)
  - Validates issue aggregation accuracy (summary vs actual issues)
  - Checks crawl completeness against tier limits
  - Validates readability formula correctness
  - Validates keyword extraction quality
  - Checks narrative/score consistency
  - Generates validation reports with fixable issues
  - Automatic fix loop in `scripts/runAuditAndEmail.ts` (up to 3 attempts)

- **Enhanced LLM Readability Analysis** (`lib/llmReadability.ts`)
  - Fixed rendering percentage calculation (similarity-based when rendered < initial)
  - Added detailed content analysis (text increase percentage, critical elements)
  - Added hydration issue detection (content missing with JS disabled)
  - Added Shadow DOM analysis (detection and recommendations)
  - Added script bundle analysis (large bundles, render-blocking scripts)
  - Pre-rendered vs post-rendered comparison for critical elements

#### Changed
- **Issue Aggregation**: Fixed critical bug where report showed "0 issues" despite low scores
  - Changed from `categorizeIssues()` function to direct array filtering
  - Issues now correctly populate in all categories (Technical, On-page, Content, etc.)
  - Summary counts now match actual issue arrays

- **Rendering Percentage Calculation**: Fixed inverted math for similarity-based rendering
  - When rendered HTML < initial HTML: uses similarity directly (99.7% similarity = 99.7% rendering)
  - When rendered HTML >= initial HTML: uses percentage increase
  - Correctly displays 99.7% instead of 0.3%, 100% instead of 0%

- **Competitor Analysis**: Enhanced with AI-powered auto-detection
  - Automatically detects industry when no competitor URLs provided
  - Generates and validates competitor URLs before crawling
  - Better logging and error handling

- **Report Validation**: Integrated into audit workflow
  - Automatic validation after each audit run
  - Automatic fixes applied for fixable issues
  - Re-runs audit up to 3 times until validation passes

#### Fixed
- Fixed "0 issues" bug in reports (issue aggregation now works correctly)
- Fixed rendering percentage showing 0% when similarity was 99.7%+
- Fixed keyword extraction garbage tokens (HTML entity decoding)
- Fixed issue count mismatches between summary and detailed sections
- Fixed priority action plan showing "No issues" when issues existed
- Fixed site-wide issues being filtered out (preserved issues without affectedPages)

#### Technical Improvements
- **Report QA Module**: Comprehensive validation system for audit reports
- **DeepSeek Integration**: AI-powered competitor detection with graceful fallbacks
- **Enhanced Diagnostics**: Agency tier includes Shadow DOM, hydration, and script bundle analysis
- **Automatic Fix Loop**: Self-healing audit system that fixes and re-runs until quality threshold met

---

### Previous: Production-Ready Improvements (Sprint 1-3 Complete)

#### Added
- **Crawl Diagnostics Module** (`lib/crawlDiagnostics.ts`)
  - Detects crawl status (success/partial/failed)
  - Platform detection (Wix, WordPress, Squarespace, Shopify, custom)
  - Identifies specific issues (404s, parking pages, robots.txt blocking, JS-heavy sites)
  - Generates actionable recommendations
  - Provides user-friendly status messages

- **Local SEO Analysis Module** (`lib/localSEO.ts`)
  - NAP (Name, Address, Phone) extraction and consistency checking
  - Local schema markup analysis (LocalBusiness, Organization)
  - Service area / city landing page detection
  - Local keyword analysis (location + service keywords)
  - Google Business Profile indicators (maps, reviews, links)
  - Weighted scoring algorithm (0-100)
  - 8+ issue types with detailed fixes
  - Comprehensive recommendations

- **Platform-Specific Instructions** (`lib/platformInstructions.ts`)
  - Wix-specific fix instructions (10+ issue types)
  - WordPress-specific fix instructions (10+ issue types)
  - Squarespace-specific fix instructions (10+ issue types)
  - Shopify-specific fix instructions (10+ issue types)
  - Generic fallback for custom platforms
  - Automatic platform detection and instruction selection
  - Replaces generic "consult web server docs" messages

#### Changed
- **404 Page Filtering**: Error pages (4xx/5xx) are now excluded from SEO analysis
- **URL Deduplication**: Duplicate URLs (www vs non-www, redirects) are automatically removed
- **Keyword Extraction**: HTML entity decoding ensures clean, readable keywords (no more "tconne cted" garbage)
- **Social Media Detection**: Accurately filters out favicon URLs to prevent false positives
- **Issue Deduplication**: Automatically merges duplicate issues for cleaner reports
- **Competitor Analysis**: Better logging and graceful fallback when crawling fails
- **Fix Instructions**: All issues now include platform-specific step-by-step instructions

#### Fixed
- Fixed favicon URLs being detected as social media profiles (e.g., `https://x.com/favicon`)
- Fixed duplicate issues appearing in reports (e.g., "Title too short" appearing twice)
- Fixed duplicate URLs in page-level table
- Fixed garbage keywords from HTML entities
- Fixed 404 pages being audited for SEO issues
- Fixed empty competitor analysis sections without explanation
- Fixed generic "consult web server docs" instructions

#### Technical Improvements
- **Modular Architecture**: Separated concerns into dedicated modules
  - `lib/crawlDiagnostics.ts` - Crawl analysis
  - `lib/localSEO.ts` - Local SEO analysis
  - `lib/platformInstructions.ts` - Platform-specific instructions
  - `lib/urlNormalizer.ts` - URL handling
  - `lib/titleMetaExtractor.ts` - Title/meta extraction
  - `lib/performanceValidator.ts` - Performance validation
  - `lib/scoring.ts` - Scoring logic
  - `lib/realCompetitorAnalysis.ts` - Competitor analysis
- **Type Safety**: Full TypeScript support throughout
- **Error Handling**: Comprehensive error handling and logging
- **Code Quality**: 0 linter errors, clean architecture

---

## [Previous] - Latest Features (2025-01-XX)

### Latest: PageSpeed Insights & Social Media Integration

#### Added
- **Google PageSpeed Insights API Integration** (`lib/pagespeed.ts`)
  - Fetches Core Web Vitals (LCP, INP, CLS, FCP, TTFB) for mobile and desktop
  - Extracts optimization opportunities with potential savings (e.g., "Remove unused CSS - saves 1,234ms")
  - Shows top 5 opportunities in PDF reports
  - Free API: 25,000 requests/day
  - Test with: `npm run test-pagespeed`

- **HTTP/2 & HTTP/3 Detection** (`lib/technical.ts`)
  - Detects HTTP version (HTTP/1.1, HTTP/2, HTTP/3)
  - Checks Alt-Svc header for HTTP/3 support
  - Generates low-severity issue if using HTTP/1.1

- **Compression Detection** (`lib/technical.ts`)
  - Detects GZIP and Brotli compression support
  - Generates medium-severity issue if no compression
  - Generates low-severity issue if GZIP but not Brotli

- **Social Media Presence Checker** (`lib/social.ts`)
  - Detects Open Graph tags (og:title, og:description, og:image, og:url, og:type)
  - Detects Twitter Card tags (twitter:card, twitter:title, twitter:description, etc.)
  - Extracts social media links (Facebook, Twitter, Instagram, YouTube, LinkedIn, TikTok)
  - Detects Facebook Pixel (fbq, facebook.com/tr)
  - Detects favicon (favicon.ico, <link rel="icon">)
  - Generates issues for missing OG/Twitter tags and favicon
  - New "Social Media Presence" section in PDF reports

#### Changed
- **Performance Metrics**: Now uses PageSpeed Insights data when available (more accurate than Puppeteer metrics)
- **PDF Reports**: Added "Performance Opportunities" section showing optimization recommendations
- **PDF Reports**: Added "Social Media Presence" section with comprehensive social checks
- **robots.txt Check**: Now generates a formal low-severity Technical issue (not just site-wide data)
- **Core Web Vitals Section**: Updated to prefer PageSpeed data, shows opportunities directly

#### Fixed
- Fixed `ReferenceError: httpVersion is not defined` in `parseHtml` function
- Fixed PageSpeed API integration to properly load environment variables in test scripts

---

## [Previous] - Phase 1 & 2 Upgrades Complete

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

