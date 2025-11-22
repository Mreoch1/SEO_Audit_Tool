# SEO Audit App

A production-ready web application and CLI tool for performing automated SEO site audits and generating white-label PDF reports.

## Features

- **Automated SEO Auditing**: Crawls websites and identifies technical, on-page, content, and accessibility issues
- **JavaScript Rendering**: Uses Puppeteer to render pages with full JS execution, detecting dynamically loaded content
- **Core Web Vitals**: Measures LCP, INP, CLS, TBT, FCP, and TTFB via Google PageSpeed Insights API (free)
- **Performance Opportunities**: Shows top optimization opportunities with potential time savings (e.g., "Remove unused CSS - saves 1,234ms")
- **HTTP/2 & HTTP/3 Detection**: Automatically detects HTTP version (HTTP/1.1, HTTP/2, HTTP/3)
- **Compression Detection**: Checks for GZIP and Brotli compression support
- **Social Media Presence**: Detects Open Graph tags, Twitter Cards, social media links, Facebook Pixel, and favicons. Accurately filters out favicon URLs to prevent false positives.
- **Advanced Image Detection**: Detects lazy-loaded images, background images, picture elements, and CSS images
- **Enhanced Link Detection**: Finds JS-generated links, button-based navigation, and dynamically created anchors
- **Tier-Based Audits**: Three service tiers (Starter, Standard, Advanced) with different page limits and features
- **Optional Add-Ons**: Six paid add-ons including Fast Delivery, Additional Pages, Keywords, Image Alt Tags, Schema Markup, and Competitor Analysis
- **White-Label PDF Reports**: Generate branded PDF reports with tier and add-ons clearly displayed
- **Detailed Analysis**: 
  - **Google PageSpeed Insights Integration**: Industry-standard Core Web Vitals + optimization opportunities
  - **HTTP/2 & Compression Checks**: Technical performance indicators
  - **Social Media Optimization**: Open Graph tags, Twitter Cards, Facebook Pixel, social links
  - **Schema markup detection**: JSON-LD and microdata with Identity Schema validation
  - **Identity Schema detection**: Organization/Person with required field validation
  - **LLM Readability analysis**: Unique feature detecting dynamically rendered content that LLMs may miss
  - **Keyword extraction**: From titles, headings, and meta descriptions
  - **Image alt tag optimization**: Detailed analysis with specific recommendations
  - **Real competitor analysis**: Crawls competitor URLs and extracts real keywords (not generic patterns)
  - **Local SEO analysis**: NAP consistency, LocalBusiness schema, service area pages, local keywords, GBP indicators
  - **Crawl diagnostics**: Platform detection (Wix, WordPress, Squarespace, Shopify), crawl status reporting, actionable recommendations
  - **Platform-specific instructions**: Automatically provides step-by-step fix instructions tailored to detected platform
  - **Issue deduplication**: Automatically merges duplicate issues for cleaner reports
  - **URL deduplication**: Removes duplicate URLs (www vs non-www, redirects) for accurate page-level reporting
  - **404 page filtering**: Excludes error pages from SEO analysis to ensure accurate scoring
  - **Clean keyword extraction**: HTML entity decoding ensures readable, meaningful keywords
  - **Priority action plan**: Week-by-week recommendations based on severity
  - **Performance issues**: Based on Core Web Vitals thresholds and PageSpeed opportunities
- **Scheduled Audits**: Set up recurring audits with cron expressions
- **Email Reports**: Automatically email PDF reports to clients
- **CLI Tool**: Run audits from the command line with tier and add-on support
- **Admin Dashboard**: Manage audits, view results, and configure settings

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: SQLite (default, easily switchable to Postgres)
- **PDF Generation**: Puppeteer
- **Page Rendering**: Puppeteer (for JavaScript execution and Core Web Vitals)
- **Email**: Nodemailer
- **Auth**: NextAuth.js (Credentials provider)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: Database connection string (default: `file:./dev.db`)
- `NEXTAUTH_URL`: Your app URL (default: `http://localhost:3000`)
- `NEXTAUTH_SECRET`: Secret key for NextAuth (generate a random string)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: SMTP settings for email

Optional variables:
- `PAGESPEED_INSIGHTS_API_KEY`: Google PageSpeed Insights API key (enables Core Web Vitals analysis)
  - See `PAGESPEED_API_SETUP.md` for setup instructions
  - Free tier: 25,000 requests/day
  - Test with: `npm run test-pagespeed`

### 3. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

### 4. Create Admin User

Create your first admin user:

```bash
npm run create-user -- --email=admin@example.com --password=your-secure-password
```

Or use Prisma Studio:

```bash
npm run db:studio
```

### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with your admin credentials.

## Usage

### Web Interface

1. **Login**: Access the admin dashboard at `/login`
2. **New Audit**: Go to `/audits/new` to create a new SEO audit
   - Select a tier: **Starter** ($39, 3 pages), **Standard** ($89, 20 pages), or **Advanced** ($149, 50 pages)
   - Add optional add-ons:
     - Fast Delivery (+$25): 24-hour delivery
     - Additional Pages (+$10/page): Increase page limit
     - Additional Keywords (+$5/keyword): More keyword research
     - Image Alt Tags (+$15): Detailed alt tag analysis
     - Schema Markup (+$30): Schema markup detection
     - Competitor Analysis (+$39): Keyword gap report
3. **View Results**: Click on any audit to see detailed results with tier and add-ons displayed
4. **Download PDF**: Click "Download PDF" to get a comprehensive report with:
   - Service tier and add-ons clearly listed
   - Priority action plan (Week 1: High priority, Week 2: Medium priority)
   - Detailed fix instructions for each issue
   - Image alt tag analysis (if add-on purchased)
   - Competitor keyword gap analysis (if add-on purchased)
5. **Email Report**: Click "Email Report" to send the PDF via email
6. **Settings**: Configure branding and SMTP settings at `/settings`
7. **Scheduled Audits**: Set up recurring audits at `/scheduled-audits`

### CLI Tool

Run a single audit:

```bash
# Basic audit
npm run audit -- --url=https://example.com

# With tier (automatically sets page limits)
npm run audit -- --url=https://example.com --tier=standard

# With add-ons
npm run audit -- --url=https://example.com --tier=advanced --addOns='{"imageAltTags":true,"schemaMarkup":true}'
```

Options:
- `--url`: Target URL (required)
- `--tier`: Service tier - `starter` (3 pages), `standard` (20 pages), or `advanced` (50 pages)
- `--maxPages`: Maximum pages to crawl (overrides tier limit if set)
- `--maxDepth`: Maximum crawl depth (default: 2-5 based on tier)
- `--addOns`: JSON object with add-on options:
  - `fastDelivery`: boolean
  - `additionalPages`: number
  - `additionalKeywords`: number
  - `imageAltTags`: boolean
  - `schemaMarkup`: boolean
  - `competitorAnalysis`: boolean
- `--emailTo`: Email address to send PDF to
- `--output`: Local path to save PDF (e.g., `./reports/audit.pdf`)

### Scheduled Audits

Set up a cron job to run scheduled audits:

```bash
# Add to crontab (runs every 15 minutes)
*/15 * * * * cd /path/to/seo-audit-app && npm run runScheduledAudits
```

Or use systemd timer, PM2, or any other process manager.

## Project Structure

```
seo-audit-app/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── audits/        # Audit CRUD operations
│   │   ├── settings/      # Settings management
│   │   └── scheduled-audits/ # Scheduled audit management
│   ├── audits/            # Audit pages
│   │   ├── new/           # New audit with tier/add-on selection
│   │   └── [id]/          # Audit detail page
│   ├── login/             # Login page
│   ├── settings/          # Settings page
│   ├── scheduled-audits/  # Scheduled audits management
│   └── layout.tsx          # Root layout
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── Dashboard.tsx     # Main dashboard component
├── lib/                   # Core libraries
│   ├── seoAudit.ts       # SEO audit engine (tier support, add-ons)
│   ├── reportSummary.ts  # Summary builder (priority action plan)
│   ├── pdf.ts            # PDF generation (tier/add-ons display)
│   ├── types.ts          # TypeScript types (tiers, add-ons)
│   ├── auth.ts           # NextAuth configuration
│   ├── email.ts          # Email sending utilities
│   └── db.ts             # Prisma client
├── prisma/                # Prisma schema
│   └── schema.prisma
├── scripts/               # CLI scripts
│   ├── runAudit.ts        # Manual audit runner (tier/add-on support)
│   ├── runScheduledAudits.ts # Scheduled audit processor
│   └── createUser.ts     # Admin user creation
└── public/                # Static assets
```

## Database Models

- **User**: Admin users for authentication
- **Audit**: SEO audit results with scores, summaries, tier, and add-ons (stored in rawJson)
- **AuditIssue**: Individual issues found during audits
- **ScheduledAudit**: Recurring audit configurations
- **AppSettings**: Branding and SMTP settings

## Key Features Explained

### Tier-Based Audits

Tiers automatically set page limits and enable features:
- **Starter**: Basic audit, 3 pages max
- **Standard**: Full audit with schema detection, 20 pages, 5 keywords
- **Advanced**: Complete audit with action plan, 50 pages, 10 keywords

### Add-Ons System

Add-ons enhance the audit with additional analysis:
- **Image Alt Tags**: Re-analyzes pages to provide detailed alt tag recommendations
- **Competitor Analysis**: Generates keyword gap analysis based on common SEO patterns
- **Schema Markup**: Enables detailed schema markup detection and issues
- **Additional Pages/Keywords**: Extends tier limits

### Priority Action Plan

The PDF includes a prioritized action plan:
- **Week 1**: High-priority issues (red) - fix first
- **Week 2**: Medium-priority issues (orange) - fix next
- Includes extracted keywords (Standard/Advanced tiers or with add-ons)

### Fix Instructions

Every issue in the PDF includes:
- What's wrong (issue description)
- How to fix (step-by-step instructions)
  - **Platform-specific**: Automatically detects platform (Wix, WordPress, Squarespace, Shopify) and provides tailored instructions
  - **Generic fallback**: Server-level examples (Apache/Nginx) for custom platforms
- Affected pages (which pages need fixing)
- Code examples where applicable

## Service Tiers

The app supports three service tiers with different features:

### Starter ($39)
- **Pages**: Up to 3 pages
- **Depth**: 2 levels
- **Keywords**: 0 (basic extraction only)
- **Features**: Basic audit, technical checks, on-page analysis

### Standard ($89)
- **Pages**: Up to 20 pages
- **Depth**: 3 levels
- **Keywords**: 5 extracted keywords
- **Features**: Full audit, schema markup detection, keyword extraction

### Advanced ($149)
- **Pages**: Up to 50 pages
- **Depth**: 5 levels
- **Keywords**: 10 extracted keywords
- **Features**: Complete audit, priority action plan, all advanced features

## Optional Add-Ons

### Fast Delivery (+$25)
- 24-hour delivery guarantee
- Visual indicator in PDF and web reports

### Additional Pages (+$10/page)
- Increases the page limit beyond tier limits
- Example: Standard (20) + 5 pages = 25 total pages

### Additional Keywords (+$5/keyword)
- Increases keyword extraction count
- Example: Standard (5) + 3 keywords = 8 total keywords

### Image Alt Tags (+$15)
- Detailed analysis of up to 100 images
- Identifies missing, too short, too long, or generic alt text
- Provides specific recommendations for each image
- Dedicated PDF section and web tab

### Schema Markup (+$30)
- Detects JSON-LD and microdata schema markup
- Identifies pages missing structured data
- Provides fix instructions for schema implementation

### Competitor Keyword Gap Analysis (+$39)
- Analyzes keyword opportunities vs. competitors
- Identifies keyword gaps (opportunities)
- Shows shared keywords
- Provides actionable recommendations
- Dedicated PDF section and web tab

## Scoring System

The SEO audit generates scores (0-100) for:

- **Technical SEO**: Crawlability, status codes, robots.txt, sitemap.xml, schema markup
- **On-Page SEO**: Titles, meta descriptions, H1/H2 usage, canonical tags
- **Content Quality**: Word count, thin pages, content depth
- **Accessibility**: Alt tags, mobile friendliness, viewport tags

Overall score is a weighted average of these categories.

## PDF Report Contents

Each PDF report includes:

1. **Cover Page**: Branding, overall score, tier badge
2. **Service Details**: Tier description and all purchased add-ons
3. **Executive Summary**: Comprehensive overview of findings
4. **Priority Action Plan**: Week-by-week recommendations (High → Medium → Low priority)
5. **Technical Issues**: Technical SEO problems with fix instructions
6. **On-Page Issues**: SEO optimization opportunities
7. **Content Issues**: Content quality problems
8. **Accessibility Issues**: WCAG compliance problems
9. **Performance Issues**: Core Web Vitals and performance problems
10. **Image Alt Tags Analysis**: (If add-on purchased) Detailed alt tag recommendations
11. **Performance Metrics (Core Web Vitals)**: LCP, INP, CLS, FCP, TTFB + **Optimization Opportunities**
12. **LLM Readability Analysis**: Unique rendering percentage analysis
13. **Social Media Presence**: Open Graph, Twitter Cards, social links, favicon detection (with accurate filtering)
14. **Schema Markup Analysis**: Identity Schema detection and validation
15. **Local SEO Analysis**: NAP consistency, LocalBusiness schema, service area pages, local keywords, GBP indicators, scoring
16. **Crawl Diagnostics**: Platform detection, crawl status, recommendations for crawl issues
17. **Competitor Keyword Gap**: (If add-on purchased) Real keyword opportunities and gaps
18. **Page-Level Findings**: Table of all scanned pages with metrics (no duplicates)
19. **Raw Data**: Complete audit data in JSON format

## Customization

### Branding

Update branding in the Settings page (`/settings`):
- Brand name and subtitle
- Primary color
- Logo upload

These settings are used in PDF reports and appear on the cover page.

### Tier Configuration

Edit `lib/seoAudit.ts` → `getTierLimits()` to adjust tier page limits and depth:
- Starter: 3 pages, depth 2
- Standard: 20 pages, depth 3
- Advanced: 50 pages, depth 5

### Add-On Pricing

Update add-on prices in `app/audits/new/page.tsx` → `addOnInfo` object.

### Scoring Weights

Edit `lib/seoAudit.ts` → `calculateScores()` to adjust scoring weights. The scoring function is well-documented with comments.

### Report Template

Customize the PDF template in `lib/pdf.ts` → `generateReportHTML()`. The template includes:
- Cover page with tier badge
- Service details page
- Priority action plan
- Issue sections with fix instructions
- Add-on-specific sections (Image Alt Tags, Competitor Analysis)

## Testing

Run tests:

```bash
npm test
```

Tests cover:
- Scoring functions
- Summary builder
- Crawler logic (mocked)
- Tier limits
- Add-on functionality

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a production database (Postgres recommended)
3. Set secure `NEXTAUTH_SECRET`
4. Configure production SMTP settings
5. Build: `npm run build`
6. Start: `npm start`

## License

MIT

