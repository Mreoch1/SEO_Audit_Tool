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
import { classifyDomain } from './competitorData'
import { deduplicateKeywords, formatKeywordsForDisplay, findKeywordGaps } from './keywordProcessor'

const DEFAULT_OPTIONS: Required<Omit<AuditOptions, 'tier' | 'addOns' | 'competitorUrls'>> & Pick<AuditOptions, 'addOns' | 'competitorUrls'> = {
  maxPages: 50,
  maxDepth: 3,
  userAgent: 'SEO-Audit-Bot/1.0',
  addOns: undefined,
  competitorUrls: undefined
}

/**
 * Get tier-based limits
 */
export function getTierLimits(tier?: AuditTier): { maxPages: number; maxDepth: number } {
  switch (tier) {
    case 'starter':
      return { maxPages: 3, maxDepth: 2 }
    case 'standard':
      return { maxPages: 20, maxDepth: 3 }
    case 'advanced':
      return { maxPages: 50, maxDepth: 5 }
    default:
      return { maxPages: 50, maxDepth: 3 }
  }
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
    tier: options.tier ?? 'advanced', // Default tier if not specified
    // Preserve add-ons
    addOns: options.addOns ?? {},
    competitorUrls: options.competitorUrls ?? []
  }
  const startTime = Date.now()
  
  console.log(`[Audit] Starting audit for ${url} (max pages: ${finalMaxPages}, max depth: ${opts.maxDepth})`)
  
  // Normalize URL and handle redirects
  const rootUrl = normalizeUrl(url)
  let baseDomain = new URL(rootUrl).hostname
  
  // Check if URL redirects to a subdomain (e.g., wikipedia.com -> en.wikipedia.org)
  // We'll update baseDomain after the first page is fetched if it redirects
  let actualDomain: string | null = null
  
  // Track crawled pages
  const crawledUrls = new Set<string>()
  const pages: PageData[] = []
  const allIssues: Issue[] = []
  
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
  analyzeSiteWideIssues(pages, siteWide, allIssues)
  
  // Perform enhanced technical check on main page
  if (pages.length > 0) {
    console.log('[Audit] Performing enhanced technical analysis...')
    try {
      const mainPage = pages[0]
      const { data: technicalData, issues: technicalIssues } = await performEnhancedTechnicalCheck(
        mainPage.url,
        opts.userAgent
      )
      technicalIssues.forEach(issue => {
        if (!issue.id) {
          issue.id = `technical-${issue.severity}-${issue.message}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
        issue.fixInstructions = getTechnicalFixInstructions(issue)
        issue.priority = issue.severity === 'High' ? 10 : issue.severity === 'Medium' ? 5 : 2
        allIssues.push(issue)
      })
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
      // Fetch HTML for enhanced analysis
      const response = await fetch(page.url, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': opts.userAgent }
      })
      const html = await response.text()
      
      // Extract primary keyword from page title or H1
      const primaryKeyword = page.title?.split(/\s+/)[0] || page.h1Text?.[0]?.split(/\s+/)[0]
      
      // Enhanced on-page analysis
      const { data: onPageData, issues: onPageIssues } = analyzeEnhancedOnPage(page, html, primaryKeyword)
      onPageIssues.forEach(issue => {
        issue.fixInstructions = getOnPageFixInstructions(issue)
        issue.priority = issue.severity === 'High' ? 10 : issue.severity === 'Medium' ? 5 : 2
        // Use consolidateIssue to merge with existing issues and avoid duplicates
        consolidateIssue(enhancedIssueMap, issue)
      })
      
      // Enhanced content analysis
      const { data: contentData, issues: contentIssues } = analyzeEnhancedContent(page, html)
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
  // Only check for Standard/Advanced tiers or if schema add-on is selected
  if (opts.tier === 'standard' || opts.tier === 'advanced' || opts.addOns?.schemaMarkup) {
    const schemaIssueMap = new Map<string, Issue>()
    
    pages.forEach(page => {
      if (page.schemaAnalysis) {
        // Check for missing Identity Schema
        if (!page.schemaAnalysis.hasIdentitySchema) {
          consolidateIssue(schemaIssueMap, {
            category: 'Technical',
            severity: 'Medium',
            message: 'Missing Identity Schema',
            details: 'No Organization or Person Schema identified. The absence of Organization or Person Schema can make it harder for Search Engines and LLMs to identify the ownership of a website.',
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
      } else if (!page.hasSchemaMarkup) {
        // Only flag as missing if hasSchemaMarkup is false
        consolidateIssue(schemaIssueMap, {
          category: 'Technical',
          severity: 'Medium',
          message: 'Missing schema markup',
          details: 'No Schema.org structured data detected. Add JSON-LD or microdata to help search engines understand your content.',
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
  let keywordCount = opts.tier === 'advanced' ? 10 : opts.tier === 'standard' ? 5 : 0
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
  
  // Competitor Analysis (if add-on is selected)
  let competitorAnalysis: CompetitorAnalysis | undefined
  if (opts.addOns?.competitorAnalysis) {
    if (opts.competitorUrls && opts.competitorUrls.length > 0) {
      // User provided competitor URLs - use them
      console.log(`[Audit] Using user-provided competitor URLs for analysis: ${opts.competitorUrls.join(', ')}`)
      competitorAnalysis = await generateRealCompetitorAnalysis(
        opts.competitorUrls[0], // Analyze first competitor
        topKeywords,
        opts
      )
    } else {
      // Auto-detect competitors based on industry classification
      console.log('[Audit] Auto-detecting competitors based on site content...')
      try {
        const detectedIndustry = await classifyDomain(rootUrl, pages[0]?.html || '', opts.userAgent)
        console.log(`[Audit] Detected industry: ${detectedIndustry.industry} (confidence: ${detectedIndustry.confidence})`)
        
        if (detectedIndustry.competitors.length > 0) {
          console.log(`[Audit] Found ${detectedIndustry.competitors.length} competitors: ${detectedIndustry.competitors.join(', ')}`)
          // Use the first detected competitor
          competitorAnalysis = await generateRealCompetitorAnalysis(
            detectedIndustry.competitors[0],
            topKeywords,
            opts
          )
          // Add industry info to the analysis
          if (competitorAnalysis) {
            competitorAnalysis.detectedIndustry = detectedIndustry.industry
            competitorAnalysis.industryConfidence = detectedIndustry.confidence
            competitorAnalysis.allCompetitors = detectedIndustry.competitors
          }
        } else {
          console.log('[Audit] No competitors detected, falling back to pattern-based analysis')
          competitorAnalysis = await generateCompetitorAnalysis(pages, topKeywords)
        }
      } catch (error) {
        console.warn('[Audit] Competitor auto-detection failed, falling back to pattern-based analysis:', error)
        competitorAnalysis = await generateCompetitorAnalysis(pages, topKeywords)
      }
    }
  }
  
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
  
  // Calculate scores (enhanced algorithm)
  const scores = calculateEnhancedScores(pages, allIssues, siteWide)
  
  // Categorize issues
  const categorizedIssues = categorizeIssues(allIssues)
  
  const endTime = Date.now()
  
  return {
    summary: {
      totalPages: pages.length,
      overallScore: scores.overall,
      technicalScore: scores.technical,
      onPageScore: scores.onPage,
      contentScore: scores.content,
      accessibilityScore: scores.accessibility,
      highSeverityIssues: allIssues.filter(i => i.severity === 'High').length,
      mediumSeverityIssues: allIssues.filter(i => i.severity === 'Medium').length,
      lowSeverityIssues: allIssues.filter(i => i.severity === 'Low').length,
      extractedKeywords: topKeywords.length > 0 ? topKeywords : undefined,
    },
    ...categorizedIssues,
    pages,
    siteWide,
    imageAltAnalysis,
    competitorAnalysis,
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
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`
  } catch {
    // If invalid, try adding protocol
    if (!url.startsWith('http')) {
      return `https://${url}`
    }
    return url
  }
}

/**
 * Check robots.txt
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
  } catch {
    siteWide.robotsTxtExists = false
    siteWide.robotsTxtReachable = false
  }
}

/**
 * Check sitemap.xml
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
  } catch {
    siteWide.sitemapExists = false
    siteWide.sitemapReachable = false
  }
}

/**
 * Check if two domains match (handles subdomains)
 */
function isSameDomain(domain1: string, domain2: string): boolean {
  // Remove www. prefix for comparison
  const normalizeDomain = (d: string) => d.replace(/^www\./, '').toLowerCase()
  const d1 = normalizeDomain(domain1)
  const d2 = normalizeDomain(domain2)
  
  // Exact match
  if (d1 === d2) return true
  
  // Extract root domain (e.g., wikipedia.org from en.wikipedia.org)
  const getRootDomain = (domain: string): string => {
    const parts = domain.split('.')
    if (parts.length >= 2) {
      return parts.slice(-2).join('.')
    }
    return domain
  }
  
  const root1 = getRootDomain(d1)
  const root2 = getRootDomain(d2)
  
  // Same root domain (handles subdomains)
  return root1 === root2
}

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
    
    crawledUrls.add(url)
    
    try {
      // Log progress
      const elapsed = Math.round((Date.now() - startTime) / 1000)
      console.log(`[Audit Progress] Analyzing page ${pages.length + 1}/${options.maxPages}: ${url} (${elapsed}s elapsed)`)
      
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
      // Always try to extract links, even if internalLinkCount is 0 (count might be wrong)
      if (depth < options.maxDepth) {
        let internalLinks: string[] = []
        
        try {
          // Re-fetch the HTML to extract links (we need the full HTML for link extraction)
          // Increased timeout and better error handling
          // Note: fetch() automatically follows redirects, so response.url will be the final URL
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
                    if (!href.startsWith('http') && !href.startsWith('//')) {
                      const relativeUrl = new URL(href, url)
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
          
          // Add discovered internal links to queue (limit to prevent queue explosion)
          const linksToAdd = internalLinks.slice(0, 20) // Limit to first 20 links per page
          for (const linkUrl of linksToAdd) {
            const normalizedLinkUrl = normalizeUrl(linkUrl)
            if (!crawledUrls.has(normalizedLinkUrl) && !queue.some(q => q.url === normalizedLinkUrl)) {
              queue.push({ url: normalizedLinkUrl, depth: depth + 1 })
            }
          }
          
          // Log if we found links
          if (internalLinks.length > 0) {
            console.log(`[Audit Progress] Found ${internalLinks.length} internal links on ${url}, added ${Math.min(linksToAdd.length, internalLinks.length)} to queue`)
          }
        } catch (error) {
          // If extraction fails, try fallback strategies
          if (depth === 0) {
            // For homepage, try common paths and also try to discover paths from sitemap or robots.txt
            const commonPaths = ['/about', '/contact', '/services', '/products', '/blog', '/pricing', '/features', '/help', '/support', '/faq']
            for (const path of commonPaths) {
              try {
                const linkUrl = new URL(path, url).toString()
                const normalizedLinkUrl = normalizeUrl(linkUrl)
                const linkUrlObj = new URL(linkUrl)
                if (isSameDomain(linkUrlObj.hostname, actualDomain) && !crawledUrls.has(normalizedLinkUrl) && !queue.some(q => q.url === normalizedLinkUrl)) {
                  queue.push({ url: normalizedLinkUrl, depth: depth + 1 })
                }
              } catch {
                // Invalid URL, skip
              }
            }
          }
        }
      }
    } catch (error) {
      pages.push({
        url,
        statusCode: 0,
        loadTime: 0,
        contentType: '',
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
        error: error instanceof Error ? error.message : 'Unknown error'
      })
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
      compression
    )
    
    // Wait for PageSpeed data and add it
    const pageSpeedData = await pageSpeedPromise
    if (pageSpeedData) {
      pageData.pageSpeedData = pageSpeedData
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
          pageData.pageSpeedData = pageSpeedData
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
  compression?: PageData['compression']
): Promise<PageData> {
  // Parse basic HTML elements (title, meta, headers, etc.)
  const basicData = parseHtml(renderedHtml, url, statusCode, loadTime, contentType)
  
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
    const imageMatches = renderedHtml.match(/<img[^>]*>/gi) || []
    finalImageData = {
      imageCount: imageMatches.length,
      missingAltCount: imageMatches.filter(img => !img.match(/alt=["'][^"']+["']/i)).length
    }
  }
  
  if (linkData) {
    finalLinkData = {
      internalLinkCount: linkData.internalLinkCount,
      externalLinkCount: linkData.externalLinkCount
    }
  } else {
    // Fall back to regex-based detection
    const linkMatches = renderedHtml.match(/<a[^>]*href=["']([^"']+)["']/gi) || []
    const baseUrl = new URL(url)
    let internalCount = 0
    let externalCount = 0
    linkMatches.forEach(link => {
      const hrefMatch = link.match(/href=["']([^"']+)["']/i)
      if (hrefMatch) {
        try {
          const linkUrl = new URL(hrefMatch[1], url)
          if (linkUrl.hostname === baseUrl.hostname) {
            internalCount++
          } else {
            externalCount++
          }
        } catch {
          internalCount++
        }
      }
    })
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
  
  // Extract title
  const titleMatch = cleanHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : undefined
  
  // Extract meta description
  const metaDescMatch = cleanHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : undefined
  
  // Extract canonical
  const canonicalMatch = cleanHtml.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : undefined
  
  // Extract H1 tags
  const h1Matches = cleanHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || []
  const h1Text = h1Matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean)
  
  // Extract images
  const imageMatches = cleanHtml.match(/<img[^>]*>/gi) || []
  const missingAltCount = imageMatches.filter(img => !img.match(/alt=["'][^"']+["']/i)).length
  
  // Extract links
  const linkMatches = cleanHtml.match(/<a[^>]*href=["']([^"']+)["']/gi) || []
  let internalLinkCount = 0
  let externalLinkCount = 0
  
  try {
    const baseUrl = new URL(url)
    linkMatches.forEach(link => {
      const hrefMatch = link.match(/href=["']([^"']+)["']/i)
      if (hrefMatch) {
        try {
          const linkUrl = new URL(hrefMatch[1], url)
          if (linkUrl.hostname === baseUrl.hostname) {
            internalLinkCount++
          } else {
            externalLinkCount++
          }
        } catch {
          // Relative or invalid URL, count as internal
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
  const extractedKeywords: string[] = []
  const keywordSources: string[] = []
  
  if (title) keywordSources.push(title)
  if (h1Text && h1Text.length > 0) keywordSources.push(...h1Text)
  if (metaDescription) keywordSources.push(metaDescription)
  
  // Extract H2 tags (for both counting and text extraction)
  const h2Matches = cleanHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || []
  const h2Count = h2Matches.length
  const h2Text = h2Matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean)
  if (h2Text.length > 0) keywordSources.push(...h2Text.slice(0, 5)) // Limit to first 5 H2s
  
  // Extract meaningful keywords (2-3 word phrases, filtering stop words)
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
  ])
  
  keywordSources.forEach(text => {
    // Normalize text first - preserve word boundaries better
    // Handle special characters and encoding issues that might split words
    const normalizedText = text.toLowerCase()
      .replace(/[^\w\s-]/g, ' ') // Replace non-word chars (except hyphens) with space
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Handle camelCase
      .trim()
    
    const words = normalizedText
      .split(/\s+/)
      .map(w => w.replace(/[^\w-]/g, '')) // Clean each word, keep hyphens
      .filter(w => {
        // Remove very short words and stop words
        const cleanWord = w.replace(/-/g, '') // Check length without hyphens
        return cleanWord.length > 3 && !stopWords.has(cleanWord) // Increased min length to 3
      })
      // Filter out consecutive duplicate words
      .filter((w, i, arr) => {
        const cleanW = w.replace(/-/g, '')
        const cleanPrev = i > 0 ? arr[i - 1].replace(/-/g, '') : ''
        return i === 0 || cleanW !== cleanPrev
      })
      // Filter out words that look like they were split incorrectly (very short after cleaning)
      .filter(w => {
        const cleanW = w.replace(/-/g, '')
        // If a word is 3 chars or less and not a common word, it might be a fragment
        if (cleanW.length <= 3) {
          const commonShortWords = new Set(['web', 'net', 'com', 'org', 'edu', 'gov', 'www'])
          return commonShortWords.has(cleanW)
        }
        return true
      })

    // Create 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i].replace(/-/g, '')
      const word2 = words[i + 1].replace(/-/g, '')
      
      // Skip if words are the same or too short
      if (word1 === word2 || word1.length < 3 || word2.length < 3) continue
      
      const phrase = `${words[i]} ${words[i + 1]}`
      // Ensure phrase is meaningful (at least 8 chars total, max 40)
      if (phrase.replace(/-/g, '').length >= 8 && phrase.length <= 40) {
        extractedKeywords.push(phrase)
      }
    }
    
    // Create 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const word1 = words[i].replace(/-/g, '')
      const word2 = words[i + 1].replace(/-/g, '')
      const word3 = words[i + 2].replace(/-/g, '')
      
      // Skip if any words are the same or too short
      if (word1 === word2 || word2 === word3 || word1 === word3) continue
      if (word1.length < 3 || word2.length < 3 || word3.length < 3) continue
      
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
      // Ensure phrase is meaningful (at least 12 chars total, max 50)
      if (phrase.replace(/-/g, '').length >= 12 && phrase.length <= 50) {
        extractedKeywords.push(phrase)
      }
    }
  })
  
  // Remove duplicates and filter out phrases with repeated words or nonsense
  const uniqueKeywords = Array.from(new Set(extractedKeywords))
    .filter(kw => {
      // Normalize whitespace first
      const normalized = kw.trim().replace(/\s+/g, ' ')
      if (normalized.length < 3) return false
      
      const words = normalized.split(' ').filter(w => w.length > 0)
      
      // Filter out phrases where all words are the same
      if (new Set(words).size === 1) return false
      
      // Filter out phrases with excessive repetition (e.g., "nasa gov gov")
      const wordCounts = new Map<string, number>()
      words.forEach(w => wordCounts.set(w, (wordCounts.get(w) || 0) + 1))
      // If any word appears more than once in a 2-3 word phrase, it's likely nonsense
      for (const count of wordCounts.values()) {
        if (count > 1) return false
      }
      
      // Filter out phrases that are too generic or contain common domain words
      const genericWords = new Set(['www', 'com', 'org', 'net', 'gov', 'edu', 'html', 'http', 'https', 'page', 'site', 'web'])
      if (words.some(w => genericWords.has(w.toLowerCase()))) {
        // Filter out phrases ending with generic domain words
        if (words.length === 2 && genericWords.has(words[1].toLowerCase())) return false
        // Filter out single generic words
        if (words.length === 1 && genericWords.has(words[0].toLowerCase())) return false
      }
      
      // Filter out phrases that look like broken words (e.g., "encyclope dia")
      // Check if any word is suspiciously short (1-2 chars) and not a common word
      const commonShortWords = new Set(['a', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we'])
      const hasSuspiciousShortWord = words.some(w => {
        const cleanW = w.replace(/[^\w]/g, '')
        return cleanW.length > 0 && cleanW.length <= 2 && !commonShortWords.has(cleanW.toLowerCase())
      })
      if (hasSuspiciousShortWord) {
        // Might be a broken word, filter it out
        return false
      }
      
      // Filter out single words - we only want 2-3 word phrases
      if (words.length < 2) return false
      
      // Additional check: ensure each word in the phrase is at least 3 characters
      // This prevents fragments like "dia", "a", etc.
      const allWordsValid = words.every(w => {
        const cleanW = w.replace(/[^\w]/g, '')
        // Must be at least 3 characters, or be a common short word
        if (cleanW.length < 3) {
          const commonShortWords = new Set(['web', 'net', 'com', 'org', 'edu', 'gov', 'www', 'api', 'url', 'www'])
          return commonShortWords.has(cleanW.toLowerCase())
        }
        return true
      })
      if (!allWordsValid) return false
      
      // Final check: ensure the phrase itself is meaningful (not just two very short words)
      const totalLength = words.reduce((sum, w) => sum + w.replace(/[^\w]/g, '').length, 0)
      if (totalLength < 6) return false // At least 6 characters total across all words
      
      return true
    })
    .map(kw => kw.trim().replace(/\s+/g, ' ')) // Normalize whitespace in final output
    .filter(kw => {
      // Final safety check: ensure it's actually a 2+ word phrase with meaningful words
      const phraseWords = kw.split(/\s+/).filter(w => w.length > 0)
      if (phraseWords.length < 2) return false
      
      // Ensure each word is at least 2 characters (after cleaning)
      const allWordsValid = phraseWords.every(w => {
        const cleanW = w.replace(/[^\w]/g, '')
        return cleanW.length >= 2
      })
      return allWordsValid
    })
    .slice(0, 20)
  
  // Count words (text content only)
  const textContent = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length
  
  return {
    url,
    statusCode,
    loadTime,
    contentType,
    title,
    titleLength: title?.length,
    metaDescription,
    metaDescriptionLength: metaDescription?.length,
    canonical,
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
function consolidateIssue(issueMap: Map<string, Issue>, newIssue: Issue): void {
  const key = `${newIssue.category}|${newIssue.severity}|${newIssue.message}|${newIssue.details || ''}`
  
  if (issueMap.has(key)) {
    const existing = issueMap.get(key)!
    // Merge affected pages
    if (newIssue.affectedPages) {
      existing.affectedPages = [...(existing.affectedPages || []), ...newIssue.affectedPages]
    }
  } else {
    // Generate unique ID for the issue
    const issueId = `${newIssue.category}-${newIssue.severity}-${newIssue.message}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    issueMap.set(key, { 
      ...newIssue,
      id: issueId
    })
  }
}

/**
 * Analyze site-wide issues
 */
function analyzeSiteWideIssues(
  pages: PageData[],
  siteWide: SiteWideData,
  issues: Issue[]
): void {
  // Check for broken pages
  pages.forEach(page => {
    if (page.statusCode >= 400 || page.error) {
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
    // Missing title
    if (!page.title) {
      consolidateIssue(issueMap, {
        category: 'On-page',
        severity: 'High',
        message: 'Missing page title',
        affectedPages: [page.url]
      })
    } else if (page.titleLength! < 30) {
      consolidateIssue(issueMap, {
        category: 'On-page',
        severity: 'Medium',
        message: 'Page title too short',
        details: `Title is ${page.titleLength} characters (recommended: 50-60)`,
        affectedPages: [page.url]
      })
    } else if (page.titleLength! > 60) {
      consolidateIssue(issueMap, {
        category: 'On-page',
        severity: 'Low',
        message: 'Page title too long',
        details: `Title is ${page.titleLength} characters (recommended: 50-60)`,
        affectedPages: [page.url]
      })
    }
    
    // Missing meta description
    if (!page.metaDescription) {
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
    
    // H1 issues
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
    
    // Thin content
    if (page.wordCount < 300) {
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
    
    // No viewport meta tag
    if (!page.hasViewport) {
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
        details: 'This page will not be indexed by search engines',
        affectedPages: [page.url]
      })
    }
  })
  
  // Add consolidated issues
  issueMap.forEach(issue => {
    issues.push(issue)
  })
  
  // Add consolidated broken pages issue
  if (siteWide.brokenPages.length > 0) {
    issues.push({
      category: 'Technical',
      severity: 'High',
      message: 'Broken pages detected',
      details: `${siteWide.brokenPages.length} page${siteWide.brokenPages.length !== 1 ? 's' : ''} returned errors`,
      affectedPages: siteWide.brokenPages
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
 * Scoring weights (adjustable):
 * - Technical: 30%
 * - On-page: 30%
 * - Content: 20%
 * - Accessibility: 20%
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
    return {
      overall: 0,
      technical: 0,
      onPage: 0,
      content: 0,
      accessibility: 0
    }
  }
  
  // Enhanced Technical score (0-100)
  let technicalScore = 100
  technicalScore -= !siteWide.robotsTxtExists ? 8 : 0
  technicalScore -= !siteWide.sitemapExists ? 12 : 0
  technicalScore -= Math.min((siteWide.brokenPages.length / pages.length) * 40, 40)
  
  const technicalIssues = issues.filter(i => i.category === 'Technical')
  const highTechIssues = technicalIssues.filter(i => i.severity === 'High')
  const mediumTechIssues = technicalIssues.filter(i => i.severity === 'Medium')
  const lowTechIssues = technicalIssues.filter(i => i.severity === 'Low')
  
  // More nuanced penalty system
  technicalScore -= Math.min(highTechIssues.length * 12, 50)
  technicalScore -= Math.min(mediumTechIssues.length * 6, 30)
  technicalScore -= Math.min(lowTechIssues.length * 2, 10)
  
  // Bonus for HTTPS
  const hasHttps = pages.some(p => p.url.startsWith('https://'))
  if (hasHttps) technicalScore = Math.min(100, technicalScore + 5)
  
  technicalScore = Math.max(0, Math.min(100, Math.round(technicalScore)))
  
  // Enhanced On-page score (0-100)
  let onPageScore = 100
  const onPageIssues = issues.filter(i => i.category === 'On-page')
  
  if (onPageIssues.length === 0) {
    onPageScore = 100
  } else {
    const highOnPagePages = new Set<string>()
    const mediumOnPagePages = new Set<string>()
    const lowOnPagePages = new Set<string>()
    
    onPageIssues.forEach(issue => {
      if (issue.affectedPages && issue.affectedPages.length > 0) {
        issue.affectedPages.forEach(url => {
          if (issue.severity === 'High') {
            highOnPagePages.add(url)
          } else if (issue.severity === 'Medium') {
            mediumOnPagePages.add(url)
          } else if (issue.severity === 'Low') {
            lowOnPagePages.add(url)
          }
        })
      }
    })
    
    const highIssueRate = highOnPagePages.size / pages.length
    const mediumIssueRate = mediumOnPagePages.size / pages.length
    const lowIssueRate = lowOnPagePages.size / pages.length
    
    onPageScore -= Math.min(highIssueRate * 65, 65)
    onPageScore -= Math.min(mediumIssueRate * 30, 30)
    onPageScore -= Math.min(lowIssueRate * 10, 10)
    
    // Check for pages with good on-page elements
    const pagesWithGoodOnPage = pages.filter(p => 
      p.title && p.titleLength! >= 30 && p.titleLength! <= 60 &&
      p.metaDescription && p.metaDescriptionLength! >= 120 && p.metaDescriptionLength! <= 160 &&
      p.h1Count === 1
    ).length
    const goodOnPageRate = pagesWithGoodOnPage / pages.length
    onPageScore += goodOnPageRate * 10 // Bonus for good on-page elements
    
    const uniqueIssueTypes = new Set(onPageIssues.map(i => i.message))
    if (uniqueIssueTypes.size > pages.length * 0.5) {
      onPageScore -= 5
    }
  }
  
  onPageScore = Math.max(0, Math.min(100, Math.round(onPageScore)))
  
  // Enhanced Content score (0-100)
  let contentScore = 100
  const thinPages = pages.filter(p => p.wordCount < 300).length
  const goodContentPages = pages.filter(p => p.wordCount >= 1000).length
  
  contentScore -= Math.min((thinPages / pages.length) * 45, 45)
  contentScore += Math.min((goodContentPages / pages.length) * 15, 15) // Bonus for comprehensive content
  
  const contentIssues = issues.filter(i => i.category === 'Content')
  contentScore -= Math.min(contentIssues.filter(i => i.severity === 'High').length * 12, 40)
  contentScore -= Math.min(contentIssues.filter(i => i.severity === 'Medium').length * 6, 25)
  contentScore -= Math.min(contentIssues.filter(i => i.severity === 'Low').length * 2, 10)
  
  // Check average word count
  const avgWordCount = pages.reduce((sum, p) => sum + p.wordCount, 0) / pages.length
  if (avgWordCount >= 1000) {
    contentScore += 5 // Bonus for comprehensive content
  } else if (avgWordCount < 300) {
    contentScore -= 10 // Penalty for thin content
  }
  
  contentScore = Math.max(0, Math.min(100, Math.round(contentScore)))
  
  // Enhanced Accessibility score (0-100)
  let accessibilityScore = 100
  const totalImages = pages.reduce((sum, p) => sum + p.imageCount, 0)
  const totalMissingAlt = pages.reduce((sum, p) => sum + p.missingAltCount, 0)
  
  if (totalImages > 0) {
    const missingAltRate = totalMissingAlt / totalImages
    accessibilityScore -= missingAltRate * 55 // More severe penalty
  }
  
  const accessibilityIssues = issues.filter(i => i.category === 'Accessibility')
  accessibilityScore -= Math.min(accessibilityIssues.filter(i => i.severity === 'High').length * 12, 40)
  accessibilityScore -= Math.min(accessibilityIssues.filter(i => i.severity === 'Medium').length * 6, 25)
  accessibilityScore -= Math.min(accessibilityIssues.filter(i => i.severity === 'Low').length * 2, 10)
  
  // Bonus for pages with viewport tags
  const pagesWithViewport = pages.filter(p => p.hasViewport).length
  const viewportRate = pagesWithViewport / pages.length
  accessibilityScore += viewportRate * 5
  
  accessibilityScore = Math.max(0, Math.min(100, Math.round(accessibilityScore)))
  
  // Overall score (weighted average)
  const overall = Math.round(
    technicalScore * 0.3 +
    onPageScore * 0.3 +
    contentScore * 0.2 +
    accessibilityScore * 0.2
  )
  
  return {
    overall,
    technical: technicalScore,
    onPage: onPageScore,
    content: contentScore,
    accessibility: accessibilityScore
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
  
  // Technical score (0-100)
  let technicalScore = 100
  technicalScore -= !siteWide.robotsTxtExists ? 5 : 0
  technicalScore -= !siteWide.sitemapExists ? 10 : 0
  technicalScore -= (siteWide.brokenPages.length / pages.length) * 30
  const technicalIssues = issues.filter(i => i.category === 'Technical')
  technicalScore -= technicalIssues.filter(i => i.severity === 'High').length * 10
  technicalScore -= technicalIssues.filter(i => i.severity === 'Medium').length * 5
  technicalScore -= technicalIssues.filter(i => i.severity === 'Low').length * 2
  technicalScore = Math.max(0, Math.min(100, technicalScore))
  
  // On-page score (0-100)
  // Base score starts at 100, then we deduct points based on issues
  let onPageScore = 100
  const onPageIssues = issues.filter(i => i.category === 'On-page')
  
  if (onPageIssues.length === 0) {
    // Perfect score if no issues
    onPageScore = 100
  } else {
    // Calculate penalty based on issue severity and frequency
    // Count unique pages affected by each severity level
    const highSeverityPages = new Set<string>()
    const mediumSeverityPages = new Set<string>()
    const lowSeverityPages = new Set<string>()
    
    onPageIssues.forEach(issue => {
      if (issue.affectedPages && issue.affectedPages.length > 0) {
        issue.affectedPages.forEach(url => {
          if (issue.severity === 'High') {
            highSeverityPages.add(url)
          } else if (issue.severity === 'Medium') {
            mediumSeverityPages.add(url)
          } else if (issue.severity === 'Low') {
            lowSeverityPages.add(url)
          }
        })
      }
    })
    
    // Calculate penalties based on affected page percentages
    const highIssueRate = highSeverityPages.size / pages.length
    const mediumIssueRate = mediumSeverityPages.size / pages.length
    const lowIssueRate = lowSeverityPages.size / pages.length
    
    // Deduct points based on severity and coverage
    // High severity issues are weighted more heavily
    onPageScore -= Math.min(highIssueRate * 60, 60) // Max 60 points for high severity issues
    onPageScore -= Math.min(mediumIssueRate * 30, 30) // Max 30 points for medium severity issues
    onPageScore -= Math.min(lowIssueRate * 10, 10) // Max 10 points for low severity issues
    
    // Also account for total number of issue instances (consolidated issues)
    // If there are many different types of issues, that's worse
    const uniqueIssueTypes = new Set(onPageIssues.map(i => i.message))
    if (uniqueIssueTypes.size > pages.length * 0.5) {
      // More than 50% of pages have unique issue types = more variety of problems
      onPageScore -= 5
    }
  }
  
  onPageScore = Math.max(0, Math.min(100, Math.round(onPageScore)))
  
  // Content score (0-100)
  let contentScore = 100
  const thinPages = pages.filter(p => p.wordCount < 300).length
  contentScore -= (thinPages / pages.length) * 40
  const contentIssues = issues.filter(i => i.category === 'Content')
  contentScore -= contentIssues.filter(i => i.severity === 'High').length * 10
  contentScore -= contentIssues.filter(i => i.severity === 'Medium').length * 5
  contentScore = Math.max(0, Math.min(100, contentScore))
  
  // Accessibility score (0-100)
  let accessibilityScore = 100
  const totalImages = pages.reduce((sum, p) => sum + p.imageCount, 0)
  const totalMissingAlt = pages.reduce((sum, p) => sum + p.missingAltCount, 0)
  if (totalImages > 0) {
    const missingAltRate = totalMissingAlt / totalImages
    accessibilityScore -= missingAltRate * 50
  }
  const accessibilityIssues = issues.filter(i => i.category === 'Accessibility')
  accessibilityScore -= accessibilityIssues.filter(i => i.severity === 'High').length * 10
  accessibilityScore -= accessibilityIssues.filter(i => i.severity === 'Medium').length * 5
  accessibilityScore = Math.max(0, Math.min(100, accessibilityScore))
  
  // Overall score (weighted average)
  const overall = Math.round(
    technicalScore * 0.3 +
    onPageScore * 0.3 +
    contentScore * 0.2 +
    accessibilityScore * 0.2
  )
  
  return {
    overall,
    technical: Math.round(technicalScore),
    onPage: Math.round(onPageScore),
    content: Math.round(contentScore),
    accessibility: Math.round(accessibilityScore)
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
  return {
    technicalIssues: issues.filter(i => i.category === 'Technical'),
    onPageIssues: issues.filter(i => i.category === 'On-page'),
    contentIssues: issues.filter(i => i.category === 'Content'),
    accessibilityIssues: issues.filter(i => i.category === 'Accessibility'),
    performanceIssues: issues.filter(i => i.category === 'Performance')
  }
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
async function generateRealCompetitorAnalysis(
  competitorUrl: string,
  siteKeywords: string[],
  options: Required<AuditOptions>
): Promise<CompetitorAnalysis> {
  console.log(`[Competitor Analysis] Starting analysis for ${competitorUrl}`)
  console.log(`[Competitor Analysis] Client has ${siteKeywords.length} keywords: ${siteKeywords.slice(0, 5).join(', ')}...`)
  
  try {
    // Crawl competitor site (limited to homepage + a few pages for performance)
    const competitorPages: PageData[] = []
    const competitorCrawledUrls = new Set<string>()
    const competitorQueue: Array<{ url: string; depth: number }> = [{ url: competitorUrl, depth: 0 }]
    
    // Limit competitor crawl to 5 pages max
    const maxCompetitorPages = 5
    const maxCompetitorDepth = 2
    
    console.log(`[Competitor Analysis] Will crawl up to ${maxCompetitorPages} pages from competitor`)
    
    while (competitorQueue.length > 0 && competitorPages.length < maxCompetitorPages) {
      const { url, depth } = competitorQueue.shift()!
      
      if (competitorCrawledUrls.has(url) || depth > maxCompetitorDepth) {
        continue
      }
      
      competitorCrawledUrls.add(url)
      
      try {
        console.log(`[Competitor Analysis] Crawling page ${competitorPages.length + 1}/${maxCompetitorPages}: ${url}`)
        const pageData = await analyzePage(url, options.userAgent, false)
        competitorPages.push(pageData)
        console.log(`[Competitor Analysis] Successfully crawled ${url} - found ${pageData.extractedKeywords?.length || 0} keywords`)
        
        // Extract links for further crawling (limited)
        if (depth < maxCompetitorDepth && pageData.internalLinkCount > 0 && competitorPages.length < maxCompetitorPages) {
          // Add common paths
          const commonPaths = ['/about', '/products', '/services', '/blog']
          for (const path of commonPaths) {
            if (competitorPages.length >= maxCompetitorPages) break
            try {
              const linkUrl = new URL(path, url).toString()
              if (!competitorCrawledUrls.has(linkUrl)) {
                competitorQueue.push({ url: linkUrl, depth: depth + 1 })
              }
            } catch {
              // Invalid URL, skip
            }
          }
        }
      } catch (error) {
        // Skip failed pages
        console.warn(`Failed to analyze competitor page ${url}:`, error)
      }
    }
    
    // Extract competitor keywords
    const competitorKeywords = new Set<string>()
    competitorPages.forEach(page => {
      if (page.extractedKeywords) {
        page.extractedKeywords.forEach(kw => competitorKeywords.add(kw))
      }
      // Also extract from title and H1
      if (page.title) {
        const titleWords = page.title.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 3)
        if (titleWords.length >= 2) {
          competitorKeywords.add(titleWords.slice(0, 3).join(' '))
        }
      }
      if (page.h1Text && page.h1Text.length > 0) {
        page.h1Text.forEach(h1 => {
          const h1Words = h1.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3)
          if (h1Words.length >= 2) {
            competitorKeywords.add(h1Words.slice(0, 3).join(' '))
          }
        })
      }
    })
    
    // Clean and deduplicate competitor keywords
    const competitorKeywordsArray = deduplicateKeywords(Array.from(competitorKeywords))
    
    console.log(`[Competitor Analysis] Extracted ${competitorKeywordsArray.length} total keywords from ${competitorPages.length} competitor pages`)
    console.log(`[Competitor Analysis] Sample competitor keywords: ${competitorKeywordsArray.slice(0, 10).join(', ')}`)
    
    // Use the improved keyword gap finder
    const { gaps, shared, unique } = findKeywordGaps(siteKeywords, competitorKeywordsArray)
    
    console.log(`[Competitor Analysis] Found ${gaps.length} keyword gaps, ${shared.length} shared keywords, and ${unique.length} unique client keywords`)
    
    return {
      competitorUrl,
      competitorKeywords: formatKeywordsForDisplay(competitorKeywordsArray, 25),
      keywordGaps: formatKeywordsForDisplay(gaps, 20),
      sharedKeywords: formatKeywordsForDisplay(shared, 15)
    }
  } catch (error) {
    // If competitor analysis fails, return placeholder
    console.error(`[Competitor Analysis] Failed for ${competitorUrl}:`, error)
    return {
      competitorUrl,
      competitorKeywords: [],
      keywordGaps: [],
      sharedKeywords: []
    }
  }
}

/**
 * Generate competitor keyword gap analysis (fallback - pattern-based)
 */
async function generateCompetitorAnalysis(
  pages: PageData[],
  siteKeywords: string[]
): Promise<CompetitorAnalysis> {
  // Extract keywords from the audited site
  const siteKeywordSet = new Set(siteKeywords.map(k => k.toLowerCase()))
  
  // If we have good extracted keywords from the site, use those as core topics
  // Otherwise, extract meaningful phrases from titles and H1s
  const coreTopics = new Set<string>()
  
  // First, try to extract meaningful multi-word phrases from the site's extracted keywords
  if (siteKeywords.length > 0) {
    // Use the site's extracted keywords as core topics (they're already meaningful phrases)
    siteKeywords.forEach(kw => {
      const kwLower = kw.toLowerCase().trim()
      // Only use keywords that are 2+ words and meaningful (filter out single generic words)
      const words = kwLower.split(/\s+/)
      if (words.length >= 2 && kwLower.length >= 5 && kwLower.length < 40) {
        // Filter out patterns that start with generic words
        const genericStarters = ['how', 'best', 'new', 'top', 'get', 'use', 'free', 'online']
        if (!genericStarters.includes(words[0])) {
          coreTopics.add(kwLower)
        }
      }
    })
  }
  
  // Define generic words at function scope so it can be used later
  const genericWords = new Set(['free', 'online', 'best', 'new', 'top', 'get', 'use', 'make', 'find', 'see', 'more', 'here', 'page', 'site', 'web', 'www', 'com', 'org', 'net', 'gov', 'edu', 'html', 'http', 'https'])
  
  // If we don't have enough good keywords from extractedKeywords, extract from titles/H1s more intelligently
  if (coreTopics.size < 3) {
    const stopWords = new Set(['this', 'that', 'with', 'from', 'your', 'their', 'have', 'been', 'will', 'would', 'could', 'should', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'as', 'is', 'was', 'are', 'were'])
    
    pages.forEach(page => {
      // Extract meaningful 2-3 word phrases from titles
      if (page.title) {
        const titleWords = page.title.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.has(w) && !genericWords.has(w))
          // Remove consecutive duplicates
          .filter((w, i, arr) => i === 0 || w !== arr[i - 1])
        
        // Create 2-3 word phrases from title, ensuring no repeated words
        for (let i = 0; i < titleWords.length - 1 && i < 4; i++) {
          // Skip if words are the same
          if (titleWords[i] === titleWords[i + 1]) continue
          const phrase = `${titleWords[i]} ${titleWords[i + 1]}`
          if (phrase.length >= 5 && phrase.length < 30) {
            coreTopics.add(phrase)
          }
          if (i < titleWords.length - 2) {
            // Skip if any words are the same
            if (titleWords[i] === titleWords[i + 1] || titleWords[i + 1] === titleWords[i + 2] || titleWords[i] === titleWords[i + 2]) continue
            const phrase3 = `${titleWords[i]} ${titleWords[i + 1]} ${titleWords[i + 2]}`
            if (phrase3.length >= 8 && phrase3.length < 40) {
              coreTopics.add(phrase3)
            }
          }
        }
      }
      
      // Extract meaningful phrases from H1s
      if (page.h1Text && page.h1Text.length > 0) {
        page.h1Text.forEach(h1 => {
          const h1Words = h1.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w) && !genericWords.has(w))
          
          // Create 2-3 word phrases from H1
          for (let i = 0; i < h1Words.length - 1 && i < 4; i++) {
            const phrase = `${h1Words[i]} ${h1Words[i + 1]}`
            if (phrase.length >= 5 && phrase.length < 30) {
              coreTopics.add(phrase)
            }
            if (i < h1Words.length - 2) {
              const phrase3 = `${h1Words[i]} ${h1Words[i + 1]} ${h1Words[i + 2]}`
              if (phrase3.length >= 8 && phrase3.length < 40) {
                coreTopics.add(phrase3)
              }
            }
          }
        })
      }
    })
  }
  
  // Generate niche-specific competitor keywords by combining core topics with common SEO patterns
  // Only use meaningful multi-word topics, not single words
  const commonPatterns = [
    'how to',
    'best practices',
    'complete guide',
    'ultimate guide',
    'getting started',
    'tutorial',
    'review',
    'vs',
    'alternatives',
    'comparison',
    'pricing',
    'features',
    'benefits',
    'pros and cons',
    'what is',
    'examples',
    'tips',
    'troubleshooting',
    'advanced',
    'beginner'
  ]
  
  // Create niche-specific competitor keywords
  const nicheCompetitorKeywords: string[] = []
  const coreTopicsArray = Array.from(coreTopics).slice(0, 5) // Use top 5 meaningful topics only
  
  // Only generate competitor keywords if we have meaningful core topics
  if (coreTopicsArray.length > 0) {
    // Filter out topics that are domain names, generic words, or nonsense
    const filteredTopics = coreTopicsArray.filter(topic => {
      const words = topic.split(' ')
      // Filter out topics that contain generic domain words
      if (words.some(w => genericWords.has(w))) return false
      // Filter out topics that are just domain patterns (e.g., "nasa gov", "site com")
      if (words.length === 2 && (genericWords.has(words[0]) || genericWords.has(words[1]))) return false
      // Filter out topics with repeated words
      if (new Set(words).size < words.length) return false
      // Must be at least 2 words and meaningful
      return words.length >= 2 && topic.length >= 5 && topic.length < 40
    })
    
    // Combine meaningful topics with patterns
    filteredTopics.forEach(topic => {
      // Skip single-word topics that don't make sense
      if (topic.split(/\s+/).length < 2) return
      
      // Only use the first 1-2 words of the topic to avoid creating nonsensical phrases
      const topicWords = topic.split(/\s+/)
      const shortTopic = topicWords.slice(0, 2).join(' ') // Use max 2 words from topic
      
      // Skip if topic is too generic or already contains pattern words
      const topicLower = shortTopic.toLowerCase()
      const hasPatternWord = commonPatterns.some(p => topicLower.includes(p.toLowerCase()))
      if (hasPatternWord) return // Skip topics that already contain pattern words
      
      commonPatterns.slice(0, 8).forEach(pattern => {
        const patternLower = pattern.toLowerCase()
        
        // Skip if pattern is already in the topic
        if (topicLower.includes(patternLower)) return
        
        if (pattern.includes(' ')) {
          // Multi-word patterns: "how to [topic]", "complete guide to [topic]"
          // Only add if it creates a meaningful phrase (3-5 words total)
          const combined = `${pattern} ${shortTopic}`.trim()
          const wordCount = combined.split(/\s+/).length
          // Ensure it's a reasonable length and doesn't duplicate the pattern
          if (wordCount >= 3 && wordCount <= 5 && combined.length < 50 && !combined.includes(`${pattern} ${pattern}`)) {
            nicheCompetitorKeywords.push(combined)
          }
        } else {
          // Single word patterns: "[topic] tutorial", "[topic] review"
          if (['tutorial', 'review', 'tips', 'guide', 'examples'].includes(pattern)) {
            const combined = `${shortTopic} ${pattern}`.trim()
            const wordCount = combined.split(/\s+/).length
            if (wordCount >= 2 && wordCount <= 4 && combined.length < 40) {
              nicheCompetitorKeywords.push(combined)
            }
          }
        }
      })
    })
  }
  
  // Combine with some generic high-value keywords that are always relevant
  const genericHighValue = [
    'best practices',
    'how to guide',
    'step by step',
    'complete guide',
    'ultimate guide',
    'beginner guide',
    'advanced techniques',
    'troubleshooting guide',
    'comparison guide',
    'getting started guide'
  ]
  
  const allCompetitorKeywords = [
    ...nicheCompetitorKeywords,
    ...genericHighValue
  ]
  
  // Remove duplicates, filter out nonsensical combinations, and limit
  const uniqueCompetitorKeywords = Array.from(new Set(allCompetitorKeywords))
    .filter(kw => {
      const kwLower = kw.toLowerCase().trim()
      // Filter out keywords that are too short or too long
      if (kwLower.length < 8 || kwLower.length > 50) return false
      
      const words = kwLower.split(/\s+/).filter(w => w.length > 0)
      
      // Filter out single words
      if (words.length < 2) return false
      
      // Filter out keywords with duplicate patterns (e.g., "how to X how to for X")
      const patternWords = ['how', 'to', 'for', 'best', 'practices', 'complete', 'guide', 'ultimate', 'getting', 'started']
      const patternCount = words.filter(w => patternWords.includes(w)).length
      if (patternCount > words.length / 2) {
        // Too many pattern words, likely nonsensical
        return false
      }
      
      // Filter out keywords that repeat the same pattern twice
      const hasDuplicatePattern = commonPatterns.some(pattern => {
        const patternWords = pattern.toLowerCase().split(/\s+/)
        const kwWords = kwLower.split(/\s+/)
        let patternCount = 0
        for (let i = 0; i <= kwWords.length - patternWords.length; i++) {
          const slice = kwWords.slice(i, i + patternWords.length).join(' ')
          if (slice === pattern.toLowerCase()) {
            patternCount++
          }
        }
        return patternCount > 1
      })
      if (hasDuplicatePattern) return false
      
      // Filter out nonsensical patterns like "how to next" or "best docs"
      const genericSingleWords = ['next', 'docs', 'page', 'site', 'web', 'www', 'com', 'org', 'net']
      if (words.length === 2 && genericSingleWords.includes(words[words.length - 1])) {
        return false
      }
      
      // Filter out repetitive word patterns
      const uniqueWords = new Set(words)
      if (uniqueWords.size < 2) return false
      
      // Filter out keywords where the same word appears more than twice
      const wordCounts = new Map<string, number>()
      words.forEach(w => wordCounts.set(w, (wordCounts.get(w) || 0) + 1))
      for (const count of wordCounts.values()) {
        if (count > 2) return false
      }
      
      return true
    })
    .slice(0, 25) // Limit to 25 competitor keywords
  
  // Find keyword gaps (competitor keywords not in site)
  const keywordGaps = uniqueCompetitorKeywords.filter(kw => {
    const kwLower = kw.toLowerCase()
    return !Array.from(siteKeywordSet).some(sk => {
      const skLower = sk.toLowerCase()
      // Check for overlap (not exact match, but related)
      return skLower === kwLower ||
        skLower.includes(kwLower) ||
        kwLower.includes(skLower) ||
        kwLower.split(' ').every(w => skLower.includes(w)) ||
        skLower.split(' ').every(w => kwLower.includes(w))
    })
  })
  
  // Find shared keywords (keywords in both site and competitor analysis)
  const sharedKeywords = uniqueCompetitorKeywords.filter(kw => {
    const kwLower = kw.toLowerCase()
    return Array.from(siteKeywordSet).some(sk => {
      const skLower = sk.toLowerCase()
      // Check for overlap
      return skLower === kwLower ||
        skLower.includes(kwLower) ||
        kwLower.includes(skLower) ||
        kwLower.split(' ').some(w => skLower.includes(w)) ||
        skLower.split(' ').some(w => kwLower.includes(w))
    })
  })
  
  // Get the main topic for context
  const mainTopic = coreTopicsArray[0] || 'your industry'
  
  return {
    competitorUrl: `Analysis based on ${mainTopic} industry patterns and competitor research`,
    competitorKeywords: uniqueCompetitorKeywords.slice(0, 25),
    keywordGaps: keywordGaps.slice(0, 20),
    sharedKeywords: sharedKeywords.slice(0, 15)
  }
}

