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

const DEFAULT_OPTIONS: Required<Omit<AuditOptions, 'tier'>> = {
  maxPages: 50,
  maxDepth: 3,
  userAgent: 'SEO-Audit-Bot/1.0'
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
  const tierLimits = options.tier ? getTierLimits(options.tier) : {}
  
  // Apply add-ons
  let finalMaxPages = options.maxPages ?? tierLimits.maxPages ?? DEFAULT_OPTIONS.maxPages
  if (options.addOns?.additionalPages) {
    finalMaxPages += options.addOns.additionalPages
  }
  
  const opts = { 
    ...DEFAULT_OPTIONS, 
    ...options,
    ...tierLimits,
    maxPages: finalMaxPages,
    // Preserve add-ons
    addOns: options.addOns
  }
  const startTime = Date.now()
  
  // Normalize URL
  const rootUrl = normalizeUrl(url)
  const baseDomain = new URL(rootUrl).hostname
  
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
  await checkRobotsTxt(rootUrl, siteWide)
  
  // Check sitemap.xml
  await checkSitemap(rootUrl, siteWide)
  
  // Crawl pages (pass imageAltTags flag if add-on is selected)
  await crawlPages(rootUrl, baseDomain, opts, crawledUrls, pages, allIssues, opts.addOns?.imageAltTags || false)
  
  // Analyze site-wide issues
  analyzeSiteWideIssues(pages, siteWide, allIssues)
  
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
  
  // Collect keywords from all pages
  const allKeywords = new Set<string>()
  pages.forEach(page => {
    if (page.extractedKeywords) {
      page.extractedKeywords.forEach(kw => allKeywords.add(kw))
    }
  })
  
  // Calculate keyword count based on tier and add-ons
  let keywordCount = opts.tier === 'advanced' ? 10 : opts.tier === 'standard' ? 5 : 0
  if (opts.addOns?.additionalKeywords) {
    keywordCount += opts.addOns.additionalKeywords
  }
  const topKeywords = Array.from(allKeywords).slice(0, keywordCount)
  
  // Image Alt Tags Analysis (if add-on is selected)
  let imageAltAnalysis: ImageAltAnalysis[] | undefined
  if (opts.addOns?.imageAltTags) {
    imageAltAnalysis = await analyzeImageAltTags(pages)
  }
  
  // Competitor Analysis (if add-on is selected)
  let competitorAnalysis: CompetitorAnalysis | undefined
  if (opts.addOns?.competitorAnalysis && options.competitorUrls && options.competitorUrls.length > 0) {
    competitorAnalysis = await generateRealCompetitorAnalysis(
      options.competitorUrls[0], // Analyze first competitor
      topKeywords,
      opts
    )
  } else if (opts.addOns?.competitorAnalysis) {
    // Fallback to pattern-based analysis if no competitor URLs provided
    competitorAnalysis = await generateCompetitorAnalysis(pages, topKeywords)
  }
  
  // Calculate scores
  const scores = calculateScores(pages, allIssues, siteWide)
  
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
  
  while (queue.length > 0 && pages.length < options.maxPages) {
    const { url, depth } = queue.shift()!
    
    if (crawledUrls.has(url) || depth > options.maxDepth) {
      continue
    }
    
    crawledUrls.add(url)
    
    try {
      // Check if this is the main/start page
      const isMainPage = url === startUrl && depth === 0
      const pageData = await analyzePage(url, options.userAgent, needsImageDetails, isMainPage)
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
      if (depth < options.maxDepth && pageData.internalLinkCount > 0) {
        // In a real implementation, we'd parse HTML and extract links
        // For now, we'll limit to the start URL and a few common paths
        if (depth === 0) {
          // Add common paths to queue
          const commonPaths = ['/about', '/contact', '/services', '/products', '/blog']
          for (const path of commonPaths) {
            try {
              const linkUrl = new URL(path, url).toString()
              if (new URL(linkUrl).hostname === baseDomain && !crawledUrls.has(linkUrl)) {
                queue.push({ url: linkUrl, depth: depth + 1 })
              }
            } catch {
              // Invalid URL, skip
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
  } catch (error) {
    // Fallback to basic fetch if rendering fails
    console.warn(`Rendering failed for ${url}, falling back to basic fetch:`, error)
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
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      // Filter out consecutive duplicate words
      .filter((w, i, arr) => i === 0 || w !== arr[i - 1])

    // Create 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      // Skip if words are the same
      if (words[i] === words[i + 1]) continue
      const phrase = `${words[i]} ${words[i + 1]}`
      if (phrase.length >= 5 && phrase.length <= 40) {
        extractedKeywords.push(phrase)
      }
    }
    
    // Create 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      // Skip if any consecutive words are the same
      if (words[i] === words[i + 1] || words[i + 1] === words[i + 2]) continue
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
      if (phrase.length >= 8 && phrase.length <= 50) {
        extractedKeywords.push(phrase)
      }
    }
  })
  
  // Remove duplicates and filter out phrases that are just repeated words
  const uniqueKeywords = Array.from(new Set(extractedKeywords))
    .filter(kw => {
      const words = kw.split(' ')
      // Filter out phrases where all words are the same
      return new Set(words).size > 1
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
    issueMap.set(key, { ...newIssue })
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
  const titleMap = new Map<string, string[]>()
  pages.forEach(page => {
    if (page.title) {
      const normalized = page.title.toLowerCase().trim()
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
    
    // Missing alt tags
    if (page.imageCount > 0 && page.missingAltCount > 0) {
      const percentage = Math.round((page.missingAltCount / page.imageCount) * 100)
      consolidateIssue(issueMap, {
        category: 'Accessibility',
        severity: percentage > 50 ? 'High' : 'Medium',
        message: 'Missing alt attributes on images',
        details: `${page.missingAltCount} of ${page.imageCount} images missing alt text`,
        affectedPages: [page.url]
      })
    }
    
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
 * Calculate SEO scores
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
  let onPageScore = 100
  const onPageIssues = issues.filter(i => i.category === 'On-page')
  const pagesWithIssues = new Set<string>()
  onPageIssues.forEach(issue => {
    if (issue.affectedPages) {
      issue.affectedPages.forEach(url => pagesWithIssues.add(url))
    }
  })
  const issueRate = pagesWithIssues.size / pages.length
  onPageScore -= issueRate * 50
  onPageScore -= onPageIssues.filter(i => i.severity === 'High').length * 5
  onPageScore -= onPageIssues.filter(i => i.severity === 'Medium').length * 2
  onPageScore = Math.max(0, Math.min(100, onPageScore))
  
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
  try {
    // Crawl competitor site (limited to homepage + a few pages for performance)
    const competitorPages: PageData[] = []
    const competitorCrawledUrls = new Set<string>()
    const competitorQueue: Array<{ url: string; depth: number }> = [{ url: competitorUrl, depth: 0 }]
    
    // Limit competitor crawl to 5 pages max
    const maxCompetitorPages = 5
    const maxCompetitorDepth = 2
    
    while (competitorQueue.length > 0 && competitorPages.length < maxCompetitorPages) {
      const { url, depth } = competitorQueue.shift()!
      
      if (competitorCrawledUrls.has(url) || depth > maxCompetitorDepth) {
        continue
      }
      
      competitorCrawledUrls.add(url)
      
      try {
        const pageData = await analyzePage(url, options.userAgent, false)
        competitorPages.push(pageData)
        
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
    
    const competitorKeywordsArray = Array.from(competitorKeywords)
    const siteKeywordSet = new Set(siteKeywords.map(k => k.toLowerCase()))
    
    // Find keyword gaps (competitor has, site doesn't)
    const keywordGaps = competitorKeywordsArray.filter(kw => {
      const kwLower = kw.toLowerCase()
      return !Array.from(siteKeywordSet).some(sk => {
        const skLower = sk.toLowerCase()
        return skLower === kwLower ||
          skLower.includes(kwLower) ||
          kwLower.includes(skLower) ||
          kwLower.split(' ').every(w => skLower.includes(w)) ||
          skLower.split(' ').every(w => kwLower.includes(w))
      })
    })
    
    // Find shared keywords
    const sharedKeywords = competitorKeywordsArray.filter(kw => {
      const kwLower = kw.toLowerCase()
      return Array.from(siteKeywordSet).some(sk => {
        const skLower = sk.toLowerCase()
        return skLower === kwLower ||
          skLower.includes(kwLower) ||
          kwLower.includes(skLower) ||
          kwLower.split(' ').some(w => skLower.includes(w)) ||
          skLower.split(' ').some(w => kwLower.includes(w))
      })
    })
    
    return {
      competitorUrl,
      competitorKeywords: competitorKeywordsArray.slice(0, 25),
      keywordGaps: keywordGaps.slice(0, 20),
      sharedKeywords: sharedKeywords.slice(0, 15)
    }
  } catch (error) {
    // If competitor analysis fails, return placeholder
    console.warn(`Competitor analysis failed for ${competitorUrl}:`, error)
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
  
  // Extract core topic keywords from the site's content to generate niche-specific analysis
  const coreTopics = new Set<string>()
  const stopWords = new Set(['this', 'that', 'with', 'from', 'your', 'their', 'have', 'been', 'will', 'would', 'could', 'should'])
  // Filter out generic/common words that shouldn't be core topics
  const genericWords = new Set(['free', 'online', 'best', 'new', 'top', 'get', 'use', 'make', 'find', 'see', 'more', 'here', 'page', 'site', 'web', 'www', 'com', 'org', 'net'])
  
  pages.forEach(page => {
    if (page.title) {
      const titleWords = page.title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w) && !genericWords.has(w))
      titleWords.forEach(w => coreTopics.add(w))
    }
    if (page.h1Text) {
      page.h1Text.forEach(h1 => {
        const h1Words = h1.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 3 && !stopWords.has(w) && !genericWords.has(w))
        h1Words.forEach(w => coreTopics.add(w))
      })
    }
  })
  
  // Generate niche-specific competitor keywords by combining core topics with common SEO patterns
  const commonPatterns = [
    'how to',
    'best',
    'guide',
    'tutorial',
    'review',
    'vs',
    'alternatives',
    'pricing',
    'features',
    'benefits',
    'pros and cons',
    'what is',
    'examples',
    'tips',
    'ideas',
    'online',
    'free',
    'tool',
    'software',
    'service'
  ]
  
  // Create niche-specific competitor keywords
  const nicheCompetitorKeywords: string[] = []
  const coreTopicsArray = Array.from(coreTopics).slice(0, 8) // Use top 8 core topics
  
  // Combine core topics with patterns to create relevant keywords (one direction only to avoid duplicates)
  coreTopicsArray.forEach(topic => {
    commonPatterns.slice(0, 12).forEach(pattern => {
      if (pattern.includes(' ')) {
        // Multi-word patterns: prefer "how to [topic]" over "[topic] how to"
        nicheCompetitorKeywords.push(`${pattern} ${topic}`)
      } else {
        // Single word patterns: prefer "[pattern] [topic]" for most, but "[topic] [pattern]" for some
        if (['review', 'guide', 'tutorial', 'tips', 'ideas'].includes(pattern)) {
          nicheCompetitorKeywords.push(`${topic} ${pattern}`)
        } else {
          nicheCompetitorKeywords.push(`${pattern} ${topic}`)
        }
      }
    })
  })
  
  // Also include standalone high-value patterns
  const standalonePatterns = [
    'best practices',
    'comparison',
    'alternatives',
    'pricing guide',
    'features',
    'benefits',
    'advantages',
    'disadvantages',
    'definition',
    'case study',
    'testimonials',
    'faq',
    'help',
    'support'
  ]
  
  // Add core topics with standalone patterns
  coreTopicsArray.forEach(topic => {
    standalonePatterns.forEach(pattern => {
      nicheCompetitorKeywords.push(`${topic} ${pattern}`)
    })
  })
  
  // Combine with some generic high-value keywords (but fewer)
  const genericHighValue = [
    'best practices',
    'how to guide',
    'step by step',
    'complete guide',
    'ultimate guide',
    'beginner guide',
    'expert tips'
  ]
  
  const allCompetitorKeywords = [
    ...nicheCompetitorKeywords,
    ...genericHighValue,
    ...Array.from(coreTopics).map(t => `${t} guide`),
    ...Array.from(coreTopics).map(t => `best ${t}`)
  ]
  
  // Remove duplicates and limit
  const uniqueCompetitorKeywords = Array.from(new Set(allCompetitorKeywords))
    .filter(kw => kw.length > 3 && kw.length < 50)
    .slice(0, 30)
  
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

