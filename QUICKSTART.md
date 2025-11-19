# Quick Start Guide

## Initial Setup (5 minutes)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your NEXTAUTH_SECRET (generate a random string)
   ```

3. **Initialize database:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Create admin user:**
   ```bash
   npm run create-user -- --email=admin@example.com --password=yourpassword
   ```

5. **Start the app:**
   ```bash
   npm run dev
   ```

6. **Login and start auditing:**
   - Visit http://localhost:3000
   - Login with your credentials
   - Go to "New Audit" and enter a URL
   - Select a tier (Starter/Standard/Advanced)
   - Add optional add-ons if needed
   - Click "Run [Tier] Audit"

## Service Tiers

- **Starter** ($39): 3 pages, basic audit
- **Standard** ($89): 20 pages, 5 keywords, schema detection
- **Advanced** ($149): 50 pages, 10 keywords, priority action plan

## Optional Add-Ons

- **Fast Delivery** (+$25): 24-hour delivery
- **Additional Pages** (+$10/page): Increase page limit
- **Additional Keywords** (+$5/keyword): More keyword research
- **Image Alt Tags** (+$15): Detailed alt tag analysis
- **Schema Markup** (+$30): Schema markup detection
- **Competitor Analysis** (+$39): Keyword gap report

## First Audit via CLI

```bash
# Basic audit
npm run audit -- --url=https://example.com

# With tier
npm run audit -- --url=https://example.com --tier=standard

# With add-ons
npm run audit -- --url=https://example.com --tier=advanced --addOns='{"imageAltTags":true}'
```

## Set Up Scheduled Audits (Cron)

Add to your crontab (runs every 15 minutes):

```bash
*/15 * * * * cd /path/to/seo-audit-app && npm run runScheduledAudits
```

## Configure Email (Optional)

1. Go to Settings page in the web UI
2. Enter your SMTP credentials
3. Test with "Send Test Email" button

## Customize Branding

1. Go to Settings page
2. Update brand name, color, and logo
3. These will appear in all PDF reports (cover page, headers, etc.)

## Understanding Audit Results

### PDF Report Sections

1. **Cover Page**: Overall score, tier badge, branding
2. **Service Details**: Tier description and purchased add-ons
3. **Executive Summary**: High-level findings
4. **Priority Action Plan**: Week-by-week fix recommendations
5. **SEO Scores**: Category breakdowns
6. **Issues**: Detailed issues with step-by-step fix instructions
7. **Image Alt Tags**: (If purchased) Detailed alt tag analysis
8. **Competitor Analysis**: (If purchased) Keyword gaps and opportunities
9. **Page-Level Data**: Table of all scanned pages

### Web Interface Tabs

- **Summary**: Executive summary text
- **Issues**: Issues grouped by severity (High/Medium/Low)
- **Pages**: Table of all scanned pages
- **Alt Tags**: (If add-on purchased) Image alt tag analysis
- **Competitor**: (If add-on purchased) Keyword gap analysis
- **Raw Data**: Complete JSON data

## Production Deployment

1. Set `NODE_ENV=production`
2. Use Postgres instead of SQLite (update `DATABASE_URL`)
3. Set secure `NEXTAUTH_SECRET`
4. Build: `npm run build`
5. Start: `npm start`

## What Each Tier Includes

### Starter ($39)
- ✅ 1-3 pages analyzed
- ✅ Basic technical, on-page, content, accessibility checks
- ✅ PDF report with fix instructions
- ✅ Issue breakdown by severity

### Standard ($89)
- ✅ Up to 20 pages analyzed
- ✅ 5 extracted keywords
- ✅ Schema markup detection
- ✅ All Starter features plus:
  - Keyword extraction from titles/headings
  - Schema markup issues
  - More comprehensive analysis

### Advanced ($149)
- ✅ Up to 50 pages analyzed
- ✅ 10 extracted keywords
- ✅ Priority action plan (Week 1/Week 2)
- ✅ All Standard features plus:
  - Detailed priority recommendations
  - Extended keyword analysis
  - Deeper crawl depth

## What Each Add-On Provides

### Image Alt Tags (+$15)
- Detailed analysis of up to 100 images
- Identifies: missing, too short, too long, generic alt text
- Specific recommendations for each image
- Dedicated PDF section and web tab

### Competitor Analysis (+$39)
- Keyword gap analysis
- Identifies missing opportunities
- Shows shared keywords
- Actionable recommendations
- Dedicated PDF section and web tab

### Schema Markup (+$30)
- Detects JSON-LD and microdata
- Identifies missing structured data
- Provides implementation instructions

### Additional Pages/Keywords
- Extends tier limits
- Automatically applied to audit

### Fast Delivery (+$25)
- Visual indicator in reports
- 24-hour delivery badge

## Troubleshooting

- **Can't login?** Make sure you created a user with `npm run create-user`
- **PDF generation fails?** Make sure Puppeteer dependencies are installed (usually automatic)
- **Email not sending?** Check SMTP settings in Settings page and test email first
- **Database errors?** Run `npm run db:migrate` to ensure schema is up to date
- **Tier limits not working?** Make sure you're selecting a tier in the UI or passing `--tier` in CLI
- **Add-ons not showing?** Check that add-ons are properly saved in the audit's `rawJson.options.addOns`

