# Cursor-Ready Implementation Prompts

**Copy-paste these prompts into Cursor to implement the 3 missing features.**

---

## 🚀 Prompt 1: Add Robots.txt as Formal Issue

**Copy this prompt into Cursor:**

```
I need to add robots.txt missing/unreachable as a formal issue in the SEO audit.

Currently, I check for robots.txt in `checkRobotsTxt()` and store it in `siteWide.robotsTxtExists` and `siteWide.robotsTxtReachable`, but it's only shown in site-wide data, not as a proper issue in the issues list.

I need you to:
1. In `lib/seoAudit.ts`, in the `analyzeSiteWideIssues()` function
2. After checking for missing sitemap, add a check for robots.txt
3. If `siteWide.robotsTxtExists === false`, add a low-severity Technical issue:
   - Category: 'Technical'
   - Severity: 'Low'
   - Message: 'Missing robots.txt'
   - Details: 'robots.txt file not found. While not critical, it helps search engines understand crawling rules.'

4. If `siteWide.robotsTxtExists === true` but `siteWide.robotsTxtReachable === false`, add a medium-severity issue:
   - Category: 'Technical'
   - Severity: 'Medium'
   - Message: 'robots.txt unreachable'
   - Details: 'robots.txt file exists but cannot be accessed (may return errors).'

Make sure to use `consolidateIssue()` to avoid duplicates.
```

---

## 📱 Prompt 2: Implement Social Media Presence Checker

**Copy this prompt into Cursor:**

```
I need to implement a social media presence checker for the SEO audit.

Create a new file `lib/social.ts` that:

1. Exports a function `checkSocialMediaPresence(html: string, url: string)` that:
   - Parses HTML for social media links (look for common patterns in href attributes):
     - Facebook: facebook.com, fb.com
     - Twitter/X: twitter.com, x.com
     - Instagram: instagram.com
     - YouTube: youtube.com, youtu.be
     - LinkedIn: linkedin.com
   - Checks for Open Graph meta tags (og:title, og:description, og:image, og:url)
   - Checks for Twitter Card meta tags (twitter:card, twitter:site, twitter:title, twitter:description, twitter:image)
   - Checks for Facebook Pixel (look for fbq, facebook.com/tr, or meta tags with fb:app_id)
   - Returns a `SocialMediaData` object with all findings

2. Update `lib/types.ts` to add:
   - `SocialMediaData` interface with fields for each platform and meta tag presence
   - Add `socialMedia?: SocialMediaData` to `SiteWideData` interface

3. Integrate into `lib/seoAudit.ts`:
   - Call `checkSocialMediaPresence()` in `analyzeSiteWideIssues()` for the first page
   - Store result in `siteWide.socialMedia`
   - Generate issues:
     - Low severity: "Missing Open Graph tags" (if no OG tags found)
     - Low severity: "Missing Twitter Card tags" (if no Twitter Card tags found)
     - Low severity: "No social media links detected" (if no social links found)
     - Info: "Facebook Pixel detected" (if found, but no issue)

4. Use regex to find links and meta tags efficiently.
5. Return structured data that can be displayed in the PDF report.

The function should handle edge cases (no social links, partial tags, etc.) gracefully.
```

---

## 📍 Prompt 3: Implement Local SEO Checker

**Copy this prompt into Cursor:**

```
I need to implement a local SEO checker for the SEO audit.

Create a new file `lib/localSEO.ts` that:

1. Exports a function `checkLocalSEO(html: string, url: string)` that:
   - Extracts phone numbers using regex patterns:
     - US: (555) 123-4567, 555-123-4567, 555.123.4567, 1-555-123-4567
     - International: +1 555 123 4567, etc.
   - Extracts addresses using regex patterns:
     - Street addresses: "123 Main St", "456 Oak Avenue"
     - City, State ZIP: "New York, NY 10001"
     - Look for common address keywords: "Street", "Avenue", "Road", "Suite", etc.
   - Checks for LocalBusiness Schema (you already have schema detection, just check if LocalBusiness type exists)
   - Checks for Google Business Profile links:
     - Look for links containing "google.com/maps", "google.com/business", "goo.gl/maps"
   - Checks for review widgets/links:
     - Look for "review", "rating", "stars", etc.
   - Returns a `LocalSEOData` object with all findings

2. Update `lib/types.ts` to add:
   - `LocalSEOData` interface with fields:
     - hasAddress: boolean
     - address?: string (first found address)
     - hasPhone: boolean
     - phone?: string (first found phone)
     - hasLocalBusinessSchema: boolean
     - localBusinessType?: string
     - hasGoogleBusinessProfile: boolean
     - googleBusinessUrl?: string
     - hasReviews: boolean
   - Add `localSEO?: LocalSEOData` to `SiteWideData` interface

3. Integrate into `lib/seoAudit.ts`:
   - Call `checkLocalSEO()` in `analyzeSiteWideIssues()` for all pages
   - Store result in `siteWide.localSEO` (aggregate findings)
   - Generate issues:
     - Medium severity: "Missing LocalBusiness Schema" (if no local business schema found AND address/phone found)
     - Medium severity: "Missing business address" (if no address found)
     - Medium severity: "Missing phone number" (if no phone found)
     - Low severity: "Missing Google Business Profile link" (if no GBP link found)

4. Use regex patterns that work for US addresses primarily, but handle international formats too.

5. Only show local SEO section in PDF if LocalBusiness Schema is detected OR if address/phone found (to avoid false positives).

The function should be efficient and handle edge cases gracefully.
```

---

## 🔄 Prompt 4: Update PDF Report (When Ready)

**Copy this prompt when you're ready to update PDF templates:**

```
I need to update the PDF report templates to display:

1. Social Media Presence section (if social media data exists):
   - List detected social media links
   - Show Open Graph tag status
   - Show Twitter Card tag status
   - Show Facebook Pixel status

2. Local SEO section (only if LocalBusiness Schema detected OR address/phone found):
   - Show business address (if found)
   - Show phone number (if found)
   - Show LocalBusiness Schema status
   - Show Google Business Profile link (if found)

3. Ensure robots.txt issue appears in the Technical Issues section.

Add these sections to the appropriate places in the PDF template, maintaining the existing design style.
```

---

## 📋 Usage Instructions

1. **Copy the prompt** for the feature you want to implement
2. **Paste it into Cursor** chat
3. **Let Cursor generate the code**
4. **Review and test** the implementation
5. **Update PDF templates** if needed (use Prompt 4)

---

## ✅ Testing Checklist

After implementing each feature:

- [ ] **Robots.txt Issue:**
  - [ ] Run audit on site without robots.txt → should show issue
  - [ ] Run audit on site with robots.txt → should not show issue
  - [ ] Verify issue appears in Technical Issues section

- [ ] **Social Media Checker:**
  - [ ] Test with site that has social links → should detect them
  - [ ] Test with site that has Open Graph → should detect OG tags
  - [ ] Test with site that has Twitter Cards → should detect Twitter tags
  - [ ] Verify data appears in audit results

- [ ] **Local SEO Checker:**
  - [ ] Test with site that has address → should detect it
  - [ ] Test with site that has phone → should detect it
  - [ ] Test with LocalBusiness Schema → should detect it
  - [ ] Test with Google Business Profile link → should detect it
  - [ ] Verify issues generated appropriately

---

**All prompts are ready to copy-paste into Cursor! 🚀**

