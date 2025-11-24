/**
 * Core SEO Audit Engine
 * 
 * Performs comprehensive SEO audits by crawling websites and analyzing
 * technical, on-page, content, and accessibility factors.
 */

import { Issue, PageData, SiteWideData, AuditResult, AuditOptions, AuditTier, ImageAltAnalysis, CompetitorAnalysis } from './types'
import { renderPage, RenderedPageData } from './renderer'
import { generatePerformanceIssues } from './performance'
import { calculateRenderingPercentage, generateLLMReadabilityIssues } from './llmReadability'
import { analyzeSchema } from './schemaAnalyzer'
import { fetchPageSpeedInsights } from './pagespeed'
import { checkHttpVersion, checkCompression } from './technical'
import { checkSocialMediaPresence } from './social'
import { performEnhancedTechnicalCheck, getTechnicalFixInstructions } from './enhancedTechnical'
import { analyzeEnhancedOnPage, getOnPageFixInstructions } from './enhancedOnPage'
import { analyzeEnhancedContent, getContentFixInstructions } from './enhancedContent'
import { classifyDomain, autoFillCompetitorUrls } from './competitorData'
import { deduplicateKeywords, formatKeywordsForDisplay, findKeywordGaps } from './keywordProcessor'
import { consolidateIssue } from './issueProcessor'
import { decode } from 'html-entities'

// NEW: Import fixed modules
import { 
  normalizeUrl as normalizeUrlNew, 
  followRedirects, 
  canonicalizeUrl, 
  isInternalLink,
  shouldMergeUrls,
  getPreferredUrl,
  getRootDomain,
  isSameDomain,
  CrawlContext
} from './urlNormalizer'
import { 
  extractTitle, 
  extractMetaDescription,
  extractCanonical,
  isTitleTooShort,
  isTitleTooLong,
  isMetaDescriptionTooShort,
  isMetaDescriptionTooLong
} from './titleMetaExtractor'
import { 
  validatePerformanceMetrics,
  getPerformanceRating,
  formatMetricValue
} from './performanceValidator'
import {
  calculateAllScores,
  calculateOverallScore
} from './scoring'
import {
  analyzeCompetitors,
  generateFallbackKeywordSuggestions
} from './realCompetitorAnalysis'

// Import crawl diagnostics
import { analyzeCrawl, CrawlDiagnostics, getStatusMessage, isCrawlSufficient } from './crawlDiagnostics'

// Import Local SEO analysis (Sprint 2)
import { analyzeLocalSEO } from './localSEO'

// Import Platform-specific instructions (Sprint 2.2)
import { getPlatformInstructions, Platform } from './platformInstructions'

const DEFAULT_OPTIONS: Required<Omit<AuditOptions, 'tier' | 'addOns' | 'competitorUrls'>> & Pick<AuditOptions, 'addOns' | 'competitorUrls'> = {
  maxPages: 5,
  maxDepth: 3,
  userAgent: 'SEO-Audit-Bot/1.0',
  addOns: undefined,
  competitorUrls: undefined
}

/**
 * Get tier-based limits
 * Updated pricing tiers (Nov 2025):
 * - Starter: $19, up to 5 pages
 * - Standard: $39, up to 20 pages
 * - Professional: $59, up to 50 pages
 * - Agency: $99, up to 200 pages
 * - Enterprise: Contact for pricing (no page limits)
 */
export function getTierLimits(tier?: AuditTier): { maxPages: number; maxDepth: number } {
  switch (tier) {
    case 'starter':
      return { maxPages: 5, maxDepth: 2 }
    case 'standard':
      return { maxPages: 20, maxDepth: 3 }
    case 'professional':
      return { maxPages: 50, maxDepth: 5 }
    case 'agency':
      return { maxPages: 200, maxDepth: 10 }
    default:
      return { maxPages: 5, maxDepth: 3 }
  }
}

/**
 * Filter valid pages from error pages
 * Sprint 1.2: Don't audit 404 pages for SEO issues
 */
function filterValidPages(pages: PageData[]): {
  validPages: PageData[]
  errorPages: PageData[]
} {
  const validPages = pages.filter(p => p.statusCode >= 200 && p.statusCode < 400)
  const errorPages = pages.filter(p => p.statusCode >= 400 || p.statusCode === 0)
  
  console.log(`[Filter] Total pages: ${pages.length}, Valid: ${validPages.length}, Errors: ${errorPages.length}`)
  
  return { validPages, errorPages }
}

/**
 * Deduplicate pages by normalized URL
 * Sprint 1.3: No duplicate URLs in page table
 */
function deduplicatePages(pages: PageData[]): PageData[] {
  const seen = new Map<string, PageData>()
  
  for (const page of pages) {
    const normalizedUrl = normalizeUrlNew(page.url)
    
    if (seen.has(normalizedUrl)) {
      const existing = seen.get(normalizedUrl)!
      
      // Keep the entry with more data (higher word count, non-zero status, or successful status)
      if (page.wordCount > existing.wordCount || 
          (existing.statusCode === 0 && page.statusCode > 0) ||
          (existing.statusCode >= 400 && page.statusCode < 400)) {
        console.log(`[Dedup] Replacing ${normalizedUrl}: ${existing.statusCode} (${existing.wordCount}w) → ${page.statusCode} (${page.wordCount}w)`)
        seen.set(normalizedUrl, page)
      }
    } else {
      seen.set(normalizedUrl, page)
    }
  }
  
  const uniquePages = Array.from(seen.values())
  console.log(`[Dedup] Deduplicated ${pages.length} pages → ${uniquePages.length} unique pages`)
  
  return uniquePages
}

/**
 * Sprint 3.2: Deduplicate issues that are essentially the same
 * Handles cases where the same issue appears with different severities or slightly different messages
 */
function deduplicateIssues(issues: Issue[]): Issue[] {
  const seen = new Map<string, Issue>()
  
  for (const issue of issues) {
    // Create a normalized key based on category and message
    // Normalize the message to catch variations like "Title tag too short" vs "Page title too short"
    const normalizedMessage = (issue.message || (issue as any).title || '').toLowerCase()
      .replace(/^(title tag|page title|title)/i, 'title')
      .replace(/^(meta description|meta)/i, 'meta description')
      .replace(/^(missing|no|not found)/i, 'missing')
      .replace(/\s+/g, ' ')
      .trim()
    
    const key = `${issue.category}|${normalizedMessage}`
    
    if (seen.has(key)) {
      const existing = seen.get(key)!
      // Keep the higher severity version
      const severityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 }
      const existingSeverity = severityOrder[existing.severity as keyof typeof severityOrder] || 0
      const newSeverity = severityOrder[issue.severity as keyof typeof severityOrder] || 0
      
      if (newSeverity > existingSeverity) {
        // Replace with higher severity version
        seen.set(key, issue)
      } else {
        // Merge affected pages
        if (issue.affectedPages) {
          if (!existing.affectedPages) {
            existing.affectedPages = []
          }
          existing.affectedPages.push(...issue.affectedPages)
          existing.affectedPages = Array.from(new Set(existing.affectedPages))
        }
        // Update fix instructions if missing
        if (!existing.fixInstructions && issue.fixInstructions) {
          existing.fixInstructions = issue.fixInstructions
        }
        if (!existing.fixInstructions && issue.fixInstructions) {
          existing.fixInstructions = issue.fixInstructions
        }
      }
    } else {
      seen.set(key, { ...issue })
    }
  }
  
  return Array.from(seen.values())
}

/**
 * Main audit function
 */
export async function runAudit(
  url: string,
  options: AuditOptions = {}
): Promise<AuditResult> {
  // Apply tier-based limits if tier is specified
  const tierLimits = options.tier ? getTierLimits(options.tier) : { maxPages: undefined, maxDepth: undefined }
  
  // Apply add-ons
  let finalMaxPages = options.maxPages ?? tierLimits.maxPages ?? DEFAULT_OPTIONS.maxPages
  if (options.addOns?.additionalPages) {
    finalMaxPages += options.addOns.additionalPages
  }
  
  const opts: Required<AuditOptions> = { 
    ...DEFAULT_OPTIONS, 
    ...options,
    ...tierLimits,
    maxPages: finalMaxPages,
    maxDepth: options.maxDepth ?? tierLimits.maxDepth ?? DEFAULT_OPTIONS.maxDepth,
    userAgent: options.userAgent ?? DEFAULT_OPTIONS.userAgent,
    tier: options.tier ?? 'starter', // Default tier if not specified
    // Preserve add-ons
    addOns: options.addOns ?? {},
    competitorUrls: options.competitorUrls ?? []
  }
  const startTime = Date.now()
  
  console.log(`[Audit] Starting audit for ${url} (max pages: ${finalMaxPages}, max depth: ${opts.maxDepth})`)
  
  // NEW: Follow redirects to get final URL and determine preferred hostname
  console.log('[Audit] Following redirects to determine canonical URL...')
  const redirectResult = await followRedirects(url, opts.userAgent)
  const rootUrl = redirectResult.finalUrl
  const parsedRoot = new URL(rootUrl)
  let baseDomain = parsedRoot.hostname
  
  console.log(`[Audit] Final URL after redirects: ${rootUrl}`)
  if (redirectResult.redirectChain.length > 1) {
    console.log(`[Audit] Redirect chain: ${redirectResult.redirectChain.join(' → ')}`)
  }
  
  const crawlContext: CrawlContext = {
    preferredHostname: parsedRoot.hostname.toLowerCase(),
    preferredProtocol: parsedRoot.protocol,
    rootDomain: getRootDomain(parsedRoot.hostname)
  }
  
  // Track crawled pages
  const crawledUrls = new Set<string>()
  const pages: PageData[] = []
  let allIssues: Issue[] = [] // Changed to 'let' to allow reassignment in deduplication
  
  // Site-wide data
  const siteWide: SiteWideData = {
    robotsTxtExists: false,
    robotsTxtReachable: false,
    sitemapExists: false,
    sitemapReachable: false,
    duplicateTitles: [],
    duplicateMetaDescriptions: [],
    brokenPages: []
  }
  
  // Check robots.txt
  console.log('[Audit] Checking robots.txt...')
  await checkRobotsTxt(rootUrl, siteWide)
  
  // Check sitemap.xml
  console.log('[Audit] Checking sitemap.xml...')
  await checkSitemap(rootUrl, siteWide)
  
  // Initialize browser for this audit (reuse across all pages)
  let browserInitialized = false
  let closeBrowserFn: (() => Promise<void>) | null = null
  try {
    const { initializeBrowser, closeBrowser } = await import('./renderer')
    await initializeBrowser()
    browserInitialized = true
    closeBrowserFn = closeBrowser
  } catch (browserError) {
    console.warn('[Audit] Browser initialization failed, will use fallback fetch only:', browserError)
    // Continue without browser - we'll use basic fetch fallback
  }
  
  try {
    // Crawl pages (pass imageAltTags flag if add-on is selected)
  console.log(`[Audit] Starting to crawl up to ${opts.maxPages} pages...`)
  await crawlPages(rootUrl, baseDomain, opts, crawledUrls, pages, allIssues, false) // Image alt tags analysis is done separately
  console.log(`[Audit] Finished crawling ${pages.length} pages`)
  
  // Analyze site-wide issues
  console.log('[Audit] Analyzing site-wide issues...')
  // Filter out PDFs and non-HTML files from pages before analyzing
  const htmlPagesOnly = pages.filter(page => {
    const isNonHtmlFile = page.url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
    return !isNonHtmlFile
  })
  analyzeSiteWideIssues(htmlPagesOnly, siteWide, allIssues, url)
  
  // CRITICAL FIX: Clean brokenPages array to remove any PDFs or non-HTML files that might have been added
  // This ensures brokenPages only contains HTML pages, even if they were added from other sources
  const originalBrokenCount = siteWide.brokenPages.length
  siteWide.brokenPages = siteWide.brokenPages.filter(url => {
    const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
    return !isNonHtmlFile
  })
  if (originalBrokenCount !== siteWide.brokenPages.length) {
    console.log(`[Audit] Filtered ${originalBrokenCount - siteWide.brokenPages.length} non-HTML files from brokenPages`)
  }
  
  // Also filter out any issues that reference PDFs or non-HTML files in their affectedPages
  // CRITICAL FIX: Preserve site-wide issues (those without affectedPages or with empty array)
  allIssues.forEach(issue => {
    if (issue.affectedPages && issue.affectedPages.length > 0) {
      const originalCount = issue.affectedPages.length
      issue.affectedPages = issue.affectedPages.filter((url: string) => {
        const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
        return !isNonHtmlFile
      })
      // Only mark for removal if ALL pages were filtered AND it had pages originally
      // Site-wide issues (undefined or empty affectedPages) should NOT be removed
      if (issue.affectedPages.length === 0 && originalCount > 0) {
        (issue as any)._shouldRemove = true
      }
    }
    // CRITICAL: Issues without affectedPages (site-wide) should NOT be marked for removal
  })
  
  // Remove issues that have no affected pages after filtering
  // BUT preserve site-wide issues (those without affectedPages field or empty array)
  const filteredIssues = allIssues.filter((issue: any) => {
    // Keep if not marked for removal
    if (issue._shouldRemove) return false
    // CRITICAL FIX: Keep site-wide issues (no affectedPages or empty array is valid)
    if (!issue.affectedPages || issue.affectedPages.length === 0) {
      return true // Site-wide issues are valid
    }
    // Keep if it has valid affected pages
    return issue.affectedPages.length > 0
  })
  allIssues.length = 0
  allIssues.push(...filteredIssues)
  
  // Perform enhanced technical check on main page
  // Perform enhanced technical analysis (Standard+ tiers)
  let enhancedTechnicalData: any = undefined
  let mobileResponsivenessData: any = undefined
  let serverTechnologyData: any = undefined
  
  if (pages.length > 0 && opts.tier !== 'starter') {
    console.log('[Audit] Performing enhanced technical analysis...')
    try {
      const mainPage = pages[0]
      const { data: technicalData, issues: technicalIssues } = await performEnhancedTechnicalCheck(
        mainPage.url,
        opts.userAgent
      )
      enhancedTechnicalData = technicalData
      
      technicalIssues.forEach(issue => {
        if (!issue.id) {
          issue.id = `technical-${issue.severity}-${issue.message}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
        issue.fixInstructions = getTechnicalFixInstructions(issue)
        issue.priority = issue.severity === 'High' ? 10 : issue.severity === 'Medium' ? 5 : 2
        allIssues.push(issue)
      })
      
      // Mobile responsiveness analysis
      const hasViewport = validPages.some(p => p.hasViewport)
      const responsiveDesign = validPages.some(p => {
        // Check for responsive design indicators
        const content = JSON.stringify(p).toLowerCase()
        return content.includes('viewport') || content.includes('responsive') || content.includes('mobile')
      })
      mobileResponsivenessData = {
        hasViewport,
        responsiveDesign,
        mobileFriendly: hasViewport && responsiveDesign,
        touchTargets: true, // Assume true if viewport exists (would need deeper analysis)
        fontSizing: true // Assume true if viewport exists
      }
      
      // Server technology detection
      const allContent = JSON.stringify(validPages).toLowerCase()
      let server = 'Unknown'
      let cms = 'Unknown'
      let framework = 'Unknown'
      let cdn = 'Unknown'
      
      // Detect CMS
      if (allContent.includes('wp-content') || allContent.includes('wordpress')) {
        cms = 'WordPress'
      } else if (allContent.includes('squarespace')) {
        cms = 'Squarespace'
      } else if (allContent.includes('shopify')) {
        cms = 'Shopify'
      } else if (allContent.includes('wix')) {
        cms = 'Wix'
      }
      
      // Detect framework
      if (allContent.includes('next.js') || allContent.includes('__next')) {
        framework = 'Next.js'
      } else if (allContent.includes('react')) {
        framework = 'React'
      } else if (allContent.includes('vue')) {
        framework = 'Vue.js'
      } else if (allContent.includes('angular')) {
        framework = 'Angular'
      }
      
      // Detect CDN
      if (allContent.includes('cloudflare')) {
        cdn = 'Cloudflare'
      } else if (allContent.includes('cloudfront')) {
        cdn = 'AWS CloudFront'
      } else if (allContent.includes('fastly')) {
        cdn = 'Fastly'
      }
      
      serverTechnologyData = {
        server,
        cms,
        framework,
        cdn
      }
    } catch (error) {
      console.warn('Enhanced technical check failed:', error)
    }
  }
  
  // Create a shared issueMap for consolidation (used by both basic and enhanced analysis)
  const enhancedIssueMap = new Map<string, Issue>()
  
  // Perform enhanced on-page and content analysis (limit to first 10 pages for performance)
  console.log('[Audit] Performing enhanced on-page and content analysis...')
  const pagesToAnalyze = pages.slice(0, Math.min(10, pages.length))
  await Promise.all(pagesToAnalyze.map(async (page) => {
    try {
      // CRITICAL FIX #4 & #16: Use rendered HTML for enhanced analysis, not initial HTML
      // This ensures word count and content extraction use JavaScript-rendered content
      // Add timeout to prevent hanging
      const { renderPage } = await import('./renderer')
      const rendered = await Promise.race([
        renderPage(page.url, opts.userAgent),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Enhanced analysis render timeout')), 30000)
        )
      ])
      const html = rendered.renderedHtml // Use rendered HTML, not initial HTML
      
      // Extract primary keyword from page title or H1
      const primaryKeyword = page.title?.split(/\s+/)[0] || page.h1Text?.[0]?.split(/\s+/)[0]
      
      // Enhanced on-page analysis - CRITICAL FIX #14: Pass site category for CTA advice
      // Determine site category from rootUrl
      let detectedSiteCategory: string | undefined = undefined
      try {
        const hostname = new URL(rootUrl).hostname.toLowerCase()
        if (hostname.includes('.gov')) {
          detectedSiteCategory = 'Government'
        } else if (hostname.includes('.edu')) {
          detectedSiteCategory = 'Education'
        } else if (hostname.includes('.org')) {
          detectedSiteCategory = hostname.includes('news') ? 'News' : 'Nonprofit'
        }
      } catch {
        // If URL parsing fails, continue
      }
      const { data: onPageData, issues: onPageIssues } = analyzeEnhancedOnPage(page, html, primaryKeyword, detectedSiteCategory)
      onPageIssues.forEach(issue => {
        issue.fixInstructions = getOnPageFixInstructions(issue)
        issue.priority = issue.severity === 'High' ? 10 : issue.severity === 'Medium' ? 5 : 2
        // Use consolidateIssue to merge with existing issues and avoid duplicates
        consolidateIssue(enhancedIssueMap, issue)
      })
      
      // Enhanced content analysis - CRITICAL FIX #4: Use rendered HTML
      const { data: contentData, issues: contentIssues } = analyzeEnhancedContent(page, html)
      
      // CRITICAL FIX #4: Update page.wordCount if enhanced analysis found more words from rendered content
      if (contentData.depth.wordCount > (page.wordCount || 0)) {
        page.wordCount = contentData.depth.wordCount
        console.log(`[Audit] Updated word count for ${page.url}: ${page.wordCount} words (from rendered content)`)
      }
      // Store readability data on page for scoring
      if (contentData.readability) {
        page.readability = {
          fleschScore: contentData.readability.fleschScore,
          averageSentenceLength: contentData.depth?.averageWordsPerSentence
        }
      }
      contentIssues.forEach(issue => {
        issue.fixInstructions = getContentFixInstructions(issue)
        issue.priority = issue.severity === 'High' ? 10 : issue.severity === 'Medium' ? 5 : 2
        // Use consolidateIssue to merge with existing issues and avoid duplicates
        consolidateIssue(enhancedIssueMap, issue)
      })
    } catch (error) {
      // Skip enhanced analysis if fetch fails
      console.warn(`Enhanced analysis failed for ${page.url}:`, error)
    }
  }))
  
  // Merge consolidated enhanced issues into main issues array
  enhancedIssueMap.forEach(issue => {
    // Check if a similar issue already exists in allIssues (from analyzeSiteWideIssues)
    const existingIssue = allIssues.find(i => 
      i.message === issue.message && 
      i.category === issue.category &&
      i.severity === issue.severity
    )
    if (existingIssue) {
      // Merge affected pages
      if (issue.affectedPages) {
        issue.affectedPages.forEach(url => {
          if (!existingIssue.affectedPages?.includes(url)) {
            existingIssue.affectedPages = existingIssue.affectedPages || []
            existingIssue.affectedPages.push(url)
          }
        })
      }
      // Use better fix instructions if available
      if (issue.fixInstructions && !existingIssue.fixInstructions) {
        existingIssue.fixInstructions = issue.fixInstructions
      }
    } else {
      // New issue, add it
      allIssues.push(issue)
    }
  })
  
  // Check social media presence (on main page) - re-fetch to get full HTML
  if (pages.length > 0) {
    try {
      const response = await fetch(rootUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': opts.userAgent }
      })
      const html = await response.text()
      siteWide.socialMedia = checkSocialMediaPresence(html, rootUrl)
    } catch (error) {
      // If fetch fails, skip social media check
      console.warn('Failed to fetch HTML for social media check:', error)
    }
  }
  
  // Enhanced schema issues (includes Identity Schema checks)
  // Check for Standard/Professional/Agency tiers or if schema add-on is selected
  if (opts.tier === 'standard' || opts.tier === 'professional' || opts.tier === 'agency' || opts.addOns?.schemaDeepDive) {
    const schemaIssueMap = new Map<string, Issue>()
    
    // CRITICAL FIX #2 & #6: Merge schema detection across all pages
    // Check if ANY page has schema before flagging site-wide issues
    const hasAnySchema = pages.some(p => p.hasSchemaMarkup || (p.schemaTypes && p.schemaTypes.length > 0))
    const hasAnyIdentitySchema = pages.some(p => 
      p.schemaAnalysis?.hasIdentitySchema || 
      (p.schemaTypes && p.schemaTypes.some(t => t.includes('Organization') || t.includes('Person')))
    )
    
    // CRITICAL FIX #6: Only create ONE site-wide issue if no schema exists
    if (!hasAnySchema) {
      consolidateIssue(schemaIssueMap, {
        category: 'Technical',
        severity: 'Medium',
        message: 'Missing schema markup',
        details: 'No Schema.org structured data detected across the site. Add JSON-LD or microdata to help search engines understand your content.',
        affectedPages: pages.map(p => p.url)
      })
    }
    
    // CRITICAL FIX #6: Only create ONE site-wide issue if no Identity Schema exists
    if (!hasAnyIdentitySchema) {
      consolidateIssue(schemaIssueMap, {
        category: 'Technical',
        severity: 'Medium',
        message: 'Missing Identity Schema',
        details: 'No Organization or Person Schema identified across the site. The absence of Identity Schema can make it harder for Search Engines and LLMs to identify the ownership of a website.',
        affectedPages: pages.map(p => p.url)
      })
    }
    
    // CRITICAL FIX #6: Only flag page-level issues if site HAS schema but this page doesn't
    pages.forEach(page => {
      if (page.schemaAnalysis) {
        // If site has Identity Schema, but this specific page is missing it, it's a low priority page-level issue
        if (hasAnyIdentitySchema && !page.schemaAnalysis.hasIdentitySchema) {
          consolidateIssue(schemaIssueMap, {
            category: 'Technical',
            severity: 'Low',
            message: 'Page missing Identity Schema',
            details: 'No Organization or Person Schema identified on this page. Consider adding it for better page-level context.',
            affectedPages: [page.url]
          })
        }
        // Check for incomplete Identity Schema
        if (page.schemaAnalysis.missingFields && page.schemaAnalysis.missingFields.length > 0) {
          consolidateIssue(schemaIssueMap, {
            category: 'Technical',
            severity: 'Low',
            message: `Incomplete ${page.schemaAnalysis.identityType} Schema`,
            details: `Missing required fields: ${page.schemaAnalysis.missingFields.join(', ')}. Complete your Identity Schema for better search engine understanding.`,
            affectedPages: [page.url]
          })
        }
      } else if (hasAnySchema && !page.hasSchemaMarkup) {
        // If site has schema, but this specific page is missing schema markup, it's a low priority page-level issue
        consolidateIssue(schemaIssueMap, {
          category: 'Technical',
          severity: 'Low',
          message: 'Page missing schema markup',
          details: 'No Schema.org structured data detected on this page. Consider adding relevant schema.',
          affectedPages: [page.url]
        })
      }
    })
    
    // Add consolidated schema issues
    schemaIssueMap.forEach(issue => {
      allIssues.push(issue)
    })
  }
  
  // Collect keywords from all pages using improved processor
  const allKeywords: string[] = []
  pages.forEach(page => {
    if (page.extractedKeywords) {
      allKeywords.push(...page.extractedKeywords)
    }
  })
  
  // Calculate keyword count based on tier and add-ons
  // Starter: 0, Standard: 5, Professional: 10, Agency: unlimited (use all extracted)
  let keywordCount = opts.tier === 'agency' ? 1000 : opts.tier === 'professional' ? 10 : opts.tier === 'standard' ? 5 : 0
  if (opts.addOns?.additionalKeywords) {
    keywordCount += opts.addOns.additionalKeywords
  }
  
  // Use the new keyword processor for clean, deduplicated results
  const topKeywords = formatKeywordsForDisplay(allKeywords, keywordCount)
  
  // Image Alt Tags Analysis (if add-on is selected)
  let imageAltAnalysis: ImageAltAnalysis[] | undefined
  if (false) { // Image alt tags analysis disabled - use separate endpoint if needed
    imageAltAnalysis = await analyzeImageAltTags(pages)
  }
  
  // CRITICAL FIX #6: Competitor Analysis - Skip when conditions not met
  // NOTE: This will be moved after validPages is defined
  let competitorAnalysis: CompetitorAnalysis | undefined
  
  // Add fix instructions to existing issues that don't have them
  allIssues.forEach(issue => {
    if (!issue.fixInstructions) {
      if (issue.category === 'Technical') {
        issue.fixInstructions = getTechnicalFixInstructions(issue)
      } else if (issue.category === 'On-page') {
        issue.fixInstructions = getOnPageFixInstructions(issue)
      } else if (issue.category === 'Content') {
        issue.fixInstructions = getContentFixInstructions(issue)
      }
    }
    // Set priority if not set
    if (!issue.priority) {
      issue.priority = issue.severity === 'High' ? 10 : issue.severity === 'Medium' ? 5 : 2
    }
  })
  
  // Sort issues by priority (highest first)
  allIssues.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  
  // SPRINT 3.2: Final issue deduplication
  console.log(`[Audit] Applying final issue deduplication (${allIssues.length} issues before)`)
  allIssues = deduplicateIssues(allIssues)
  console.log(`[Audit] After deduplication: ${allIssues.length} unique issues`)
  
  // SPRINT 1 INTEGRATION: Apply deduplication and filtering
  console.log(`[Audit] Applying Sprint 1 fixes: deduplication and 404 filtering`)
  
  // Step 1: Deduplicate pages by normalized URL
  const uniquePages = deduplicatePages(pages)
  
  // Step 1.5: Filter out PDFs and non-HTML files from uniquePages before processing
  // This prevents PDFs from being added to brokenPages or issues
  const htmlUniquePages = uniquePages.filter(page => {
    const isNonHtmlFile = page.url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
    if (isNonHtmlFile) {
      console.log(`[Audit] Filtering out non-HTML file from processing: ${page.url}`)
    }
    return !isNonHtmlFile
  })
  
  // Step 2: Filter valid pages from error pages (using filtered pages)
  const { validPages, errorPages } = filterValidPages(htmlUniquePages)
  
  // Step 3: Run crawl diagnostics (Enhanced for Agency tier)
  const crawlDuration = Date.now() - startTime
  const crawlDiagnostics = analyzeCrawl(htmlUniquePages, url, crawlDuration)
  console.log(`[Audit] Crawl diagnostics: ${getStatusMessage(crawlDiagnostics)}`)
  if (crawlDiagnostics.crawlMetrics) {
    console.log(`[Audit] Crawl metrics: ${crawlDiagnostics.crawlMetrics.pagesPerSecond.toFixed(2)} pages/sec, efficiency: ${crawlDiagnostics.crawlMetrics.crawlEfficiency}%`)
  }
  
  // CRITICAL FIX #2: Local SEO Analysis - Only run if LocalBusiness/Organization schema exists OR add-on is selected
  // Check if any page has LocalBusiness or Organization schema
  const hasLocalBusinessSchema = validPages.some(p => 
    p.schemaTypes?.some(t => t.includes('LocalBusiness') || t.includes('Organization')) ||
    p.schemaAnalysis?.identityType === 'Organization'
  )
  // Local SEO is included in Standard+ tiers, no separate add-on needed
  const hasLocalSEOAddOn = false
  const shouldRunLocalSEO = hasLocalBusinessSchema || hasLocalSEOAddOn
  
  let localSEO: any = null
  if (shouldRunLocalSEO) {
    console.log('[Audit] Running Local SEO analysis...')
    localSEO = await analyzeLocalSEO(validPages, url)
    console.log(`[Audit] Local SEO score: ${localSEO.overallScore}/100, Issues: ${localSEO.issues.length}`)
    
    // Add Local SEO issues to main issues list
    localSEO.issues.forEach((issue: any) => {
      allIssues.push({
        ...({
          type: `local-seo-${issue.title.toLowerCase().replace(/\s+/g, '-')}`,
          severity: issue.severity,
          category: 'Technical' as const, // Local SEO is part of technical SEO
          message: issue.description,
          description: issue.description,
          affectedPages: issue.affectedPages,
          fixInstructions: issue.howToFix,
          priority: issue.severity === 'High' ? 10 : issue.severity === 'Medium' ? 5 : 2
        } as any)
      })
    })
  } else {
    console.log('[Audit] Skipping Local SEO analysis - no LocalBusiness/Organization schema detected and no Local SEO add-on selected')
    // Create empty Local SEO result
    localSEO = {
      nap: { foundOn: [], phone: undefined, address: undefined, name: undefined },
      napConsistency: { score: 0, isConsistent: false, inconsistencies: [], recommendations: [] },
      schema: { hasLocalBusiness: false, hasOrganization: false, schemaTypes: [], missingFields: [] },
      serviceAreaPages: [],
      keywords: { localKeywords: [], locationMentions: [] },
      gbp: { hasGoogleMaps: false, hasReviews: false, hasHours: false, hasPhone: false, hasAddress: false },
      citations: [],
      overallScore: 0,
      issues: [],
      recommendations: []
    }
  }
  
  // CRITICAL FIX #6: Competitor Analysis - Auto-detect competitors if none provided
  if (opts.addOns?.competitorAnalysis) {
    // Extract keywords and schema types for industry classification
    const topKeywords = validPages
      .flatMap(p => p.extractedKeywords || [])
      .slice(0, 30)
    
    const hasValidKeywords = topKeywords.length > 0
    const hasMultiplePages = validPages.length > 1
    
    // CRITICAL FIX #7: Check site category (Government, News, Nonprofit should skip)
    // Note: classifyDomain needs HTML, so we'll check industry name instead
    let isNonCommercialSite = false
    let siteCategory: string | undefined
    try {
      // Check if URL suggests non-commercial site
      const hostname = new URL(rootUrl).hostname.toLowerCase()
      if (hostname.includes('.gov')) {
        isNonCommercialSite = true
        siteCategory = 'Government'
      } else if (hostname.includes('.edu')) {
        isNonCommercialSite = true
        siteCategory = 'Education'
      } else if (hostname.includes('.org')) {
        if (hostname.includes('news') || hostname.includes('nonprofit')) {
          isNonCommercialSite = true
          siteCategory = hostname.includes('news') ? 'News' : 'Nonprofit'
        }
      }
    } catch {
      // If URL parsing fails, continue
    }
    
    // NEW: Auto-detect competitors using DeepSeek if none provided
    const providedUrls = opts.competitorUrls || []
    let finalCompetitorUrls: string[] = []
    let autoDetectedCompetitors: string[] = []
    let detectedIndustry = 'Unknown'
    let industryConfidence = 0
    
    console.log(`[Audit] Competitor URL status: ${providedUrls.length} provided, tier: ${opts.tier}`)
    
    // If no competitors provided, use DeepSeek to auto-detect
    if (providedUrls.length === 0) {
      console.log('[Audit] No competitor URLs provided - attempting automatic detection with DeepSeek...')
      
      try {
        const { autoDetectCompetitors } = await import('./deepseekCompetitorDetection')
        
        // Extract site content for context
        const mainPage = validPages.find(p => p.url === rootUrl) || validPages[0]
        const siteContent = {
          title: mainPage?.title,
          description: mainPage?.metaDescription,
          headings: mainPage?.h1Text || []
        }
        
        // Determine max competitors based on tier
        const maxCompetitors = opts.tier === 'agency' ? 5 : opts.tier === 'professional' ? 3 : 2
        
        // Auto-detect competitors
        const detectionResult = await autoDetectCompetitors(
          rootUrl,
          siteContent,
          maxCompetitors
        )
        
        if (detectionResult.competitors.length > 0) {
          finalCompetitorUrls = detectionResult.competitors.map(c => c.url)
          autoDetectedCompetitors = finalCompetitorUrls
          detectedIndustry = `${detectionResult.industry.industry}${detectionResult.industry.subIndustry ? ` / ${detectionResult.industry.subIndustry}` : ''}`
          industryConfidence = 0.8 // High confidence for DeepSeek detection
          
          console.log(`[Audit] ✅ Auto-detected ${finalCompetitorUrls.length} competitors: ${finalCompetitorUrls.slice(0, 3).join(', ')}${finalCompetitorUrls.length > 3 ? '...' : ''}`)
          console.log(`[Audit] Industry detected: ${detectedIndustry}`)
        } else {
          console.log('[Audit] ⚠️ No competitors auto-detected, will try fallback method')
          // Fall back to existing autoFillCompetitorUrls
          const firstPageHtml = '' // HTML not available in PageData
          const autoFillResult = await autoFillCompetitorUrls(
            rootUrl,
            [],
            firstPageHtml,
            opts.userAgent,
            opts.tier,
            topKeywords,
            pages.flatMap(p => p.schemaTypes || []).filter((v, i, a) => a.indexOf(v) === i)
          )
          finalCompetitorUrls = autoFillResult.finalUrls
          autoDetectedCompetitors = autoFillResult.autoDetected
          detectedIndustry = autoFillResult.industry
          industryConfidence = autoFillResult.confidence
        }
      } catch (error) {
        console.warn(`[Audit] DeepSeek auto-detection failed: ${error instanceof Error ? error.message : String(error)}`)
        // Fall back to existing autoFillCompetitorUrls
        try {
          const firstPageHtml = ''
          const autoFillResult = await autoFillCompetitorUrls(
            rootUrl,
            [],
            firstPageHtml,
            opts.userAgent,
            opts.tier,
            topKeywords,
            pages.flatMap(p => p.schemaTypes || []).filter((v, i, a) => a.indexOf(v) === i)
          )
          finalCompetitorUrls = autoFillResult.finalUrls
          autoDetectedCompetitors = autoFillResult.autoDetected
          detectedIndustry = autoFillResult.industry
          industryConfidence = autoFillResult.confidence
        } catch (fallbackError) {
          console.warn('[Audit] Fallback competitor detection also failed, continuing without competitors')
          finalCompetitorUrls = []
        }
      }
    } else {
      // User provided competitors - use them
      finalCompetitorUrls = providedUrls
      console.log(`[Audit] Using ${finalCompetitorUrls.length} user-provided competitor URLs`)
    }
    
    // CRITICAL FIX #7: Skip competitor analysis if conditions not met
    // NOTE: For Standard+ tiers, we're more lenient - allow competitor analysis even with 2 pages
    let shouldSkipCompetitorAnalysis = false
    let skipReason = ''
    
    if (isNonCommercialSite && siteCategory) {
      shouldSkipCompetitorAnalysis = true
      skipReason = `site category is ${siteCategory} (non-commercial)`
    } else if (!hasValidKeywords && validPages.length < 2) {
      // Only skip if no keywords AND less than 2 pages (allow 2+ pages even without keywords)
      shouldSkipCompetitorAnalysis = true
      skipReason = 'no valid keywords discovered and less than 2 pages'
    } else if (validPages.length === 1 && providedUrls.length === 0 && finalCompetitorUrls.length === 0) {
      // Only skip if exactly 1 page AND no competitors found (allow 2+ pages)
      shouldSkipCompetitorAnalysis = true
      skipReason = 'only 1 page crawled and no competitor URLs found'
    }
    
    // CRITICAL FIX #7: Skip competitor analysis if conditions not met
    // Note: finalCompetitorUrls is already set above (either from DeepSeek, fallback, or user-provided)
    if (shouldSkipCompetitorAnalysis) {
      console.log(`[Audit] Skipping competitor analysis - ${skipReason}`)
      competitorAnalysis = undefined
    } else if (finalCompetitorUrls.length === 0) {
      console.log('[Audit] No competitors available after detection, skipping competitor analysis')
      competitorAnalysis = undefined
    } else {
      // Check if detected industry is non-commercial
      const isNonCommercialIndustry = detectedIndustry.toLowerCase().includes('government') || 
                                     detectedIndustry.toLowerCase().includes('news') ||
                                     detectedIndustry.toLowerCase().includes('nonprofit') ||
                                     detectedIndustry.toLowerCase().includes('non-profit')
      
      if (isNonCommercialIndustry) {
        console.log(`[Audit] Skipping competitor analysis - detected industry is ${detectedIndustry} (non-commercial)`)
        competitorAnalysis = undefined
      } else if (industryConfidence < 0.5 && providedUrls.length === 0 && autoDetectedCompetitors.length === 0) {
        console.log(`[Audit] Skipping competitor analysis - industry confidence ${Math.round(industryConfidence * 100)}% < 50% and no competitors detected`)
        competitorAnalysis = undefined
      } else {
        // Log final competitor list
        if (autoDetectedCompetitors.length > 0) {
          console.log(`[Audit] Auto-detected ${autoDetectedCompetitors.length} competitor(s): ${autoDetectedCompetitors.join(', ')}`)
          console.log(`[Audit] Detected industry: ${detectedIndustry} (confidence: ${Math.round(industryConfidence * 100)}%)`)
        }
        
        if (providedUrls.length > 0) {
          console.log(`[Audit] User provided ${providedUrls.length} competitor URL(s): ${providedUrls.join(', ')}`)
        }
        
        console.log(`[Audit] Final competitor list (${finalCompetitorUrls.length} total): ${finalCompetitorUrls.join(', ')}`)
      }
    }
    
    // Now analyze the final competitor list (if not skipped and URLs available)
    if (competitorAnalysis === undefined && finalCompetitorUrls.length > 0) {
      const maxCompetitors = opts.tier === 'agency' ? 3 : 1
      const competitorsToAnalyze = finalCompetitorUrls.slice(0, maxCompetitors)
      
      if (opts.tier === 'agency' && competitorsToAnalyze.length > 1) {
        // Agency tier: Full multi-competitor crawl
        console.log(`[Competitor] Agency tier: Analyzing ${competitorsToAnalyze.length} competitors`)
        competitorAnalysis = await generateMultiCompetitorAnalysis(
          competitorsToAnalyze,
          topKeywords,
          opts,
          validPages
        )
        
        // Add auto-detection metadata
        if (competitorAnalysis) {
          competitorAnalysis.detectedIndustry = detectedIndustry
          competitorAnalysis.industryConfidence = industryConfidence
          competitorAnalysis.autoDetectedCompetitors = autoDetectedCompetitors
          competitorAnalysis.userProvidedCompetitors = providedUrls
          competitorAnalysis.allCompetitors = finalCompetitorUrls
        }
      } else if (competitorsToAnalyze.length > 0) {
        // Standard/Professional: Single competitor, or Agency with only 1 URL
        competitorAnalysis = await generateRealCompetitorAnalysis(
          competitorsToAnalyze[0],
          topKeywords,
          opts
        )
        
        // Add auto-detection metadata
        if (competitorAnalysis) {
          competitorAnalysis.detectedIndustry = detectedIndustry
          competitorAnalysis.industryConfidence = industryConfidence
          competitorAnalysis.autoDetectedCompetitors = autoDetectedCompetitors
          competitorAnalysis.userProvidedCompetitors = providedUrls
        }
      }
    } else {
      // No competitors found (even after auto-fill)
      console.warn('[Competitor] No competitors available (auto-fill found none) - using pattern-based fallback')
      competitorAnalysis = await generateCompetitorAnalysis(pages, topKeywords)
      
      if (competitorAnalysis && opts.tier === 'agency') {
        competitorAnalysis.competitorUrl = 'No competitors found - pattern-based analysis only'
        competitorAnalysis.keywordGaps = []
        competitorAnalysis.competitorKeywords = []
        competitorAnalysis.sharedKeywords = []
      }
    }
  }
  
  // SPRINT 2.2: Update fix instructions with platform-specific instructions
  // CRITICAL FIX #1: Only show WordPress instructions when platform is actually WordPress
  let platform: Platform = (crawlDiagnostics.platform === 'unknown' ? 'custom' : crawlDiagnostics.platform) || 'custom'
  
  // Additional safety check: if URL is .gov/.edu/.org, force to 'custom' unless we have clear CMS detection
  const urlLower = url.toLowerCase()
  if ((urlLower.includes('.gov') || urlLower.includes('.edu') || urlLower.includes('.org')) && platform === 'wordpress') {
    // Double-check: only keep WordPress if we have very strong evidence
    // Otherwise, default to custom for government/education sites
    console.log(`[Audit] Government/Education site detected, verifying WordPress detection...`)
    platform = 'custom'
  }
  
  console.log(`[Audit] Detected platform: ${platform}, updating fix instructions...`)
  
  allIssues.forEach(issue => {
    // Map issue types to platform instruction types
    let issueType = (issue as any).type || ''
    
    // If no type, try to infer from message/title
    if (!issueType) {
      const title = ((issue as any).title || '').toLowerCase()
      const message = (issue.message || '').toLowerCase()
      
      if (title.includes('meta description') || message.includes('meta description')) {
        issueType = 'missing-meta-description'
      } else if (title.includes('title') || message.includes('title')) {
        issueType = 'missing-page-title'
      } else if (title.includes('h1') || message.includes('h1')) {
        issueType = 'missing-h1'
      } else if (title.includes('canonical') || message.includes('canonical')) {
        issueType = 'missing-canonical'
      } else if (title.includes('cache') || message.includes('cache')) {
        issueType = 'missing-cache-control'
      } else if (title.includes('security') || message.includes('security') || title.includes('header')) {
        issueType = 'missing-security-headers'
      } else if (title.includes('schema') || message.includes('schema')) {
        issueType = 'missing-schema'
      } else if (title.includes('open graph') || title.includes('twitter card') || message.includes('social')) {
        issueType = 'missing-open-graph'
      } else if (title.includes('viewport') || message.includes('viewport')) {
        issueType = 'missing-viewport'
      } else if (title.includes('mixed content') || message.includes('mixed content')) {
        issueType = 'mixed-content'
      }
    }
    
    // Get platform-specific instructions if we have an issue type
    if (issueType) {
      const platformInstructions = getPlatformInstructions(platform, issueType, {
        url: issue.affectedPages?.[0],
        severity: issue.severity
      })
      
      // Replace generic instructions with platform-specific ones
        if (platformInstructions.instructions) {
          issue.fixInstructions = platformInstructions.instructions
          if (platformInstructions.additionalNotes) {
            issue.fixInstructions += '\n\n' + platformInstructions.additionalNotes
          }
        }
    }
  })
  
  // CRITICAL FIX #3: Add broken pages issue - Only count HTML documents, skip PDFs and other files
  const brokenHtmlPages = errorPages.filter(p => {
    const isNonHtmlFile = p.url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
    if (isNonHtmlFile) {
      return false // Explicitly skip non-HTML files
    }
    const isHtmlDocument = p.contentType?.includes('text/html') || 
                           p.contentType?.includes('application/xhtml')
    return isHtmlDocument
  })
  
  if (brokenHtmlPages.length > 0) {
    console.log(`[Audit] Found ${brokenHtmlPages.length} broken HTML pages, adding to issues`)
    // Also add to siteWide.brokenPages for consistency
    brokenHtmlPages.forEach(p => {
      if (!siteWide.brokenPages.includes(p.url)) {
        siteWide.brokenPages.push(p.url)
      }
    })
    allIssues.push({
      severity: 'High' as const,
      category: 'Technical' as const,
      message: `${brokenHtmlPages.length} page${brokenHtmlPages.length > 1 ? 's' : ''} returned error status codes`,
      description: `${brokenHtmlPages.length} HTML page${brokenHtmlPages.length > 1 ? 's' : ''} returned errors (404, 500, etc.). These pages are inaccessible to users and search engines.`,
      affectedPages: brokenHtmlPages.map(p => p.url).filter(url => {
        // Double-check: filter out any PDFs that might have slipped through
        const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
        return !isNonHtmlFile
      }),
      fixInstructions: `1. Check if these pages should exist\n2. Fix broken links pointing to these pages\n3. Implement proper 301 redirects if pages have moved\n4. Remove or update any internal links to these pages\n5. Check your sitemap.xml and remove broken URLs`,
      priority: 10
    } as any)
  }
  
  // Step 5: Calculate scores based on VALID pages only (not error pages)
  console.log(`[Audit] Calculating scores for ${validPages.length} valid pages (excluding ${errorPages.length} error pages)`)
  console.log(`[Audit] Total issues before scoring: ${allIssues.length}`)
  const scoreStartTime = Date.now()
  const scores = calculateEnhancedScores(validPages, allIssues, siteWide)
  const scoreDuration = Date.now() - scoreStartTime
  console.log(`[Audit] Score calculation completed in ${scoreDuration}ms`)
  console.log(`[Audit] Scores: Technical=${scores.technical}, OnPage=${scores.onPage}, Content=${scores.content}, Accessibility=${scores.accessibility}`)
  
  // Categorize issues BEFORE filtering to see what we have
  const categorizedIssuesBeforeFilter = categorizeIssues(allIssues)
  console.log(`[Audit] Issues before filtering: Technical=${(categorizedIssuesBeforeFilter.technical || []).length}, On-page=${(categorizedIssuesBeforeFilter.onPage || []).length}, Content=${(categorizedIssuesBeforeFilter.content || []).length}`)
  
  // DEBUG: Log actual category values in issues BEFORE any filtering
  const categoryCounts = new Map<string, number>()
  allIssues.forEach(issue => {
    const cat = issue.category || 'unknown'
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
  })
  console.log(`[Audit] Issue categories found (BEFORE filtering): ${Array.from(categoryCounts.entries()).map(([cat, count]) => `${cat}=${count}`).join(', ')}`)
  
  // DEBUG: Log sample issue structure
  if (allIssues.length > 0) {
    const sampleIssue = allIssues[0]
    console.log(`[Audit] Sample issue structure: category="${sampleIssue.category}", severity="${sampleIssue.severity}", hasAffectedPages=${!!sampleIssue.affectedPages}, affectedPagesLength=${sampleIssue.affectedPages?.length || 0}`)
  }
  
  // NEW: Agency tier - Internal link graph and duplicate URL analysis
  let internalLinkGraph: import('./internalLinkGraph').InternalLinkGraph | undefined
  let duplicateUrlAnalysis: import('./duplicateUrlCleaner').DuplicateUrlAnalysis | undefined
  
  if (opts.tier === 'agency') {
    // Always build internal link graph for Agency tier (will show message if < 10 pages)
    console.log('[Audit] Agency tier: Running internal link graph analysis...')
    try {
      const { buildInternalLinkGraph } = await import('./internalLinkGraph')
      internalLinkGraph = buildInternalLinkGraph(validPages, htmlUniquePages)
      console.log(`[Audit] Internal link graph: ${internalLinkGraph.orphanPages.length} orphan pages, ${internalLinkGraph.isolatedPages.length} isolated pages`)
      
      if (validPages.length < 10) {
        console.log(`[Audit] ⚠️ Limited crawl data (${validPages.length} pages) - internal link graph will show limited data message`)
      }
      
      // Add orphan page issues
      if (internalLinkGraph.orphanPages.length > 0) {
        allIssues.push({
          severity: 'Medium' as const,
          category: 'Technical' as const,
          message: `Found ${internalLinkGraph.orphanPages.length} orphan pages with no incoming internal links`,
          affectedPages: internalLinkGraph.orphanPages.slice(0, 10), // Limit to first 10
          fixInstructions: `Add internal links from high-authority pages (homepage, main category pages) to these orphan pages. Consider adding them to your main navigation or creating a sitemap page.`,
          priority: 6
        } as any)
      }
      
      // Add isolated page issues
      if (internalLinkGraph.isolatedPages.length > 0) {
        allIssues.push({
          severity: 'Medium' as const,
          category: 'Technical' as const,
          message: `Found ${internalLinkGraph.isolatedPages.length} isolated pages with no internal links`,
          affectedPages: internalLinkGraph.isolatedPages.slice(0, 10),
          fixInstructions: `Add internal links to and from these pages to connect them to your site structure.`,
          priority: 5
        } as any)
      }
      } catch (error) {
        console.warn('[Audit] Internal link graph analysis failed:', error)
      }
    
    // Duplicate URL analysis (Agency tier)
    console.log('[Audit] Agency tier: Running duplicate URL analysis...')
    try {
      const { analyzeDuplicateUrls } = await import('./duplicateUrlCleaner')
      duplicateUrlAnalysis = analyzeDuplicateUrls(uniquePages)
      console.log(`[Audit] Duplicate URL analysis: ${duplicateUrlAnalysis.totalDuplicates} duplicates, ${duplicateUrlAnalysis.canonicalConflicts} conflicts`)
      
      // Add duplicate URL issues
      if (duplicateUrlAnalysis.duplicateGroups.length > 0) {
        allIssues.push({
          severity: 'High' as const,
          category: 'Technical' as const,
          message: `Found ${duplicateUrlAnalysis.totalDuplicates} duplicate URL variations across ${duplicateUrlAnalysis.duplicateGroups.length} groups`,
          affectedPages: duplicateUrlAnalysis.duplicateGroups.flatMap(g => g.duplicates).slice(0, 20),
          fixInstructions: `Consolidate duplicate URLs using 301 redirects and canonical tags. Choose one preferred URL format (HTTPS, with/without www, with/without trailing slash) and redirect all variations to it.`,
          priority: 9
        } as any)
      }
      
      // Add canonical conflict issues
      // CRITICAL FIX #10: Separate high-priority conflicts from low-priority (related category pages)
      if (duplicateUrlAnalysis.canonicalConflicts > 0) {
        allIssues.push({
          severity: 'High' as const,
          category: 'Technical' as const,
          message: `Found ${duplicateUrlAnalysis.canonicalConflicts} canonical tag conflicts`,
          affectedPages: [],
          fixInstructions: `Review and update canonical tags to match the recommended canonical URLs. Ensure all variations of a URL point to the same canonical.`,
          priority: 8
        } as any)
      }
      
      // CRITICAL FIX #10: Add low-priority canonical conflicts (related category pages)
      if ((duplicateUrlAnalysis as any).lowPriorityCanonicalConflicts > 0) {
        allIssues.push({
          severity: 'Low' as const,
          category: 'Technical' as const,
          message: `Found ${(duplicateUrlAnalysis as any).lowPriorityCanonicalConflicts} canonical tags pointing to related category pages`,
          affectedPages: [],
          details: `Some pages have canonical tags pointing to related category pages. This is often intentional for category hierarchies, but review to ensure it's the desired behavior.`,
          fixInstructions: `Review canonical tags that point to category pages. If this is intentional (e.g., consolidating category pages), no action needed. Otherwise, update to point to the page itself.`,
          priority: 2
        } as any)
      }
    } catch (error) {
      console.warn('[Audit] Duplicate URL analysis failed:', error)
    }
  }
  
  const endTime = Date.now()
  
  // FINAL CLEANUP: Remove any PDFs or non-HTML files from brokenPages and all issues
  // This is a defensive measure to ensure 100% accuracy
  siteWide.brokenPages = siteWide.brokenPages.filter(url => {
    const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
    return !isNonHtmlFile
  })
  
  // Filter PDFs from all issues' affectedPages
  // CRITICAL FIX: Don't remove site-wide issues that don't have affectedPages
  allIssues.forEach(issue => {
    if (issue.affectedPages && issue.affectedPages.length > 0) {
      const originalCount = issue.affectedPages.length
      issue.affectedPages = issue.affectedPages.filter((url: string) => {
        const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
        return !isNonHtmlFile
      })
      // Only mark for removal if ALL pages were filtered AND it had pages originally
      // Site-wide issues without affectedPages should NOT be removed
      if (issue.affectedPages.length === 0 && originalCount > 0) {
        (issue as any)._shouldRemove = true
      }
    }
    // CRITICAL FIX: Keep issues that don't have affectedPages (site-wide issues)
    // These are valid and should not be removed
  })
  
  // Remove issues that have no affected pages after filtering
  // BUT keep issues that are site-wide (no affectedPages field or empty array is valid for site-wide)
  const issuesBeforeFinalFilter = allIssues.length
  const finalIssues = allIssues.filter((issue: any) => {
    // Keep if not marked for removal
    if (issue._shouldRemove) {
      console.log(`[Audit] Removing issue: ${issue.message} (marked for removal)`)
      return false
    }
    // Keep if it's a site-wide issue (no affectedPages or empty array)
    if (!issue.affectedPages || issue.affectedPages.length === 0) {
      // Site-wide issues are valid - keep them
      return true
    }
    // Keep if it has valid affected pages
    return issue.affectedPages.length > 0
  })
  console.log(`[Audit] Issues before final filter: ${issuesBeforeFinalFilter}, after: ${finalIssues.length}`)
  allIssues.length = 0
  allIssues.push(...finalIssues)
  
  // DEBUG: Log actual category values AFTER filtering
  const categoryCountsAfter = new Map<string, number>()
  allIssues.forEach(issue => {
    const cat = issue.category || 'unknown'
    categoryCountsAfter.set(cat, (categoryCountsAfter.get(cat) || 0) + 1)
  })
  console.log(`[Audit] Issue categories found (AFTER filtering): ${Array.from(categoryCountsAfter.entries()).map(([cat, count]) => `${cat}=${count}`).join(', ')}`)
  
  // CRITICAL FIX: Categorize issues directly from allIssues array
  // Don't rely on categorizeIssues() function which seems to have a bug
  const finalCategorizedIssues = {
    technical: allIssues.filter(i => i.category === 'Technical'),
    onPage: allIssues.filter(i => i.category === 'On-page'),
    content: allIssues.filter(i => i.category === 'Content'),
    accessibility: allIssues.filter(i => i.category === 'Accessibility'),
    performance: allIssues.filter(i => i.category === 'Performance')
  }
  
  // DEBUG: Log categorization results
  console.log(`[Audit] Final issue categorization: Technical=${finalCategorizedIssues.technical.length}, On-page=${finalCategorizedIssues.onPage.length}, Content=${finalCategorizedIssues.content.length}, Accessibility=${finalCategorizedIssues.accessibility.length}, Performance=${finalCategorizedIssues.performance.length}`)
  console.log(`[Audit] Total issues after final filtering: ${allIssues.length}`)
  
  // Verify categorization worked
  const totalCategorized = finalCategorizedIssues.technical.length + 
                          finalCategorizedIssues.onPage.length + 
                          finalCategorizedIssues.content.length + 
                          finalCategorizedIssues.accessibility.length + 
                          finalCategorizedIssues.performance.length
  if (totalCategorized !== allIssues.length) {
    console.warn(`[Audit] ⚠️ WARNING: Categorization mismatch! Total issues: ${allIssues.length}, Categorized: ${totalCategorized}`)
    // Log uncategorized issues
    const uncategorized = allIssues.filter(i => 
      i.category !== 'Technical' && 
      i.category !== 'On-page' && 
      i.category !== 'Content' && 
      i.category !== 'Accessibility' && 
      i.category !== 'Performance'
    )
    if (uncategorized.length > 0) {
      console.warn(`[Audit] Uncategorized issues (${uncategorized.length}):`, uncategorized.map(i => ({ category: i.category, message: i.message })))
    }
  }
  
  // CRITICAL FIX: If categorized arrays are empty but scores are low, regenerate issues from scores
  // This is a fallback to ensure issues match scores
  if (allIssues.length === 0 && (scores.technical < 70 || scores.onPage < 70 || scores.content < 70)) {
    console.log(`[Audit] ⚠️ WARNING: No issues found but scores are low. This indicates a bug in issue generation or filtering.`)
    console.log(`[Audit] Scores suggest issues exist: Technical=${scores.technical}, OnPage=${scores.onPage}, Content=${scores.content}`)
    // Don't create fake issues, but log the problem
  }
  
  // Calculate severity counts from all issues (use allIssues, not categorized)
  const highSeverityIssues = allIssues.filter(i => i.severity === 'High')
  const mediumSeverityIssues = allIssues.filter(i => i.severity === 'Medium')
  const lowSeverityIssues = allIssues.filter(i => i.severity === 'Low')
  
  // DEBUG: Log severity counts
  console.log(`[Audit] Final severity counts: High=${highSeverityIssues.length}, Medium=${mediumSeverityIssues.length}, Low=${lowSeverityIssues.length}`)
  
  // SPRINT 1: Return with crawl diagnostics and valid pages only
  const result = {
    summary: {
      totalPages: validPages.length, // Use valid pages count
      totalPagesCrawled: uniquePages.length, // Total including errors
      errorPages: errorPages.length, // NEW: Error page count
      overallScore: scores.overall,
      technicalScore: scores.technical,
      onPageScore: scores.onPage,
      contentScore: scores.content,
      accessibilityScore: scores.accessibility,
      highSeverityIssues: highSeverityIssues.length,
      mediumSeverityIssues: mediumSeverityIssues.length,
      lowSeverityIssues: lowSeverityIssues.length,
      extractedKeywords: topKeywords.length > 0 ? topKeywords : undefined,
    },
    technicalIssues: finalCategorizedIssues.technical,
    onPageIssues: finalCategorizedIssues.onPage,
    contentIssues: finalCategorizedIssues.content,
    accessibilityIssues: finalCategorizedIssues.accessibility,
    performanceIssues: finalCategorizedIssues.performance,
    pages: validPages, // Return only valid pages for SEO analysis
    allPages: htmlUniquePages, // NEW: All pages including errors (for page-level table), already filtered for non-HTML files
    siteWide: {
      ...siteWide,
      brokenPages: siteWide.brokenPages.filter(url => {
        // Final safety check: ensure no PDFs in brokenPages
        const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
        return !isNonHtmlFile
      })
    },
    imageAltAnalysis,
    competitorAnalysis,
    crawlDiagnostics, // NEW: Crawl diagnostics
    localSEO, // NEW: Local SEO analysis (Sprint 2)
    enhancedTechnical: enhancedTechnicalData, // NEW: Enhanced technical SEO data
    mobileResponsiveness: mobileResponsivenessData, // NEW: Mobile responsiveness analysis
    serverTechnology: serverTechnologyData, // NEW: Server technology detection
    internalLinkGraph, // NEW: Agency tier - Internal link graph
    duplicateUrlAnalysis, // NEW: Agency tier - Duplicate URL analysis
    raw: {
      startTime,
      endTime,
      crawlDuration: endTime - startTime,
      options: {
        maxPages: opts.maxPages,
        maxDepth: opts.maxDepth,
        userAgent: opts.userAgent,
        tier: opts.tier,
        addOns: opts.addOns
      }
    }
  }
  
  // DEBUG: Verify result has issues before returning
  const totalResultIssues = result.technicalIssues.length + result.onPageIssues.length + 
                           result.contentIssues.length + result.accessibilityIssues.length + 
                           result.performanceIssues.length
  console.log(`[Audit] Result being returned: Technical=${result.technicalIssues.length}, On-page=${result.onPageIssues.length}, Content=${result.contentIssues.length}, Total=${totalResultIssues}`)
  
  return result
  } finally {
    // Ensure browser is always closed, even if audit fails
    if (browserInitialized && closeBrowserFn) {
      try {
        await closeBrowserFn()
        console.log('[Audit] Browser closed successfully')
      } catch (error) {
        console.warn('[Audit] Error closing browser:', error)
      }
    }
  }
}

/**
 * Normalize URL to root domain
 */
// OLD normalizeUrl function replaced with new implementation
// Using normalizeUrlNew from urlNormalizer.ts
function normalizeUrl(url: string): string {
  return normalizeUrlNew(url)
}

// CrawlContext now imported from urlNormalizer.ts
// getRootDomain now imported from urlNormalizer.ts

// OLD canonicalizeUrl replaced - now using import from urlNormalizer.ts
// (import statement already added above)

/**
 * Check robots.txt with enhanced validation (Standard+ tiers)
 */
async function checkRobotsTxt(rootUrl: string, siteWide: SiteWideData): Promise<void> {
  try {
    const robotsUrl = new URL('/robots.txt', rootUrl).toString()
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': DEFAULT_OPTIONS.userAgent }
    })
    
    siteWide.robotsTxtExists = true
    siteWide.robotsTxtReachable = response.ok
    
    // Enhanced validation for Standard+ tiers
    if (response.ok) {
      const robotsText = await response.text()
      
      // Validate robots.txt format and content
      const lines = robotsText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
      const hasUserAgent = lines.some(l => l.toLowerCase().startsWith('user-agent:'))
      const hasDisallow = lines.some(l => l.toLowerCase().startsWith('disallow:'))
      const hasAllow = lines.some(l => l.toLowerCase().startsWith('allow:'))
      const hasSitemap = lines.some(l => l.toLowerCase().startsWith('sitemap:'))
      
      // Store validation results in siteWide (extend interface if needed)
      ;(siteWide as any).robotsTxtValidation = {
        hasUserAgent,
        hasDisallow,
        hasAllow,
        hasSitemap,
        lineCount: lines.length,
        isValid: hasUserAgent || hasDisallow || hasAllow || hasSitemap
      }
    }
  } catch {
    siteWide.robotsTxtExists = false
    siteWide.robotsTxtReachable = false
  }
}

/**
 * Check sitemap.xml with enhanced validation (Standard+ tiers)
 */
async function checkSitemap(rootUrl: string, siteWide: SiteWideData): Promise<void> {
  try {
    const sitemapUrl = new URL('/sitemap.xml', rootUrl).toString()
    const response = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': DEFAULT_OPTIONS.userAgent }
    })
    
    siteWide.sitemapExists = true
    siteWide.sitemapReachable = response.ok
    
    // Enhanced validation for Standard+ tiers
    if (response.ok) {
      const sitemapText = await response.text()
      
      // Validate sitemap.xml format
      const urlMatches = sitemapText.match(/<url>/gi) || []
      const locMatches = sitemapText.match(/<loc>/gi) || []
      const lastmodMatches = sitemapText.match(/<lastmod>/gi) || []
      const changefreqMatches = sitemapText.match(/<changefreq>/gi) || []
      const priorityMatches = sitemapText.match(/<priority>/gi) || []
      
      // Check if it's a sitemap index (references other sitemaps)
      const isSitemapIndex = sitemapText.includes('<sitemapindex>') || sitemapText.includes('<sitemap>')
      
      // Extract URLs from sitemap
      const urlPattern = /<loc>\s*([^<]+)\s*<\/loc>/gi
      const urls: string[] = []
      let match
      while ((match = urlPattern.exec(sitemapText)) !== null) {
        urls.push(match[1].trim())
      }
      
      // Store validation results
      ;(siteWide as any).sitemapValidation = {
        urlCount: urls.length,
        hasLastmod: lastmodMatches.length > 0,
        hasChangefreq: changefreqMatches.length > 0,
        hasPriority: priorityMatches.length > 0,
        isSitemapIndex,
        isValid: urlMatches.length > 0 && locMatches.length > 0,
        sampleUrls: urls.slice(0, 10) // Store first 10 URLs for reference
      }
    }
  } catch {
    siteWide.sitemapExists = false
    siteWide.sitemapReachable = false
  }
}

// OLD isSameDomain replaced - now using import from urlNormalizer.ts
// (import statement already added above)

/**
 * Extract internal links from HTML
 */
function extractInternalLinks(html: string, baseUrl: string, baseDomain: string): string[] {
  const links = new Set<string>()
  const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["']/gi) || []
  
  try {
    linkMatches.forEach(link => {
      const hrefMatch = link.match(/href=["']([^"']+)["']/i)
      if (hrefMatch) {
        try {
          // Skip anchor links, javascript:, mailto:, tel:, etc.
          const href = hrefMatch[1].trim()
          if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '' || href === '/') {
            return
          }
          
          const linkUrl = new URL(href, baseUrl)
          // Use isSameDomain to handle subdomains (e.g., en.wikipedia.org matches wikipedia.org)
          if (isSameDomain(linkUrl.hostname, baseDomain)) {
            // Normalize the URL (remove hash, trailing slash if not root)
            const normalizedUrl = normalizeUrl(linkUrl.toString())
            if (normalizedUrl) {
              links.add(normalizedUrl)
            }
          }
        } catch {
          // Relative URL - try to resolve it
          try {
            const relativeUrl = new URL(hrefMatch[1], baseUrl)
            if (isSameDomain(relativeUrl.hostname, baseDomain)) {
              const normalizedUrl = normalizeUrl(relativeUrl.toString())
              if (normalizedUrl) {
                links.add(normalizedUrl)
              }
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }
    })
  } catch {
    // Can't parse base URL, return empty array
  }
  
  return Array.from(links)
}

/**
 * Crawl pages recursively
 */
async function crawlPages(
  startUrl: string,
  baseDomain: string,
  options: Required<AuditOptions>,
  crawledUrls: Set<string>,
  pages: PageData[],
  issues: Issue[],
  needsImageDetails = false
): Promise<void> {
  const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }]
  const issueMap = new Map<string, Issue>()
  const startTime = Date.now()
  
  // Track actual domain (may differ from baseDomain if redirects occur)
  let actualDomain = baseDomain
  
  while (queue.length > 0 && pages.length < options.maxPages) {
    const { url, depth } = queue.shift()!
    
    if (crawledUrls.has(url) || depth > options.maxDepth) {
      continue
    }
    
    // Skip non-HTML files (PDFs, images, etc.) - don't analyze them
    const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
    if (isNonHtmlFile) {
      console.log(`[Audit Progress] Skipping non-HTML file: ${url}`)
      crawledUrls.add(url) // Mark as crawled so we don't try again
      continue
    }
    
    crawledUrls.add(url)
    
    try {
      // Log progress
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      console.log(`[Audit Progress] Analyzing page ${pages.length + 1}/${options.maxPages}: ${url} (${elapsed}s elapsed)`)
      
      // CRITICAL FIX: Skip PDFs and non-HTML files before analyzing
      const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
      if (isNonHtmlFile) {
        console.log(`[Audit Progress] Skipping non-HTML file from analysis: ${url}`)
        continue // Skip to next URL in queue
      }
      
      // Check if this is the main/start page
      const isMainPage = url === startUrl && depth === 0
      const pageStartTime = Date.now()
      const pageData = await analyzePage(url, options.userAgent, needsImageDetails, isMainPage)
      const pageTime = Math.round((Date.now() - pageStartTime) / 1000)
      console.log(`[Audit Progress] Completed page ${pages.length + 1} in ${pageTime}s`)
      pages.push(pageData)
      
      // Generate performance issues (checks both performanceMetrics and pageSpeedData)
      const perfIssues = generatePerformanceIssues(pageData)
      perfIssues.forEach(issue => {
        consolidateIssue(issueMap, issue)
      })
      
      // Generate LLM Readability issues if data is available
      if (pageData.llmReadability) {
        const llmIssues = generateLLMReadabilityIssues(pageData.url, pageData.llmReadability)
        llmIssues.forEach(issue => {
          consolidateIssue(issueMap, issue)
        })
      }
      
      // Extract internal links for further crawling
      // CRITICAL FIX: Use rendered HTML links from pageData (already extracted from rendered DOM)
      // This ensures we get links that are only visible after JavaScript execution
      if (depth < options.maxDepth) {
        let internalLinks: string[] = []
        
        // First, try to use links from pageData (extracted from rendered HTML)
        if (pageData.internalLinks && pageData.internalLinks.length > 0) {
          internalLinks = [...pageData.internalLinks]
          console.log(`[Audit Progress] Using ${internalLinks.length} internal links from rendered HTML for ${url}`)
        } else {
          // Fallback: Re-fetch the HTML to extract links if pageData doesn't have them
          // This should rarely happen, but provides a fallback
          try {
            console.log(`[Audit Progress] No rendered links found, falling back to fetch for ${url}...`)
            const response = await fetch(url, {
              signal: AbortSignal.timeout(15000), // Increased timeout to 15s
              headers: { 'User-Agent': options.userAgent },
              redirect: 'follow' // Explicitly follow redirects
            })
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }
            
            const html = await response.text()
          
            // Update actualDomain from response URL if it redirected
            // response.url is the final URL after redirects
            try {
              const responseUrl = new URL(response.url)
              const currentUrlObj = new URL(url)
              
              // If the response URL is different from the request URL, we were redirected
              if (responseUrl.hostname !== currentUrlObj.hostname) {
                // Always update to the response domain (it's the actual domain we're on)
                // This handles cases like wikipedia.com -> www.wikipedia.org
                // We need to use the actual domain we landed on, not the original
                actualDomain = responseUrl.hostname
                console.log(`[Audit Progress] Detected redirect: ${url} -> ${response.url}`)
                console.log(`[Audit Progress] Updated domain from ${baseDomain} to ${actualDomain}`)
              }
            } catch (err) {
              console.warn(`[Audit Progress] Could not parse response URL: ${err}`)
            }
            
            // Extract links using actualDomain (which may be a subdomain)
            // Use response.url (final URL after redirects) as the base URL
            internalLinks = extractInternalLinks(html, response.url, actualDomain)
            
            // If we still didn't find links, try with a more permissive approach
            if (internalLinks.length === 0) {
              console.log(`[Audit Progress] No links found with domain ${actualDomain}, trying broader extraction...`)
              // Try extracting all links and see what domains we find
              const allLinkMatches = html.match(/<a[^>]*href=["']([^"']+)["']/gi) || []
              const foundDomains = new Set<string>()
              allLinkMatches.slice(0, 20).forEach(link => {
                const hrefMatch = link.match(/href=["']([^"']+)["']/i)
                if (hrefMatch) {
                  try {
                    const href = hrefMatch[1].trim()
                    if (!href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                      const linkUrl = new URL(href, response.url)
                      foundDomains.add(linkUrl.hostname)
                    }
                  } catch {}
                }
              })
              
              if (foundDomains.size > 0) {
                console.log(`[Audit Progress] Found links with domains: ${Array.from(foundDomains).slice(0, 5).join(', ')}${foundDomains.size > 5 ? '...' : ''}`)
                
                // Try each domain to see if it matches our actual domain (after redirect)
                // This handles cases where links point to subdomains like en.wikipedia.org
                for (const foundDomain of foundDomains) {
                  if (isSameDomain(foundDomain, actualDomain)) {
                    console.log(`[Audit Progress] Found matching subdomain ${foundDomain}, extracting links...`)
                    internalLinks = extractInternalLinks(html, response.url, foundDomain)
                    if (internalLinks.length > 0) {
                      // Use the first subdomain that works (e.g., en.wikipedia.org)
                      // This ensures we can crawl pages on that subdomain
                      actualDomain = foundDomain
                      console.log(`[Audit Progress] Successfully extracted ${internalLinks.length} links using domain ${actualDomain}`)
                      break
                    }
                  }
                }
                
                // If still no links, try with the response domain directly
                if (internalLinks.length === 0 && foundDomains.size > 0) {
                  console.log(`[Audit Progress] Trying with response domain ${actualDomain} directly...`)
                  internalLinks = extractInternalLinks(html, response.url, actualDomain)
                }
              } else {
                console.log(`[Audit Progress] No link hrefs found in HTML at all`)
              }
            }
            
            if (internalLinks.length > 0) {
              console.log(`[Audit Progress] Extracted ${internalLinks.length} internal links from ${url} (using domain: ${actualDomain})`)
            } else {
              console.log(`[Audit Progress] No internal links found on ${url} (checked domain: ${actualDomain}, response URL: ${response.url})`)
            }
            
            // If we didn't find many links, try a more aggressive extraction
            if (internalLinks.length < 5 && depth === 0) {
              // For the homepage, try to find more links with a broader pattern
              const allLinks = html.match(/<a[^>]*href=["']([^"']+)["']/gi) || []
              const additionalLinks = new Set<string>()
              
              allLinks.forEach(link => {
                const hrefMatch = link.match(/href=["']([^"']+)["']/i)
                if (hrefMatch) {
                  try {
                    const href = hrefMatch[1].trim()
                    // Skip anchors, javascript, mailto, etc.
                    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '' || href === '/') {
                      return
                    }
                    
                    const linkUrl = new URL(href, url)
                    if (isSameDomain(linkUrl.hostname, actualDomain)) {
                      const normalizedUrl = normalizeUrl(linkUrl.toString())
                      if (normalizedUrl && !internalLinks.includes(normalizedUrl)) {
                        additionalLinks.add(normalizedUrl)
                      }
                    }
                  } catch {
                    // Try as relative URL
                    try {
                      const hrefValue = hrefMatch[1].trim()
                      if (!hrefValue.startsWith('http') && !hrefValue.startsWith('//')) {
                        const relativeUrl = new URL(hrefValue, url)
                        if (isSameDomain(relativeUrl.hostname, actualDomain)) {
                          const normalizedUrl = normalizeUrl(relativeUrl.toString())
                          if (normalizedUrl && !internalLinks.includes(normalizedUrl)) {
                            additionalLinks.add(normalizedUrl)
                          }
                        }
                      }
                    } catch {
                      // Invalid URL, skip
                    }
                  }
                }
              })
              
              internalLinks.push(...Array.from(additionalLinks))
            }
          } catch (error) {
            console.warn(`[Audit Progress] Link extraction failed for ${url}:`, error instanceof Error ? error.message : String(error))
          }
        }
        
        // Add discovered internal links to queue (limit to prevent queue explosion)
        // This happens regardless of whether we used pageData.internalLinks or fallback fetch
        const linksToAdd = internalLinks.slice(0, 20) // Limit to first 20 links per page
        for (const linkUrl of linksToAdd) {
          const normalizedLinkUrl = normalizeUrl(linkUrl)
          if (!crawledUrls.has(normalizedLinkUrl) && !queue.some(q => q.url === normalizedLinkUrl)) {
            // Skip non-HTML files (PDFs, images, etc.) from crawl queue
            const isNonHtmlFile = normalizedLinkUrl.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
            if (!isNonHtmlFile) {
              queue.push({ url: normalizedLinkUrl, depth: depth + 1 })
            }
          }
        }
        
        // Log if we found links
        if (internalLinks.length > 0) {
          console.log(`[Audit Progress] Found ${internalLinks.length} internal links on ${url}, added ${Math.min(linksToAdd.length, internalLinks.length)} to queue`)
        }
      }
    } catch (error) {
      // Skip non-HTML files even if they error - don't add them to pages
      const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
      if (!isNonHtmlFile) {
        pages.push({
          url,
          statusCode: 0,
          loadTime: 0,
          contentType: 'text/html',
          h1Count: 0,
          h2Count: 0,
          wordCount: 0,
          imageCount: 0,
          missingAltCount: 0,
          internalLinkCount: 0,
          externalLinkCount: 0,
          hasNoindex: false,
          hasNofollow: false,
          hasViewport: false,
          hasSchemaMarkup: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      } else {
        console.log(`[Audit Progress] Skipping error for non-HTML file: ${url}`)
      }
    }
  }
  
  // Add consolidated issues from crawl to main issues array
  issueMap.forEach(issue => {
    issues.push(issue)
  })
}

/**
 * Analyze a single page using JavaScript rendering
 */
async function analyzePage(url: string, userAgent: string, needsImageDetails = false, isMainPage = false): Promise<PageData> {
  try {
    // Use Puppeteer to render the page with JavaScript execution
    const rendered = await renderPage(url, userAgent)
    
    // Get initial HTML for comparison (for LLM readability later)
    let initialHtml = ''
    try {
      const initialResponse = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': userAgent }
      })
      initialHtml = await initialResponse.text()
    } catch {
      // If initial fetch fails, use rendered HTML
      initialHtml = rendered.renderedHtml
    }
    
    // Calculate LLM Readability (rendering percentage)
    const llmReadability = calculateRenderingPercentage(initialHtml, rendered.renderedHtml)
    
    // Check HTTP version and compression (quick checks)
    const [httpVersion, compression] = await Promise.all([
      checkHttpVersion(url, userAgent),
      checkCompression(url, userAgent)
    ])
    
    // Fetch PageSpeed Insights (only for main page to save API calls and time)
    // This is async and won't block the audit, but we'll wait for it
    if (isMainPage) {
      console.log(`[Audit Progress] Fetching PageSpeed Insights for main page (this may take 60+ seconds)...`)
    }
    const pageSpeedPromise = isMainPage ? fetchPageSpeedInsights(url) : Promise.resolve(null)
    
    // Parse the rendered HTML
    const pageData = await parseHtmlWithRenderer(
      rendered.renderedHtml,
      initialHtml,
      url,
      rendered.statusCode,
      rendered.loadTime,
      rendered.contentType,
      rendered.metrics,
      rendered.imageData,
      rendered.linkData,
      llmReadability,
      needsImageDetails,
      httpVersion,
      compression,
      rendered.h1Data // CRITICAL FIX: Pass H1s extracted from rendered DOM
    )
    
    // Wait for PageSpeed data and add it
    const pageSpeedData = await pageSpeedPromise
    if (pageSpeedData) {
      // NEW: Validate performance metrics
      // Extract mobile metrics for validation (or use simplified structure if available)
      const metrics = (pageSpeedData as any).mobile || pageSpeedData
      const validated = validatePerformanceMetrics({
        lcp: metrics.lcp,
        fcp: metrics.fcp,
        cls: metrics.cls,
        ttfb: metrics.ttfb
      })
      if (validated.warnings.length > 0) {
        console.warn(`[Performance] Validation warnings for ${url}:`, validated.warnings)
      }
      pageData.pageSpeedData = {
        lcp: validated.lcp,
        fcp: validated.fcp,
        cls: validated.cls,
        ttfb: validated.ttfb
      }
    }
    
    return pageData
  } catch (error: any) {
    // Check if it's a connection error - if so, try to recreate browser and retry once
    const errorMessage = error?.message || String(error)
    const isConnectionError = /ECONNRESET|socket hang up|Connection closed|Target closed/i.test(errorMessage)
    
    if (isConnectionError) {
      console.warn(`[Renderer] Connection error for ${url}, attempting browser recovery...`)
      try {
        // Force browser recreation
        const { closeBrowser, initializeBrowser } = await import('./renderer')
        await closeBrowser()
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait a bit
        await initializeBrowser()
        
        // Retry once with fresh browser
        console.log(`[Renderer] Retrying ${url} with fresh browser...`)
        const rendered = await renderPage(url, userAgent, 0) // No additional retries in renderPage
        
        let initialHtml = ''
        try {
          const initialResponse = await fetch(url, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': userAgent }
          })
          initialHtml = await initialResponse.text()
        } catch {
          initialHtml = rendered.renderedHtml
        }
        
        const llmReadability = calculateRenderingPercentage(initialHtml, rendered.renderedHtml)
        const [httpVersion, compression] = await Promise.all([
          checkHttpVersion(url, userAgent),
          checkCompression(url, userAgent)
        ])
        
        const pageSpeedPromise = isMainPage ? fetchPageSpeedInsights(url) : Promise.resolve(null)
        const pageData = await parseHtmlWithRenderer(
          rendered.renderedHtml,
          initialHtml,
          url,
          rendered.statusCode,
          rendered.loadTime,
          rendered.contentType,
          rendered.metrics,
          rendered.imageData,
          rendered.linkData,
          llmReadability,
          needsImageDetails,
          httpVersion,
          compression
        )
        
        const pageSpeedData = await pageSpeedPromise
        if (pageSpeedData) {
          // NEW: Validate performance metrics
          // Extract mobile metrics for validation (or use simplified structure if available)
          const metrics = (pageSpeedData as any).mobile || pageSpeedData
          const validated = validatePerformanceMetrics({
            lcp: metrics.lcp,
            fcp: metrics.fcp,
            cls: metrics.cls,
            ttfb: metrics.ttfb
          })
          if (validated.warnings.length > 0) {
            console.warn(`[Performance] Validation warnings for ${url}:`, validated.warnings)
          }
          pageData.pageSpeedData = {
            lcp: validated.lcp,
            fcp: validated.fcp,
            cls: validated.cls,
            ttfb: validated.ttfb
          }
        }
        
        return pageData
      } catch (retryError) {
        console.warn(`[Renderer] Retry also failed for ${url}, falling back to basic fetch:`, retryError)
      }
    } else {
      console.warn(`Rendering failed for ${url}, falling back to basic fetch:`, error)
    }
    
    // If Puppeteer fails or retry fails, fall back to basic fetch
    const fallbackData = await analyzePageFallback(url, userAgent)
    
    // Still try to get HTTP version and compression even in fallback
    try {
      const [httpVersion, compression] = await Promise.all([
        checkHttpVersion(url, userAgent),
        checkCompression(url, userAgent)
      ])
      fallbackData.httpVersion = httpVersion
      fallbackData.compression = compression
    } catch {
      // Ignore errors for technical checks
    }
    
    return fallbackData
  }
}

/**
 * Fallback: Analyze page without JavaScript rendering
 */
async function analyzePageFallback(url: string, userAgent: string): Promise<PageData> {
  // CRITICAL FIX: Don't try to analyze PDFs or non-HTML files
  const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
  if (isNonHtmlFile) {
    throw new Error(`Cannot analyze non-HTML file: ${url}`)
  }
  
  const startTime = Date.now()
  
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': userAgent }
    })
    
    const loadTime = Date.now() - startTime
    const contentType = response.headers.get('content-type') || ''
    
    if (!contentType.includes('text/html')) {
      throw new Error(`Not HTML: ${contentType}`)
    }
    
    const html = await response.text()
    const pageData = parseHtml(html, url, response.status, loadTime, contentType)
    
    return pageData
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Parse HTML with full rendering support (uses data from renderer)
 */
async function parseHtmlWithRenderer(
  renderedHtml: string,
  initialHtml: string,
  url: string,
  statusCode: number,
  loadTime: number,
  contentType: string,
  performanceMetrics?: PageData['performanceMetrics'],
  imageData?: RenderedPageData['imageData'],
  linkData?: RenderedPageData['linkData'],
  llmReadability?: PageData['llmReadability'],
  needsImageDetails = false,
  httpVersion?: PageData['httpVersion'],
  compression?: PageData['compression'],
  h1Data?: RenderedPageData['h1Data']
): Promise<PageData> {
  // CRITICAL FIX #11: Parse using rendered HTML (not initial HTML) for accurate content extraction
  // Parse basic HTML elements (title, meta, headers, etc.) from rendered content
  const basicData = parseHtml(renderedHtml, url, statusCode, loadTime, contentType)
  
  // CRITICAL FIX: Use H1s from rendered DOM (handles shadow DOM, React hydration, lazy-loaded headings)
  // Try multiple methods and use whichever finds H1s
  let finalH1Count = 0
  let finalH1Text: string[] | undefined = undefined
  
  // Method 1: DOM-based extraction (most accurate, handles shadow DOM)
  if (h1Data && h1Data.h1Count > 0 && h1Data.h1Text && h1Data.h1Text.length > 0) {
    finalH1Count = h1Data.h1Count
    finalH1Text = h1Data.h1Text
  } else {
    // Method 2: Parse from rendered HTML (handles cases where DOM eval failed)
    const h1Matches = renderedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || []
    const h1TextFromHtml = h1Matches.map(m => {
      // Remove HTML tags and decode entities
      const text = m.replace(/<[^>]+>/g, '').trim()
      return decode(text) // Decode HTML entities
    }).filter(Boolean)
    
    if (h1TextFromHtml.length > 0) {
      finalH1Count = h1TextFromHtml.length
      finalH1Text = h1TextFromHtml
    } else {
      // Method 3: Try case-insensitive and with attributes
      const h1MatchesCaseInsensitive = renderedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || []
      const h1TextCaseInsensitive = h1MatchesCaseInsensitive.map(m => {
        const text = m.replace(/<[^>]+>/g, '').trim()
        return decode(text)
      }).filter(Boolean)
      
      if (h1TextCaseInsensitive.length > 0) {
        finalH1Count = h1TextCaseInsensitive.length
        finalH1Text = h1TextCaseInsensitive
      } else {
        // Method 4: Try to find H1-like elements (data attributes, classes, etc.)
        const h1LikeMatches = renderedHtml.match(/(?:<h1|data-h1|class=["'][^"']*h1[^"']*["']|role=["']heading["'][^>]*aria-level=["']1["'])[^>]*>([\s\S]*?)(?:<\/h1>|<\/[^>]+>)/gi) || []
        const h1LikeText = h1LikeMatches.map(m => {
          const text = m.replace(/<[^>]+>/g, '').trim()
          return decode(text)
        }).filter(Boolean)
        
        if (h1LikeText.length > 0) {
          finalH1Count = h1LikeText.length
          finalH1Text = h1LikeText
        }
      }
    }
  }
  
  // Apply final H1 data
  if (finalH1Count > 0 && finalH1Text && finalH1Text.length > 0) {
    basicData.h1Count = finalH1Count
    basicData.h1Text = finalH1Text
  }
  
  // Use image/link data from renderer, or fall back to regex
  let finalImageData = { imageCount: 0, missingAltCount: 0 }
  let finalLinkData = { internalLinkCount: 0, externalLinkCount: 0 }
  
  if (imageData) {
    finalImageData = {
      imageCount: imageData.imageCount,
      missingAltCount: imageData.missingAltCount
    }
  } else {
    // Fall back to regex-based detection
    // CRITICAL FIX: Match renderer's logic - count missing alt as empty, missing, or "undefined"
    const imageMatches = renderedHtml.match(/<img[^>]*>/gi) || []
    finalImageData = {
      imageCount: imageMatches.length,
      missingAltCount: imageMatches.filter(img => {
        // Match renderer logic: missing alt if no alt attribute, empty alt, or alt="undefined"
        const altMatch = img.match(/alt=["']([^"']*)["']/i)
        return !altMatch || altMatch[1].trim() === '' || altMatch[1].trim() === 'undefined'
      }).length
    }
  }
  
  // Extract internal links array for link graph analysis
  // CRITICAL FIX: Use linkData from renderer if available (extracted from rendered DOM)
  // This ensures we get links that are only visible after JavaScript execution
  const internalLinks: string[] = []
  let internalCount = 0
  let externalCount = 0
  
  // First, try to use links from linkData (extracted from rendered DOM)
  if (linkData && linkData.links && linkData.links.length > 0) {
    // Use links from rendered DOM (most accurate)
    linkData.links.forEach(link => {
      if (link.isInternal) {
        internalCount++
        // Normalize the URL
        try {
          const normalizedLink = normalizeUrl(link.href)
          if (normalizedLink && !internalLinks.includes(normalizedLink)) {
            internalLinks.push(normalizedLink)
          }
        } catch {
          // Invalid URL, skip
        }
      } else {
        externalCount++
      }
    })
  } else {
    // Fallback: Extract links from rendered HTML using regex
    // Extract main content areas first (prefer <main>, <article>, <section>)
    let mainContentHtml = ''
    const mainMatch = renderedHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
    const articleMatch = renderedHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    const sectionMatches = renderedHtml.match(/<section[^>]*>([\s\S]*?)<\/section>/gi) || []
    
    if (mainMatch) {
      mainContentHtml = mainMatch[1]
    } else if (articleMatch) {
      mainContentHtml = articleMatch[1]
    } else if (sectionMatches.length > 0) {
      // Use all sections combined
      mainContentHtml = sectionMatches.join(' ')
    } else {
      // Fallback: exclude common nav/header/footer patterns
      mainContentHtml = renderedHtml
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    }
    
    // Only extract links from main content
    const linkMatches = mainContentHtml.match(/<a[^>]*href=["']([^"']+)["']/gi) || []
    const baseUrl = new URL(url)
    
    linkMatches.forEach(link => {
      const hrefMatch = link.match(/href=["']([^"']+)["']/i)
      if (hrefMatch) {
        try {
          const href = hrefMatch[1].trim()
          // Skip anchors, javascript, mailto, etc.
          if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '' || href === '/') {
            return
          }
          
          const linkUrl = new URL(href, url)
          if (linkUrl.hostname === baseUrl.hostname || linkUrl.hostname.replace(/^www\./, '') === baseUrl.hostname.replace(/^www\./, '')) {
            internalCount++
            // Store normalized internal link URL
            const normalizedLink = normalizeUrl(linkUrl.toString())
            if (normalizedLink && !internalLinks.includes(normalizedLink)) {
              internalLinks.push(normalizedLink)
            }
          } else {
            externalCount++
          }
        } catch {
          // Try as relative URL
          try {
            if (!hrefMatch[1].startsWith('http') && !hrefMatch[1].startsWith('//')) {
              const relativeUrl = new URL(hrefMatch[1], url)
              if (relativeUrl.hostname === baseUrl.hostname || relativeUrl.hostname.replace(/^www\./, '') === baseUrl.hostname.replace(/^www\./, '')) {
                internalCount++
                const normalizedLink = normalizeUrl(relativeUrl.toString())
                if (normalizedLink && !internalLinks.includes(normalizedLink)) {
                  internalLinks.push(normalizedLink)
                }
              } else {
                externalCount++
              }
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }
    })
  }
  
  // Use linkData counts if available, otherwise use extracted counts
  if (linkData) {
    finalLinkData = {
      internalLinkCount: linkData.internalLinkCount || internalCount,
      externalLinkCount: linkData.externalLinkCount || externalCount
    }
  } else {
    finalLinkData = {
      internalLinkCount: internalCount,
      externalLinkCount: externalCount
    }
  }
  
  return {
    ...basicData,
    imageCount: finalImageData.imageCount,
    missingAltCount: finalImageData.missingAltCount,
    internalLinkCount: finalLinkData.internalLinkCount,
    externalLinkCount: finalLinkData.externalLinkCount,
    internalLinks: internalLinks.length > 0 ? internalLinks : undefined, // Store actual internal link URLs
    performanceMetrics,
    llmReadability,
    httpVersion,
    compression
  }
}

/**
 * Parse HTML and extract SEO data
 */
function parseHtml(
  html: string,
  url: string,
  statusCode: number,
  loadTime: number,
  contentType: string,
  needsImageDetails = false
): PageData {
  // Remove scripts and styles
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  
  // NEW: Use improved title/meta extractors
  const titleData = extractTitle(html)
  const title = titleData?.title
  const titleLength = titleData?.length
  const titlePixelWidth = titleData?.pixelWidth
  
  const metaData = extractMetaDescription(html)
  const metaDescription = metaData?.description
  const metaLength = metaData?.length
  
  const canonical = extractCanonical(html)
  
  // Extract H1 tags
  const h1Matches = cleanHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || []
  const h1Text = h1Matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean)
  
  // Extract images
  // CRITICAL FIX: Match renderer's logic for consistent alt text counting
  const imageMatches = cleanHtml.match(/<img[^>]*>/gi) || []
  const missingAltCount = imageMatches.filter(img => {
    // Match renderer logic: missing alt if no alt attribute, empty alt, or alt="undefined"
    const altMatch = img.match(/alt=["']([^"']*)["']/i)
    return !altMatch || altMatch[1].trim() === '' || altMatch[1].trim() === 'undefined'
  }).length
  
  // NEW: Extract links using improved classification
  // CRITICAL FIX: Only count links in main content areas, exclude nav/footer/header
  // Extract main content areas first (prefer <main>, <article>, <section>)
  // Note: We'll reuse the same logic as word count extraction below
  let linkContentHtml = ''
  const linkMainMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  const linkArticleMatch = cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const linkSectionMatches = cleanHtml.match(/<section[^>]*>([\s\S]*?)<\/section>/gi) || []
  
  if (linkMainMatch) {
    linkContentHtml = linkMainMatch[1]
  } else if (linkArticleMatch) {
    linkContentHtml = linkArticleMatch[1]
  } else if (linkSectionMatches.length > 0) {
    // Use all sections combined
    linkContentHtml = linkSectionMatches.join(' ')
  } else {
    // Fallback: exclude common nav/header/footer patterns
    linkContentHtml = cleanHtml
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
  }
  
  // Only extract links from main content
  const linkMatches = linkContentHtml.match(/<a[^>]*href=["']([^"']+)["']/gi) || []
  let internalLinkCount = 0
  let externalLinkCount = 0
  
  try {
    linkMatches.forEach(link => {
      const hrefMatch = link.match(/href=["']([^"']+)["']/i)
      if (hrefMatch) {
        const href = hrefMatch[1].trim()
        // Skip anchor links, javascript:, mailto:, tel:, etc.
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href === '') {
          return
        }
        
        try {
          // Use new isInternalLink function that handles domain variants
          if (isInternalLink(href, url)) {
            internalLinkCount++
          } else {
            externalLinkCount++
          }
        } catch {
          // Invalid URL, count as internal
          internalLinkCount++
        }
      }
    })
  } catch {
    // Can't parse base URL
  }
  
  // Check for noindex/nofollow
  const hasNoindex = /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)
  const hasNofollow = /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*nofollow/i.test(html)
  
  // Check for viewport meta tag
  const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html)
  
  // Enhanced schema analysis (includes Identity Schema detection)
  const schemaAnalysis = analyzeSchema(html, url)
  const hasSchemaMarkup = schemaAnalysis.hasSchema
  const schemaTypes = schemaAnalysis.schemaTypes
  
  // Extract keywords from title, H1, H2, and meta description
  // Sprint 1.4: Don't extract keywords from error pages
  const extractedKeywords: string[] = []
  const keywordSources: string[] = []
  
  // Only extract keywords if page is successful (not 404, 500, etc.)
  // CRITICAL FIX: Decode HTML entities before keyword extraction
  const { decode } = require('html-entities')
  if (statusCode >= 200 && statusCode < 400) {
    if (title) keywordSources.push(decode(title))
    if (h1Text && h1Text.length > 0) keywordSources.push(...h1Text.map(t => decode(t)))
    if (metaDescription) keywordSources.push(decode(metaDescription))
  }
  
  // Extract H2 tags (for both counting and text extraction)
  const h2Matches = cleanHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || []
  const h2Count = h2Matches.length
  const h2Text = h2Matches.map(m => decode(m.replace(/<[^>]+>/g, '').trim())).filter(Boolean)
  if (h2Text.length > 0) keywordSources.push(...h2Text.slice(0, 5)) // Limit to first 5 H2s
  
  // Extract meaningful keywords (2-3 word phrases, filtering stop words)
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
  ])
  
  keywordSources.forEach(text => {
    // CRITICAL FIX: Better normalization to prevent broken tokens
    // First decode HTML entities properly
    let normalizedText = decode(text)
      .toLowerCase()
      .trim()
    
    // Preserve hyphenated words (e.g., "enterprise-grade" should stay as one unit)
    // Replace non-word chars (except hyphens and spaces) with space
    normalizedText = normalizedText
      .replace(/[^\w\s-]/g, ' ') // Keep hyphens, remove other special chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Handle camelCase (before lowercasing, but text is already lowercased)
      .replace(/\s*-\s*/g, '-') // Normalize hyphens (remove spaces around hyphens)
      .trim()
    
    // CRITICAL FIX: Don't split hyphenated compound words
    // Words like "enterprise-grade" should remain as "enterprise-grade", not "enterprise grade" or "enterp rise-grade"
    // Split on spaces only, preserving hyphens within words
    const words = normalizedText
      .split(/\s+/) // Split on spaces only (hyphens are preserved)
      .map(w => {
        // Clean each word but preserve hyphens
        const cleaned = w.replace(/[^\w-]/g, '') // Remove non-word chars except hyphens
        // Don't split hyphenated words - they're valid compound words
        return cleaned
      })
      .filter(w => {
        // Remove empty strings
        if (!w || w.length === 0) return false
        
        // For hyphenated words, check the total length and individual parts
        if (w.includes('-')) {
          const parts = w.split('-')
          // Valid if: total length >= 6, and each part is >= 2 chars (or it's a known compound)
          const totalLength = parts.join('').length
          const allPartsValid = parts.every(p => p.length >= 2 || p.length === 0) // Allow empty parts (double hyphens)
          return totalLength >= 6 && allPartsValid && !stopWords.has(w)
        }
        
        // For non-hyphenated words, check length and stop words
        return w.length > 3 && !stopWords.has(w)
      })
      // Filter out consecutive duplicate words
      .filter((w, i, arr) => {
        if (i === 0) return true
        const prev = arr[i - 1]
        // Compare normalized versions (lowercase, no extra spaces)
        return w.toLowerCase() !== prev.toLowerCase()
      })
      // Filter out fragments and broken tokens
      .filter(w => {
        // Reject words that look like they were incorrectly split
        // e.g., "rise" after "enterp" suggests "enterprise" was split wrong
        if (w.length < 4 && !w.includes('-')) {
          // Very short words are likely fragments unless they're common
          const commonShortWords = new Set(['web', 'net', 'com', 'org', 'edu', 'gov', 'www', 'seo', 'api', 'url', 'www'])
          return commonShortWords.has(w)
        }
        
        // Reject words that look like concatenated fragments (e.g., "serviceenterp")
        // If a word is >12 chars and has no hyphens, it might be concatenated
        if (w.length > 12 && !w.includes('-')) {
          // Check if it looks like two words concatenated without a space
          // Pattern: word1word2 where both are 4+ chars
          const concatenatedPattern = /^([a-z]{4,})([a-z]{4,})$/i
          if (concatenatedPattern.test(w)) {
            // This looks like a concatenated word - reject it
            return false
          }
        }
        
        return true
      })

    // Create 2-word phrases (preserve hyphens in compound words)
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i]
      const word2 = words[i + 1]
      
      // Get base words (without hyphens) for validation
      const baseWord1 = word1.replace(/-/g, '')
      const baseWord2 = word2.replace(/-/g, '')
      
      // Skip if base words are the same or too short
      if (baseWord1 === baseWord2 || baseWord1.length < 3 || baseWord2.length < 3) continue
      
      // Preserve hyphens in the phrase
      const phrase = `${word1} ${word2}`
      const phraseBaseLength = phrase.replace(/-/g, '').replace(/\s+/g, '').length
      
      // Ensure phrase is meaningful (at least 8 chars total, max 40)
      if (phraseBaseLength >= 8 && phrase.length <= 40) {
        extractedKeywords.push(phrase)
      }
    }
    
    // Create 3-word phrases (preserve hyphens in compound words)
    for (let i = 0; i < words.length - 2; i++) {
      const word1 = words[i]
      const word2 = words[i + 1]
      const word3 = words[i + 2]
      
      // Get base words (without hyphens) for validation
      const baseWord1 = word1.replace(/-/g, '')
      const baseWord2 = word2.replace(/-/g, '')
      const baseWord3 = word3.replace(/-/g, '')
      
      // Skip if any base words are the same or too short
      if (baseWord1 === baseWord2 || baseWord2 === baseWord3 || baseWord1 === baseWord3) continue
      if (baseWord1.length < 3 || baseWord2.length < 3 || baseWord3.length < 3) continue
      
      // Preserve hyphens in the phrase
      const phrase = `${word1} ${word2} ${word3}`
      const phraseBaseLength = phrase.replace(/-/g, '').replace(/\s+/g, '').length
      
      // Ensure phrase is meaningful (at least 12 chars total, max 50)
      if (phraseBaseLength >= 12 && phrase.length <= 50) {
        extractedKeywords.push(phrase)
      }
    }
  })
  
  // Use the keyword processor to clean and deduplicate keywords
  // This handles concatenated words, nonsense patterns, and proper filtering
  const cleanedKeywords = deduplicateKeywords(extractedKeywords)
  
  // CRITICAL FIX: Use keywordProcessor to filter out invalid keywords (stopwords, broken tokens)
  // Only keep keywords that pass validation
  const validKeywords = cleanedKeywords.filter(kw => {
    // Use keywordProcessor's validation if available, otherwise use basic checks
    try {
      const { isValidKeyword } = require('./keywordProcessor')
      return isValidKeyword(kw)
    } catch {
      // Fallback: basic validation
      const words = kw.split(/\s+/)
      return words.length >= 2 && words.every(w => w.length >= 3)
    }
  })
  
  // Limit to top 20 keywords per page
  const uniqueKeywords = validKeywords.slice(0, 20)
  
  // CRITICAL FIX #1: Count words from rendered content, excluding nav/header/footer
  // Extract main content areas first (prefer <main>, <article>, <section>)
  let mainContent = ''
  const mainMatch = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  const articleMatch = cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const sectionMatches = cleanHtml.match(/<section[^>]*>([\s\S]*?)<\/section>/gi) || []
  
  if (mainMatch) {
    mainContent = mainMatch[1]
  } else if (articleMatch) {
    mainContent = articleMatch[1]
  } else if (sectionMatches.length > 0) {
    // Use all sections combined
    mainContent = sectionMatches.join(' ')
  } else {
    // Fallback: exclude common nav/header/footer patterns
    mainContent = cleanHtml
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
  }
  
  // Remove all HTML tags and count words
  const textContent = mainContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length
  
  return {
    url,
    statusCode,
    loadTime,
    contentType,
    title,
    titleLength, // NEW: Using extracted length from titleMetaExtractor
    metaDescription,
    metaDescriptionLength: metaLength, // NEW: Using extracted length
    canonical: canonical || undefined,
    h1Count: h1Text.length,
    h1Text: h1Text.length > 0 ? h1Text : undefined,
    h2Count: h2Count,
    wordCount,
    imageCount: imageMatches.length,
    missingAltCount,
    internalLinkCount,
    externalLinkCount,
    hasNoindex,
    hasNofollow,
    hasViewport,
    hasSchemaMarkup,
    schemaTypes: schemaTypes.length > 0 ? Array.from(new Set(schemaTypes)) : undefined,
    schemaAnalysis: schemaAnalysis.hasSchema ? {
      hasIdentitySchema: schemaAnalysis.hasIdentitySchema,
      identityType: schemaAnalysis.identityType,
      missingFields: schemaAnalysis.missingFields
    } : undefined,
    extractedKeywords: uniqueKeywords.length > 0 ? uniqueKeywords : undefined
  }
}

/**
 * Consolidate issues by message and details, grouping affected pages
 */
// consolidateIssue is now imported from ./issueProcessor

/**
 * Analyze site-wide issues
 */
function analyzeSiteWideIssues(
  pages: PageData[],
  siteWide: SiteWideData,
  issues: Issue[],
  rootUrl: string // CRITICAL FIX #3: Add rootUrl parameter for homepage detection
): void {
  // CRITICAL FIX #3: Check for broken pages - Only count HTML documents, not subresources (images/scripts)
  pages.forEach(page => {
    // Only count as broken if it's an HTML document with an error status
    // Also skip PDFs and other non-HTML files
    const isNonHtmlFile = page.url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
    if (isNonHtmlFile) {
      // Skip non-HTML files entirely - don't add them to brokenPages
      // Log if we see a PDF trying to be added (for debugging)
      if (page.url.includes('.pdf')) {
        console.warn(`[Audit] Skipping PDF from brokenPages: ${page.url}`)
      }
      return
    }
    const isHtmlDocument = page.contentType?.includes('text/html') || 
                           page.contentType?.includes('application/xhtml')
    if (isHtmlDocument && (page.statusCode >= 400 || page.error)) {
      siteWide.brokenPages.push(page.url)
    }
  })
  
  // Find duplicate titles
  // Use more precise normalization - only normalize whitespace and case
  // Don't remove separators or suffixes as they may be meaningful
  const titleMap = new Map<string, string[]>()
  pages.forEach(page => {
    if (page.title) {
      // Normalize: lowercase, trim, collapse multiple spaces to single space
      // But preserve all characters including separators (|, -, etc.)
      const normalized = page.title.toLowerCase().trim().replace(/\s+/g, ' ')
      if (!titleMap.has(normalized)) {
        titleMap.set(normalized, [])
      }
      titleMap.get(normalized)!.push(page.url)
    }
  })
  
  titleMap.forEach((urls, title) => {
    if (urls.length > 1) {
      siteWide.duplicateTitles.push(...urls)
      issues.push({
        category: 'On-page',
        severity: 'Medium',
        message: `Duplicate page title: "${title}"`,
        details: `Found on ${urls.length} pages`,
        affectedPages: urls
      })
    }
  })
  
  // Find duplicate meta descriptions
  const metaMap = new Map<string, string[]>()
  pages.forEach(page => {
    if (page.metaDescription) {
      const normalized = page.metaDescription.toLowerCase().trim()
      if (!metaMap.has(normalized)) {
        metaMap.set(normalized, [])
      }
      metaMap.get(normalized)!.push(page.url)
    }
  })
  
  metaMap.forEach((urls, meta) => {
    if (urls.length > 1) {
      siteWide.duplicateMetaDescriptions.push(...urls)
      issues.push({
        category: 'On-page',
        severity: 'Medium',
        message: `Duplicate meta description`,
        details: `Found on ${urls.length} pages`,
        affectedPages: urls
      })
    }
  })
  
  // Generate page-level issues and consolidate them
  const issueMap = new Map<string, Issue>()
  
  pages.forEach(page => {
    // Skip non-HTML pages for HTML-specific checks
    // Check both content type and file extension to avoid false positives
    const isHtmlPage = (page.contentType?.includes('text/html') || 
                       page.contentType?.includes('application/xhtml')) &&
                      !page.url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe)$/i)
    
    // Missing title - only check HTML pages
    if (isHtmlPage && !page.title) {
      consolidateIssue(issueMap, {
        category: 'On-page',
        severity: 'High',
        message: 'Missing page title',
        affectedPages: [page.url]
      })
    } else {
      // CRITICAL FIX #3: Contextual title length checking
      const isHomepage = page.url === rootUrl || page.url === rootUrl + '/' || page.url.endsWith('/')
      const isBrandName = page.title && page.title.length < 20 && /^[A-Z\s]+$/.test(page.title.trim())
      const isNewsArticle = page.url.toLowerCase().includes('/news/') || page.url.toLowerCase().includes('/article/')
      
      if (page.titleLength! < 30 && !isHomepage && !isBrandName) {
        consolidateIssue(issueMap, {
          category: 'On-page',
          severity: 'Medium',
          message: 'Page title too short',
          details: `Title is ${page.titleLength} characters (recommended: 35-60 for optimal display)`,
          affectedPages: [page.url]
        })
      } else if (page.titleLength! > 70) {
        consolidateIssue(issueMap, {
          category: 'On-page',
          severity: 'Low',
          message: 'Page title too long',
          details: `Title is ${page.titleLength} characters (recommended: 35-60 for best results)`,
          affectedPages: [page.url]
        })
      }
    }
    
    // Missing meta description - only check HTML pages
    if (isHtmlPage && !page.metaDescription) {
      consolidateIssue(issueMap, {
        category: 'On-page',
        severity: 'High',
        message: 'Missing meta description',
        affectedPages: [page.url]
      })
    } else if (page.metaDescriptionLength! < 120) {
      consolidateIssue(issueMap, {
        category: 'On-page',
        severity: 'Medium',
        message: 'Meta description too short',
        details: `Description is ${page.metaDescriptionLength} characters (recommended: 120-160)`,
        affectedPages: [page.url]
      })
    } else if (page.metaDescriptionLength! > 160) {
      consolidateIssue(issueMap, {
        category: 'On-page',
        severity: 'Low',
        message: 'Meta description too long',
        details: `Description is ${page.metaDescriptionLength} characters (recommended: 120-160)`,
        affectedPages: [page.url]
      })
    }
    
    // H1 issues - only check HTML pages (not PDFs, images, etc.)
    // Re-check isHtmlPage here to ensure we're not checking PDFs
    const isHtmlPageForH1 = (page.contentType?.includes('text/html') || 
                             page.contentType?.includes('application/xhtml')) &&
                            !page.url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe)$/i)
    
    if (isHtmlPageForH1) {
      if (page.h1Count === 0) {
        consolidateIssue(issueMap, {
          category: 'On-page',
          severity: 'High',
          message: 'Missing H1 tag',
          affectedPages: [page.url]
        })
      } else if (page.h1Count > 1) {
        consolidateIssue(issueMap, {
          category: 'On-page',
          severity: 'Medium',
          message: 'Multiple H1 tags',
          details: `Found ${page.h1Count} H1 tags (recommended: 1)`,
          affectedPages: [page.url]
        })
      }
    }
    
    // Thin content - only check HTML pages
    if (isHtmlPage && page.wordCount < 300) {
      consolidateIssue(issueMap, {
        category: 'Content',
        severity: 'Medium',
        message: 'Thin content',
        details: `Page has only ${page.wordCount} words (recommended: 300+)`,
        affectedPages: [page.url]
      })
    }
    
    // Missing alt tags (only flag if enhanced on-page analysis didn't already flag it)
    // Enhanced on-page analysis handles this more comprehensively, so we skip it here
    // to avoid duplication
    
    // No viewport meta tag - only check HTML pages (not PDFs, images, etc.)
    // Use the same check as H1 to ensure consistency
    if (isHtmlPageForH1 && !page.hasViewport) {
      consolidateIssue(issueMap, {
        category: 'Technical',
        severity: 'High',
        message: 'Missing viewport meta tag',
        details: 'Required for mobile responsiveness',
        affectedPages: [page.url]
      })
    }
    
    // HTTP version check
    if (page.httpVersion === 'http/1.1') {
      consolidateIssue(issueMap, {
        category: 'Technical',
        severity: 'Low',
        message: 'Using HTTP/1.1',
        details: 'Consider upgrading to HTTP/2 or HTTP/3 for better performance. HTTP/2 provides multiplexing and header compression.',
        affectedPages: [page.url]
      })
    }
    
    // Compression check
    if (page.compression) {
      if (!page.compression.gzip && !page.compression.brotli) {
        consolidateIssue(issueMap, {
          category: 'Technical',
          severity: 'Medium',
          message: 'No compression enabled',
          details: 'Enable GZIP or Brotli compression to reduce page size and improve load times. Most servers support GZIP compression.',
          affectedPages: [page.url]
        })
      } else if (page.compression.gzip && !page.compression.brotli) {
        consolidateIssue(issueMap, {
          category: 'Technical',
          severity: 'Low',
          message: 'Consider enabling Brotli compression',
          details: 'GZIP is enabled, but Brotli provides better compression ratios (typically 15-20% better than GZIP).',
          affectedPages: [page.url]
        })
      }
    }
    
    // Slow page (only if no performance metrics available)
    if (page.loadTime > 3000 && !page.performanceMetrics && !page.pageSpeedData) {
      consolidateIssue(issueMap, {
        category: 'Performance',
        severity: 'Medium',
        message: 'Slow page load time',
        details: `Page loads in ${page.loadTime}ms (recommended: <3s)`,
        affectedPages: [page.url]
      })
    }
    
    // Noindex
    if (page.hasNoindex) {
      consolidateIssue(issueMap, {
        category: 'Technical',
        severity: 'High',
        message: 'Page has noindex directive',
        details: 'This page will not be indexed by search engines. Remove the noindex meta tag if you want this page to appear in search results.',
        affectedPages: [page.url]
      })
    }
    
    // Nofollow
    if (page.hasNofollow) {
      consolidateIssue(issueMap, {
        category: 'Technical',
        severity: 'Medium',
        message: 'Page has nofollow directive',
        details: 'Search engines will not follow links on this page. This prevents link equity from being passed to linked pages.',
        affectedPages: [page.url]
      })
    }
    
    // Canonical validation - only check HTML pages
    if (isHtmlPage && !page.canonical) {
      consolidateIssue(issueMap, {
        category: 'On-page',
        severity: 'Medium',
        message: 'Missing canonical tag',
        details: 'Canonical tags prevent duplicate content issues. Add <link rel="canonical" href="[preferred-url]"> to the <head> section.',
        affectedPages: [page.url]
      })
    } else {
      // Validate canonical URL
      try {
        const pageUrl = new URL(page.url)
        const canonicalUrl = new URL(page.canonical, page.url)
        
        // CRITICAL FIX #10: Check if canonical is different from current URL (potential issue)
        if (canonicalUrl.href !== pageUrl.href) {
          // Check if it's just protocol difference (http vs https)
          if (canonicalUrl.hostname === pageUrl.hostname && canonicalUrl.pathname === pageUrl.pathname) {
            // Just protocol or www difference - this is okay
          } else {
            // Check if canonical points to a closely related category page (e.g., /events/ vs /events/category/)
            const pagePath = pageUrl.pathname.split('/').filter(Boolean)
            const canonicalPath = canonicalUrl.pathname.split('/').filter(Boolean)
            
            // If canonical is a parent or sibling category, mark as INFO/LOW, not error
            const isRelatedCategory = canonicalPath.length > 0 && 
                                     pagePath.length > 0 &&
                                     (canonicalPath.every((seg, i) => pagePath[i] === seg) || // Canonical is parent
                                      pagePath.every((seg, i) => canonicalPath[i] === seg)) // Page is parent
            
            if (isRelatedCategory) {
              // Related category - mark as INFO (very low priority)
              consolidateIssue(issueMap, {
                category: 'On-page',
                severity: 'Low',
                message: 'Canonical points to related category page',
                details: `Canonical URL (${page.canonical}) points to a related category page. This may be intentional for category listings.`,
                affectedPages: [page.url],
                priority: 1 // Very low priority
              })
            } else {
              // Different URL - flag as potential issue
              consolidateIssue(issueMap, {
                category: 'On-page',
                severity: 'Low',
                message: 'Canonical points to different URL',
                details: `Canonical URL (${page.canonical}) differs from page URL. This is intentional if this is a duplicate page, otherwise it may indicate a configuration issue.`,
                affectedPages: [page.url]
              })
            }
          }
        }
      } catch (error) {
        // Invalid canonical URL
        consolidateIssue(issueMap, {
          category: 'On-page',
          severity: 'Medium',
          message: 'Invalid canonical URL',
          details: `Canonical URL "${page.canonical}" is not a valid URL. Ensure it's an absolute URL (e.g., https://example.com/page).`,
          affectedPages: [page.url]
        })
      }
    }
  })
  
  // Add consolidated issues
  issueMap.forEach(issue => {
    issues.push(issue)
  })
  
  // Add consolidated broken pages issue - filter out PDFs and non-HTML files
  // Also ensure brokenPages array itself is clean (defensive programming)
  siteWide.brokenPages = siteWide.brokenPages.filter(url => {
    const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
    return !isNonHtmlFile
  })
  
  if (siteWide.brokenPages.length > 0) {
    issues.push({
      category: 'Technical',
      severity: 'High',
      message: 'Broken pages detected',
      details: `${siteWide.brokenPages.length} page${siteWide.brokenPages.length !== 1 ? 's' : ''} returned errors`,
      affectedPages: [...siteWide.brokenPages] // Use copy to avoid reference issues
    })
  }
  
  // Site-wide technical issues
  if (!siteWide.robotsTxtExists) {
    issues.push({
      category: 'Technical',
      severity: 'Low',
      message: 'Missing robots.txt',
      details: 'robots.txt file not found. While not critical, it helps search engines understand crawling rules.'
    })
  } else if (siteWide.robotsTxtExists && !siteWide.robotsTxtReachable) {
    issues.push({
      category: 'Technical',
      severity: 'Medium',
      message: 'robots.txt unreachable',
      details: 'robots.txt file exists but cannot be accessed (may return errors).'
    })
  }
  
  if (!siteWide.sitemapExists) {
    issues.push({
      category: 'Technical',
      severity: 'Medium',
      message: 'Missing sitemap.xml',
      details: 'sitemap.xml file not found'
    })
  }
  
  // Social media issues
  if (siteWide.socialMedia) {
    const social = siteWide.socialMedia.metaTags
    
    // Open Graph issues
    if (!social.openGraph.hasTags || social.openGraph.missingRequired.length > 0) {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'Missing Open Graph tags',
        details: `Missing required tags: ${social.openGraph.missingRequired.join(', ')}. Open Graph tags improve social media sharing appearance.`
      })
    }
    
    // Twitter Card issues
    if (!social.twitter.hasCards || social.twitter.missingRequired.length > 0) {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'Missing Twitter Card tags',
        details: `Missing required tags: ${social.twitter.missingRequired.join(', ')}. Twitter Cards improve appearance when sharing on X/Twitter.`
      })
    }
    
    // Favicon check
    if (!siteWide.socialMedia.hasFavicon) {
      issues.push({
        category: 'Technical',
        severity: 'Low',
        message: 'Missing favicon',
        details: 'No favicon detected. Add a favicon.ico file or <link rel="icon"> tag for better branding in browser tabs.'
      })
    }
  }
}

/**
 * Calculate enhanced SEO scores with more nuanced algorithm
 * 
 * Updated scoring weights (Agency tier requirements):
 * - Technical: 35%
 * - On-page: 25%
 * - Content: 25%
 * - Accessibility: 15%
 * 
 * Uses weighted scoring with diminishing returns to avoid 0/100 extremes
 */
function calculateEnhancedScores(
  pages: PageData[],
  issues: Issue[],
  siteWide: SiteWideData
): {
  overall: number
  technical: number
  onPage: number
  content: number
  accessibility: number
} {
  if (pages.length === 0) {
    // Return neutral scores instead of 0 to avoid extremes
    return {
      overall: 50,
      technical: 50,
      onPage: 50,
      content: 50,
      accessibility: 50
    }
  }
  
  // Use the new scoring module functions
  const categoryScores = calculateAllScores(issues, pages, {
    robotsTxtExists: siteWide.robotsTxtExists,
    sitemapExists: siteWide.sitemapExists
  })
  
  const overall = calculateOverallScore(categoryScores)
  
  return {
    overall,
    technical: categoryScores.technical,
    onPage: categoryScores.onPage,
    content: categoryScores.content,
    accessibility: categoryScores.accessibility
  }
}

/**
 * Legacy calculateScores function (kept for backward compatibility)
 * 
 * Scoring weights (adjustable):
 * - Technical: 30%
 * - On-page: 30%
 * - Content: 20%
 * - Accessibility: 20%
 */
function calculateScores(
  pages: PageData[],
  issues: Issue[],
  siteWide: SiteWideData
): {
  overall: number
  technical: number
  onPage: number
  content: number
  accessibility: number
} {
  if (pages.length === 0) {
    return {
      overall: 0,
      technical: 0,
      onPage: 0,
      content: 0,
      accessibility: 0
    }
  }
  
  // NEW: Use improved scoring system with readability integration
  const categoryScores = calculateAllScores(issues, pages, siteWide)
  const overall = calculateOverallScore(categoryScores)
  
  return {
    overall,
    technical: categoryScores.technical,
    onPage: categoryScores.onPage,
    content: categoryScores.content,
    accessibility: categoryScores.accessibility
  }
}

/**
 * Categorize issues by type
 */
function categorizeIssues(issues: Issue[]): {
  technicalIssues: Issue[]
  onPageIssues: Issue[]
  contentIssues: Issue[]
  accessibilityIssues: Issue[]
  performanceIssues: Issue[]
} {
  // Use type-safe category matching
  const result = {
    technicalIssues: [] as Issue[],
    onPageIssues: [] as Issue[],
    contentIssues: [] as Issue[],
    accessibilityIssues: [] as Issue[],
    performanceIssues: [] as Issue[]
  }
  
  for (const issue of issues) {
    const cat = issue.category
    if (cat === 'Technical') {
      result.technicalIssues.push(issue)
    } else if (cat === 'On-page') {
      result.onPageIssues.push(issue)
    } else if (cat === 'Content') {
      result.contentIssues.push(issue)
    } else if (cat === 'Accessibility') {
      result.accessibilityIssues.push(issue)
    } else if (cat === 'Performance') {
      result.performanceIssues.push(issue)
    } else {
      // Log unexpected category
      console.warn(`[Audit] Unknown issue category: "${cat}" for issue: ${issue.message}`)
    }
  }
  
  return result
}

/**
 * Analyze image alt tags in detail (for Image Alt Tags add-on)
 */
async function analyzeImageAltTags(pages: PageData[]): Promise<ImageAltAnalysis[]> {
  const analysis: ImageAltAnalysis[] = []
  
  // Re-fetch pages with images to get detailed alt tag information
  for (const page of pages) {
    if (page.imageCount > 0) {
      try {
        const response = await fetch(page.url, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'SEO-Audit-Bot/1.0' }
        })
        const html = await response.text()
        const imageMatches = html.match(/<img[^>]*>/gi) || []
        
        imageMatches.forEach(imgTag => {
          const srcMatch = imgTag.match(/src=["']([^"']+)["']/i)
          const altMatch = imgTag.match(/alt=["']([^"']*)["']/i)
          const imageUrl = srcMatch ? srcMatch[1] : undefined
          const currentAlt = altMatch ? altMatch[1] : undefined
          
          let issue: ImageAltAnalysis['issue'] = 'good'
          let recommendation: string | undefined
          
          if (!currentAlt || currentAlt.trim() === '') {
            issue = 'missing'
            recommendation = `Add a descriptive alt attribute. Example: <img src="${imageUrl}" alt="Description of what the image shows">`
          } else if (currentAlt.length < 5) {
            issue = 'too-short'
            recommendation = `Expand alt text to at least 5-10 words. Current: "${currentAlt}". Add more descriptive details.`
          } else if (currentAlt.length > 125) {
            issue = 'too-long'
            recommendation = `Shorten alt text to under 125 characters. Current: ${currentAlt.length} chars. Keep it concise but descriptive.`
          } else if (['image', 'photo', 'picture', 'img'].some(g => currentAlt.toLowerCase().includes(g))) {
            issue = 'generic'
            recommendation = `Replace generic alt text "${currentAlt}" with a specific description of what the image shows.`
          }
          
          if (issue !== 'good') {
            analysis.push({
              url: page.url,
              imageUrl: imageUrl ? new URL(imageUrl, page.url).toString() : undefined,
              currentAlt,
              recommendation,
              issue
            })
          }
        })
      } catch {
        // Skip if page can't be re-fetched
      }
    }
  }
  
  return analysis.slice(0, 100) // Limit to top 100 for performance
}

/**
 * Generate real competitor analysis by crawling competitor site
 */
// NEW: Using improved competitor analysis from realCompetitorAnalysis.ts
/**
 * Generate real competitor analysis by crawling competitor URLs
 * Sprint 1.6: Added logging and better error handling
 */
async function generateRealCompetitorAnalysis(
  competitorUrl: string,
  siteKeywords: string[],
  options: Required<AuditOptions>
): Promise<CompetitorAnalysis> {
  console.log(`[Competitor] Starting real competitor analysis for: ${competitorUrl}`)
  console.log(`[Competitor] Site has ${siteKeywords.length} keywords to compare`)
  
  try {
    const result = await analyzeCompetitors([competitorUrl], siteKeywords, options.userAgent)
    console.log(`[Competitor] Real analysis succeeded`)
    
    // Convert to CompetitorAnalysis format
    const allKeywords = result.competitorData.flatMap(c => c.keywords)
    const siteKeywordSet = new Set(siteKeywords.map(k => k.toLowerCase()))
    const shared = allKeywords.filter(k => siteKeywordSet.has(k.toLowerCase()))
    const gaps = result.keywordGaps.map(g => g.keyword)
    
    return {
      competitorUrl,
      competitorKeywords: allKeywords,
      keywordGaps: gaps,
      sharedKeywords: shared
    }
  } catch (error) {
    console.warn(`[Competitor] Real analysis failed:`, error)
    console.log(`[Competitor] Falling back to pattern-based suggestions`)
    return {
      competitorUrl: `Unable to analyze ${competitorUrl} - using pattern-based suggestions`,
      sharedKeywords: [],
      keywordGaps: generateFallbackKeywordSuggestions(siteKeywords),
      competitorKeywords: []
    }
  }
}

/**
 * Generate multi-competitor analysis for Agency tier
 * Crawls up to 3 competitors and provides comprehensive comparison
 */
async function generateMultiCompetitorAnalysis(
  competitorUrls: string[],
  siteKeywords: string[],
  options: Required<AuditOptions>,
  sitePages: PageData[]
): Promise<CompetitorAnalysis> {
  console.log(`[Competitor] Agency tier: Starting enhanced multi-competitor crawl for ${competitorUrls.length} competitors`)
  
  try {
    // Use enhanced competitor crawler for Agency tier (full multi-page crawls)
    const { crawlCompetitorSite, compareCompetitorCrawls } = await import('./enhancedCompetitorCrawl')
    
    // Crawl each competitor (up to 20 pages each, depth 3)
    const crawlPromises = competitorUrls.map(url => 
      crawlCompetitorSite(url, 20, 3, options.userAgent)
    )
    
    const competitorCrawls = (await Promise.all(crawlPromises))
      .filter((crawl): crawl is NonNullable<typeof crawl> => crawl !== null)
    
    if (competitorCrawls.length === 0) {
      console.warn('[Competitor] All competitor crawls failed, falling back to single-page analysis')
      const result = await analyzeCompetitors(competitorUrls, siteKeywords, options.userAgent)
      return {
        competitorUrl: competitorUrls[0],
        competitorKeywords: result.competitorData.flatMap(c => c.keywords),
        keywordGaps: result.keywordGaps.map(g => g.keyword),
        sharedKeywords: [],
        competitorCrawls: result.competitorData.map(comp => ({
          url: comp.url,
          keywords: comp.keywords,
          title: comp.title,
          metaDescription: comp.metaDescription,
          pageCount: 1
        })),
        crawlSummary: {
          totalCompetitorsAnalyzed: result.competitorData.length,
          totalPagesCrawled: result.competitorData.length,
          averagePageCount: 1,
          siteStructureComparison: []
        }
      }
    }
    
    // Compare crawls and find gaps
    const comparison = compareCompetitorCrawls(siteKeywords, competitorCrawls)
    
    // Build CompetitorData format for backward compatibility
    const competitorDataArray = competitorCrawls.map(crawl => ({
      url: crawl.url,
      keywords: crawl.keywords,
      title: crawl.pages[0]?.title,
      metaDescription: crawl.pages[0]?.metaDescription,
      pageCount: crawl.totalPages,
      authoritySignals: {
        hubPages: crawl.siteStructure.hubPages,
        avgInternalLinks: crawl.siteStructure.avgInternalLinks,
        maxDepth: crawl.siteStructure.maxDepth
      }
    }))
    
    // Calculate site metrics for comparison
    const siteAvgWordCount = sitePages.length > 0
      ? sitePages.reduce((sum, p) => sum + p.wordCount, 0) / sitePages.length
      : 0
    
    const totalPagesCrawled = competitorCrawls.reduce((sum, c) => sum + c.totalPages, 0)
    const averagePageCount = competitorCrawls.length > 0 ? totalPagesCrawled / competitorCrawls.length : 0
    
    const crawlSummary = {
      totalCompetitorsAnalyzed: competitorCrawls.length,
      totalPagesCrawled,
      averagePageCount,
      siteStructureComparison: comparison.siteStructureComparison
    }
    
    // Combine all competitor keywords
    const allKeywords = competitorCrawls.flatMap(c => c.keywords)
    
    console.log(`[Competitor] Agency tier: Enhanced crawl complete - ${competitorCrawls.length} competitors, ${totalPagesCrawled} total pages, ${comparison.keywordGaps.length} gaps, ${comparison.sharedKeywords.length} shared`)
    
    return {
      competitorUrl: competitorUrls[0], // Primary competitor for backward compatibility
      competitorKeywords: allKeywords,
      keywordGaps: comparison.keywordGaps.map(g => g.keyword),
      sharedKeywords: comparison.sharedKeywords,
      competitorCrawls: competitorDataArray,
      crawlSummary
    }
  } catch (error) {
    console.warn(`[Competitor] Enhanced multi-competitor crawl failed:`, error)
    // Fallback to single-page analysis
    try {
      const result = await analyzeCompetitors(competitorUrls, siteKeywords, options.userAgent)
      return {
        competitorUrl: competitorUrls[0],
        competitorKeywords: result.competitorData.flatMap(c => c.keywords),
        keywordGaps: result.keywordGaps.map(g => g.keyword),
        sharedKeywords: [],
        competitorCrawls: result.competitorData.map(comp => ({
          url: comp.url,
          keywords: comp.keywords,
          title: comp.title,
          metaDescription: comp.metaDescription,
          pageCount: 1
        })),
        crawlSummary: {
          totalCompetitorsAnalyzed: result.competitorData.length,
          totalPagesCrawled: result.competitorData.length,
          averagePageCount: 1,
          siteStructureComparison: []
        }
      }
    } catch (fallbackError) {
      console.error('[Competitor] Fallback analysis also failed:', fallbackError)
      return {
        competitorUrl: 'Analysis failed',
        competitorKeywords: [],
        keywordGaps: generateFallbackKeywordSuggestions(siteKeywords),
        sharedKeywords: []
      }
    }
  }
}

/**
 * Generate competitor keyword gap analysis (fallback - pattern-based)
 * Sprint 1.6: Improved fallback with industry-specific suggestions
 */
async function generateCompetitorAnalysis(
  pages: PageData[],
  siteKeywords: string[]
): Promise<CompetitorAnalysis> {
  console.log(`[Competitor] Using fallback pattern-based analysis`)
  console.log(`[Competitor] Generating suggestions for ${siteKeywords.length} site keywords`)
  
  const suggestions = generateFallbackKeywordSuggestions(siteKeywords)
  
  return {
    competitorUrl: 'Pattern-based keyword suggestions (no competitor URL provided)',
    sharedKeywords: [],
    keywordGaps: suggestions,
    competitorKeywords: []
  }
}

// OLD FALLBACK FUNCTION BODY REMOVED (lines 2044-2326)
// Now using generateFallbackKeywordSuggestions from realCompetitorAnalysis.ts
