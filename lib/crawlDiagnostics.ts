/**
 * Crawl Diagnostics Module
 * 
 * Detects crawl failures, platform types, and provides actionable diagnostics
 * for when crawls don't succeed as expected.
 */

export interface CrawlDiagnostics {
  status: 'success' | 'partial' | 'failed'
  pagesFound: number
  pagesSuccessful: number
  pagesFailed: number
  platform: 'wix' | 'wordpress' | 'squarespace' | 'shopify' | 'custom' | 'unknown'
  issues: CrawlIssue[]
  recommendations: string[]
  // NEW: Agency tier - Enhanced crawl diagnostics
  crawlMetrics?: {
    timeToCrawl: number // milliseconds
    pagesPerSecond: number
    averagePageLoadTime: number
    queueHealth: 'healthy' | 'degraded' | 'poor'
    disallowedPaths: string[] // From robots.txt
    pagesSkipped: number
    crawlEfficiency: number // 0-100
  }
}

export interface CrawlIssue {
  type: 'robots-blocked' | 'js-required' | 'redirect-loop' | 'dns-error' | 'timeout' | 'all-404s' | 'parking-page'
  severity: 'critical' | 'warning' | 'info'
  message: string
  affectedUrls?: string[]
}

export interface PageData {
  url: string
  statusCode: number
  contentType?: string
  title?: string
  wordCount?: number
  [key: string]: any
}

/**
 * Analyze crawl results and generate diagnostics (Enhanced for Agency tier)
 */
export function analyzeCrawl(
  pages: PageData[], 
  startUrl: string,
  crawlDuration?: number, // NEW: Time taken to crawl
  disallowedPaths?: string[] // NEW: Paths disallowed by robots.txt
): CrawlDiagnostics {
  const pagesFound = pages.length
  const pagesSuccessful = pages.filter(p => p.statusCode >= 200 && p.statusCode < 400).length
  const pagesFailed = pages.filter(p => p.statusCode >= 400 || p.statusCode === 0).length
  
  // Detect platform
  const platform = detectPlatform(pages, startUrl)
  
  // NEW: Calculate crawl metrics (Agency tier)
  // CRITICAL: Mark as limited if < 5 pages
  const crawlMetrics = pages.length >= 5 
    ? calculateCrawlMetrics(pages, crawlDuration, disallowedPaths || [])
    : undefined // Don't show metrics for single-page or very small crawls
  
  // Detect issues
  const issues: CrawlIssue[] = []
  
  // Check for all 404s
  if (pagesFound > 0 && pagesFailed === pagesFound) {
    issues.push({
      type: 'all-404s',
      severity: 'critical',
      message: 'All pages returned error status codes. The site may be down or blocking our crawler.',
      affectedUrls: pages.map(p => p.url)
    })
  }
  
  // Check for parking page
  if (isParkingPage(pages)) {
    issues.push({
      type: 'parking-page',
      severity: 'critical',
      message: 'Site appears to be a parking page or under construction. No real content detected.'
    })
  }
  
  // Check for robots.txt blocking
  if (isRobotsBlocked(pages)) {
    issues.push({
      type: 'robots-blocked',
      severity: 'warning',
      message: 'robots.txt may be blocking our crawler. Check robots.txt configuration.'
    })
  }
  
  // Check for JS-heavy site
  if (isJSHeavy(pages)) {
    issues.push({
      type: 'js-required',
      severity: 'warning',
      message: 'Site appears to be JavaScript-heavy. Some content may not be fully rendered.'
    })
  }
  
  // Check for redirect loops
  const redirectLoops = detectRedirectLoops(pages)
  if (redirectLoops.length > 0) {
    issues.push({
      type: 'redirect-loop',
      severity: 'warning',
      message: 'Redirect loops detected. Some pages may be inaccessible.',
      affectedUrls: redirectLoops
    })
  }
  
  // Determine overall status
  let status: 'success' | 'partial' | 'failed'
  if (pagesSuccessful === 0) {
    status = 'failed'
  } else if (pagesSuccessful < 5 || (pagesFailed / pagesFound) > 0.5) {
    status = 'partial'
  } else {
    status = 'success'
  }
  
  // Generate recommendations
  const recommendations = generateRecommendations(status, platform, issues)
  
  return {
    status,
    pagesFound,
    pagesSuccessful,
    pagesFailed,
    platform,
    issues,
    recommendations,
    crawlMetrics
  }
}

/**
 * Calculate crawl metrics (Agency tier)
 */
function calculateCrawlMetrics(
  pages: PageData[],
  crawlDuration?: number,
  disallowedPaths: string[] = []
): CrawlDiagnostics['crawlMetrics'] {
  if (!crawlDuration || pages.length === 0) {
    return undefined
  }
  
  const pagesSuccessful = pages.filter(p => p.statusCode >= 200 && p.statusCode < 400).length
  const pagesPerSecond = pages.length / (crawlDuration / 1000)
  
  // Calculate average page load time
  const loadTimes = pages
    .filter(p => p.loadTime && p.loadTime > 0)
    .map(p => p.loadTime!)
  
  const averagePageLoadTime = loadTimes.length > 0
    ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length
    : 0
  
  // Determine queue health
  let queueHealth: 'healthy' | 'degraded' | 'poor' = 'healthy'
  if (pagesPerSecond < 0.1) {
    queueHealth = 'poor'
  } else if (pagesPerSecond < 0.5) {
    queueHealth = 'degraded'
  }
  
  // Calculate crawl efficiency (0-100)
  // Based on success rate, speed, and coverage
  const successRate = pages.length > 0 ? pagesSuccessful / pages.length : 0
  const speedScore = pagesPerSecond > 1 ? 100 : pagesPerSecond * 100
  const efficiency = (successRate * 50) + (speedScore * 0.3) + (pages.length >= 10 ? 20 : pages.length * 2)
  
  // Count skipped pages (would need to track during crawl)
  const pagesSkipped = 0 // Placeholder - would need crawl context
  
  return {
    timeToCrawl: crawlDuration,
    pagesPerSecond: Math.round(pagesPerSecond * 100) / 100,
    averagePageLoadTime: Math.round(averagePageLoadTime),
    queueHealth,
    disallowedPaths,
    pagesSkipped,
    crawlEfficiency: Math.min(100, Math.round(efficiency))
  }
}

/**
 * Detect platform from page content and URLs
 */
function detectPlatform(pages: PageData[], startUrl: string): CrawlDiagnostics['platform'] {
  // Check URL patterns
  if (startUrl.includes('.wixsite.com') || startUrl.includes('wix.com')) {
    return 'wix'
  }
  if (startUrl.includes('.squarespace.com')) {
    return 'squarespace'
  }
  if (startUrl.includes('.myshopify.com')) {
    return 'shopify'
  }
  
  // Check page content for platform signatures (more strict detection)
  for (const page of pages) {
    const content = JSON.stringify(page).toLowerCase()
    
    // Wix detection - look for specific Wix patterns
    if (content.includes('wix.com') || content.includes('wixstatic') || content.includes('wixpress.com')) {
      return 'wix'
    }
    
    // WordPress detection - must have clear WordPress signatures
    // Only detect if we see wp-content URLs, wp-includes, wp-admin, or WordPress generator meta tag
    const hasWpContent = content.includes('/wp-content/') || content.includes('wp-content')
    const hasWpIncludes = content.includes('/wp-includes/') || content.includes('wp-includes')
    const hasWpAdmin = content.includes('/wp-admin/') || content.includes('wp-admin')
    const hasWpGenerator = content.includes('generator') && content.includes('wordpress')
    
    if (hasWpContent || hasWpIncludes || hasWpAdmin || hasWpGenerator) {
      return 'wordpress'
    }
    
    // Squarespace detection
    if (content.includes('.squarespace.com') || content.includes('squarespace-cdn')) {
      return 'squarespace'
    }
    
    // Shopify detection
    if (content.includes('.myshopify.com') || content.includes('cdn.shopify.com') || content.includes('shopifycdn')) {
      return 'shopify'
    }
  }
  
  // Check for government/education sites - these should never be WordPress
  const urlLower = startUrl.toLowerCase()
  if (urlLower.includes('.gov') || urlLower.includes('.edu') || urlLower.includes('.org')) {
    // Additional check: if it's a .gov/.edu/.org and we didn't detect a clear CMS signature, it's custom
    // This prevents false WordPress detection on government sites
    return 'custom'
  }
  
  return 'custom'
}

/**
 * Check if site is a parking page
 */
function isParkingPage(pages: PageData[]): boolean {
  if (pages.length === 0) return false
  
  const parkingKeywords = [
    'domain for sale',
    'this domain is for sale',
    'parked domain',
    'coming soon',
    'under construction',
    'site not found',
    'default web site page'
  ]
  
  for (const page of pages) {
    const content = (page.title || '' + page.wordCount || '').toLowerCase()
    if (parkingKeywords.some(keyword => content.includes(keyword))) {
      return true
    }
  }
  
  return false
}

/**
 * Check if robots.txt is blocking
 */
function isRobotsBlocked(pages: PageData[]): boolean {
  // This is a heuristic - in real implementation, you'd check actual robots.txt
  // For now, if we got very few pages and they're all errors, might be robots
  return pages.length > 0 && pages.length < 3 && pages.every(p => p.statusCode >= 400)
}

/**
 * Check if site is JavaScript-heavy
 */
function isJSHeavy(pages: PageData[]): boolean {
  // Heuristic: if most pages have very low word count but high status codes
  const successfulPages = pages.filter(p => p.statusCode >= 200 && p.statusCode < 400)
  if (successfulPages.length === 0) return false
  
  const lowContentPages = successfulPages.filter(p => (p.wordCount || 0) < 100)
  return lowContentPages.length / successfulPages.length > 0.7
}

/**
 * Detect redirect loops
 */
function detectRedirectLoops(pages: PageData[]): string[] {
  const loops: string[] = []
  
  // Simple check: if same URL appears multiple times with 3xx status
  const redirectUrls = pages.filter(p => p.statusCode >= 300 && p.statusCode < 400)
  const urlCounts = new Map<string, number>()
  
  for (const page of redirectUrls) {
    const count = urlCounts.get(page.url) || 0
    urlCounts.set(page.url, count + 1)
  }
  
  for (const [url, count] of urlCounts.entries()) {
    if (count > 2) {
      loops.push(url)
    }
  }
  
  return loops
}

/**
 * Generate actionable recommendations based on diagnostics
 */
function generateRecommendations(
  status: CrawlDiagnostics['status'],
  platform: CrawlDiagnostics['platform'],
  issues: CrawlIssue[]
): string[] {
  const recommendations: string[] = []
  
  if (status === 'failed') {
    recommendations.push('🔴 Crawl failed completely. We recommend:')
    recommendations.push('1. Verify the site is accessible in a regular browser')
    recommendations.push('2. Check if the site is blocking automated crawlers')
    recommendations.push('3. Contact support for a manual audit')
  } else if (status === 'partial') {
    recommendations.push('⚠️ Partial crawl detected. Results may be incomplete.')
    recommendations.push('1. Some pages may not be accessible to our crawler')
    recommendations.push('2. Consider providing a sitemap.xml for better coverage')
  }
  
  // Platform-specific recommendations
  if (platform === 'wix') {
    recommendations.push('📱 Wix site detected. Wix sites can be challenging to crawl due to:')
    recommendations.push('• Heavy JavaScript rendering')
    recommendations.push('• Crawler protection settings')
    recommendations.push('• Recommendation: Ensure "Let search engines index your site" is enabled in Wix SEO settings')
  } else if (platform === 'wordpress') {
    recommendations.push('📱 WordPress site detected.')
    recommendations.push('• Ensure no security plugins are blocking crawlers')
    recommendations.push('• Check that "Discourage search engines" is NOT checked in Settings → Reading')
  }
  
  // Issue-specific recommendations
  for (const issue of issues) {
    if (issue.type === 'robots-blocked') {
      recommendations.push('🤖 robots.txt may be blocking our crawler.')
      recommendations.push('• Check robots.txt file and ensure User-agent: * is allowed')
      recommendations.push('• Or add our crawler to allowed list: User-agent: SEOAuditBot')
    }
    
    if (issue.type === 'js-required') {
      recommendations.push('⚡ Site requires JavaScript rendering.')
      recommendations.push('• This is normal for modern sites')
      recommendations.push('• We use headless browser rendering, but some content may be missed')
    }
    
    if (issue.type === 'all-404s') {
      recommendations.push('❌ All pages returned 404 errors.')
      recommendations.push('• The site may be down or moved')
      recommendations.push('• Check DNS settings and hosting status')
      recommendations.push('• Verify the URL is correct')
    }
    
    if (issue.type === 'parking-page') {
      recommendations.push('🚧 Site appears to be a parking page or under construction.')
      recommendations.push('• No real content to audit')
      recommendations.push('• Contact us when the site is live for a full audit')
    }
  }
  
  return recommendations
}

/**
 * Get user-friendly status message
 */
export function getStatusMessage(diagnostics: CrawlDiagnostics): string {
  switch (diagnostics.status) {
    case 'success':
      return `✅ Full crawl successful - ${diagnostics.pagesSuccessful} pages analyzed`
    case 'partial':
      return `⚠️ Partial crawl - ${diagnostics.pagesSuccessful} pages analyzed, ${diagnostics.pagesFailed} pages failed`
    case 'failed':
      return `❌ Crawl failed - Unable to access site content`
    default:
      return 'Unknown status'
  }
}

/**
 * Check if crawl results are sufficient for a full audit
 */
export function isCrawlSufficient(diagnostics: CrawlDiagnostics): boolean {
  return diagnostics.status === 'success' && diagnostics.pagesSuccessful >= 5
}

/**
 * Get HTML for crawl status section in report
 */
export function getCrawlStatusHTML(diagnostics: CrawlDiagnostics): string {
  const statusColor = diagnostics.status === 'success' ? '#10b981' : 
                      diagnostics.status === 'partial' ? '#f59e0b' : '#ef4444'
  
  let html = `
    <div style="background: #f9fafb; border-left: 4px solid ${statusColor}; padding: 20px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: ${statusColor};">${getStatusMessage(diagnostics)}</h3>
      <p><strong>Platform:</strong> ${diagnostics.platform.charAt(0).toUpperCase() + diagnostics.platform.slice(1)}</p>
      <p><strong>Pages Found:</strong> ${diagnostics.pagesFound}</p>
      <p><strong>Pages Successful:</strong> ${diagnostics.pagesSuccessful}</p>
      <p><strong>Pages Failed:</strong> ${diagnostics.pagesFailed}</p>
  `
  
  if (diagnostics.issues.length > 0) {
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px;">Issues Detected:</h4><ul>`
    for (const issue of diagnostics.issues) {
      const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'
      html += `<li>${icon} ${issue.message}</li>`
    }
    html += `</ul>`
  }
  
  if (diagnostics.recommendations.length > 0) {
    html += `<h4 style="margin-top: 20px; margin-bottom: 10px;">Recommendations:</h4><ul>`
    for (const rec of diagnostics.recommendations) {
      html += `<li>${rec}</li>`
    }
    html += `</ul>`
  }
  
  html += `</div>`
  
  return html
}

