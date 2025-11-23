# SEO Audit Pro - Feature Overview

SEO Audit Pro is a comprehensive, self-hosted SEO auditing platform designed to provide enterprise-grade insights without the enterprise price tag. It combines advanced crawling, rendering, and analysis engines to deliver actionable reports.

## 🚀 Core Capabilities

### 1. Deep Crawling & Rendering
*   **JavaScript Rendering:** Uses a headless browser (Puppeteer) to execute JavaScript, ensuring modern React/Vue/Angular sites are audited correctly.
*   **Smart Crawling:** Configurable depth and page limits (up to 500 pages) to map out site structure.
*   **Internal Link Analysis:** Maps internal link structures to find orphans and broken paths.
*   **Status Code Checks:** Identifies 404s, 500s, and redirect chains.

### 2. Technical SEO Analysis
*   **Core Web Vitals:** Measures real-world performance metrics (LCP, CLS, FID) via Google PageSpeed Insights API.
*   **Schema Markup Detection:** Validates JSON-LD and Microdata structured data (including Identity, Organization, and Article schemas).
*   **Canonicalization:** Checks for self-referencing canonicals and duplicate content risks.
*   **Meta Tag Validation:** Audits titles, descriptions, and viewport settings for length and presence.
*   **SSL & Security:** Verifies HTTPS implementation and mixed content issues.
*   **Mobile Friendliness:** Checks viewport configuration and mobile responsiveness.
*   **Crawl Diagnostics:** Detects crawl failures, identifies platform (Wix, WordPress, Squarespace, Shopify), and provides actionable recommendations.
*   **404 Page Filtering:** Automatically excludes error pages from SEO analysis to ensure accurate scoring.
*   **URL Deduplication:** Removes duplicate URLs (www vs non-www, redirects) for clean page-level reporting.

### 3. On-Page SEO & Content Quality
*   **Keyword Extraction:** Uses NLP to identify primary and secondary topics from page content. HTML entity decoding ensures clean, readable keywords.
*   **Content Structure:** Audits Heading (H1-H6) hierarchy for logical flow.
*   **Readability Scoring:** Calculates Flesch Reading Ease scores to ensure content is accessible to the target audience. Integrated into content quality scoring.
*   **Thin Content Detection:** Flags pages with low word counts that may provide little value.
*   **Image Optimization:** Checks for missing Alt text, broken images, and large file sizes.
*   **Issue Deduplication:** Automatically merges duplicate issues to provide clean, actionable reports.

### 4. 🏆 Automated Competitor Intelligence
*   **DeepSeek AI-Powered Detection:** Uses DeepSeek LLM to automatically analyze the website and identify the industry/niche when no competitor URLs are provided.
*   **Smart Competitor Discovery:** Generates real competitor URLs based on detected industry, validates them, and crawls up to the tier's page limit per competitor.
*   **Real Competitor Crawling:** Live-crawls top competitors in that niche to extract their actual keyword strategies.
*   **Keyword Gap Analysis:** Identifies high-value keywords your competitors are using but you are missing.
*   **Opportunity Discovery:** Highlights "low hanging fruit" keywords to target.
*   **Multi-Layer Fallback:** Falls back to industry taxonomy if DeepSeek is unavailable, then to pattern-based suggestions if competitor crawling fails.
*   **URL Validation:** Automatically validates competitor URLs before crawling to ensure they're reachable.

### 5. 🏢 Local SEO Analysis (New!)
*   **NAP Consistency:** Extracts and validates Name, Address, Phone data across all pages.
*   **Local Schema Detection:** Identifies LocalBusiness and Organization schema markup with field validation.
*   **Service Area Pages:** Detects city-specific and service-area landing pages.
*   **Local Keywords:** Analyzes location-based and service keywords in content.
*   **Google Business Profile Indicators:** Detects Google Maps embeds, review widgets, and GBP links.
*   **Scoring & Recommendations:** Provides 0-100 local SEO score with actionable recommendations.

### 6. Accessibility & Best Practices
*   **WCAG Checks:** Basic accessibility validation (alt text, contrast ratios).
*   **Social Signals:** Verifies Open Graph (OG) and Twitter Card tags for social sharing. Accurately detects social media profiles (filters out favicon URLs).
*   **Robots & Sitemaps:** Validates `robots.txt` and `sitemap.xml` availability.

## 📊 Reporting & Deliverables

*   **Interactive Dashboard:** View audit progress and results in real-time.
*   **Professional PDF Reports:** Generates white-label ready PDF reports with:
    *   Executive Summary
    *   Priority Action Plan (High/Medium/Low)
    *   Detailed Issue Breakdown with "How to Fix" guides
    *   Visual Scorecards (0-100)
    *   Local SEO Analysis Section
    *   Crawl Diagnostics & Platform Detection
*   **Platform-Specific Instructions:** Automatically detects platform (Wix, WordPress, Squarespace, Shopify) and provides step-by-step fix instructions tailored to each platform.
*   **Email Delivery:** Send reports directly to clients via SMTP (supports Zoho, Gmail, etc.) with custom branding.
*   **Branding:** Fully customizable logo, brand name, and color scheme for reports.

## 🛠️ Technical Specs

*   **Local-First:** Runs locally on your machine (Mac/Windows/Linux) to avoid cloud costs.
*   **Database:** Uses SQLite for zero-config local data storage.
*   **Privacy:** All data stays on your machine; no third-party tracking.
*   **Architecture:** Built on Next.js 14, Node.js, and Puppeteer for high performance.
