/**
 * SEO Scoring Engine
 * 
 * Calculates category scores based on issues, metrics, and quality signals.
 * Each category score is 0-100, with documented weighting formulas.
 */

import { Issue, PageData } from './types'

export interface CategoryScores {
  technical: number
  onPage: number
  content: number
  accessibility: number
  performance: number
}

export interface ScoringWeights {
  // Technical category weights
  technical: {
    securityHeaders: number
    httpsRedirects: number
    mixedContent: number
    robotsTxt: number
    sitemap: number
    schema: number
    canonicals: number
  }
  
  // On-page category weights
  onPage: {
    titleQuality: number
    metaDescription: number
    headingStructure: number
    internalLinking: number
    duplicateContent: number
    urlStructure: number
  }
  
  // Content category weights
  content: {
    depth: number
    readability: number
    thinContent: number
    freshness: number
    keywordUsage: number
  }
  
  // Accessibility weights
  accessibility: {
    altText: number
    ariaLabels: number
    colorContrast: number
    keyboardNav: number
  }
  
  // Performance weights
  performance: {
    coreWebVitals: number
    pageSize: number
    compression: number
    caching: number
  }
}

/**
 * Default scoring weights (sum to 100 per category)
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  technical: {
    securityHeaders: 20,
    httpsRedirects: 15,
    mixedContent: 20,
    robotsTxt: 10,
    sitemap: 10,
    schema: 15,
    canonicals: 10
  },
  onPage: {
    titleQuality: 25,
    metaDescription: 20,
    headingStructure: 15,
    internalLinking: 15,
    duplicateContent: 15,
    urlStructure: 10
  },
  content: {
    depth: 25,
    readability: 30,
    thinContent: 20,
    freshness: 15,
    keywordUsage: 10
  },
  accessibility: {
    altText: 40,
    ariaLabels: 20,
    colorContrast: 20,
    keyboardNav: 20
  },
  performance: {
    coreWebVitals: 50,
    pageSize: 20,
    compression: 15,
    caching: 15
  }
}

/**
 * Issue severity to point deduction mapping
 */
const SEVERITY_DEDUCTIONS = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1
}

/**
 * Calculate Technical score
 * CRITICAL FIX: Properly match issues and deduct points
 */
export function calculateTechnicalScore(
  issues: Issue[],
  pages: PageData[],
  siteWide: { robotsTxtExists: boolean; sitemapExists: boolean },
  weights = DEFAULT_WEIGHTS.technical
): number {
  let score = 100
  
  // Helper to check if issue matches pattern
  const matchesIssue = (issue: Issue, patterns: string[]): boolean => {
    const issueAny = issue as any
    const type = (issueAny.type || '').toLowerCase()
    const message = (issue.message || '').toLowerCase()
    const title = (issueAny.title || '').toLowerCase()
    return patterns.some(pattern => 
      type.includes(pattern) || message.includes(pattern) || title.includes(pattern)
    )
  }
  
  // Security headers (-20 points max)
  const securityIssues = issues.filter(i => 
    i.category === 'Technical' && matchesIssue(i, ['header', 'csp', 'security', 'x-frame', 'referrer'])
  )
  securityIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 5
    else if (issue.severity === 'Medium') score -= 2
    else score -= 1
  })
  
  // HTTPS/redirects (-15 points max)
  const httpsIssues = issues.filter(i => 
    i.category === 'Technical' && matchesIssue(i, ['https', 'redirect', 'http version'])
  )
  httpsIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 5
    else if (issue.severity === 'Medium') score -= 2
    else score -= 1
  })
  
  // Mixed content (-20 points max) - CRITICAL: High severity
  const mixedContentIssues = issues.filter(i => 
    i.category === 'Technical' && matchesIssue(i, ['mixed content', 'mixed-content', 'http resource'])
  )
  mixedContentIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 10
    else if (issue.severity === 'Medium') score -= 5
    else score -= 2
  })
  
  // Broken pages - CRITICAL: High severity
  const brokenPageIssues = issues.filter(i => 
    i.category === 'Technical' && matchesIssue(i, ['broken', 'error', '404', '500', 'status code'])
  )
  brokenPageIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 15 // Major deduction for broken pages
    else if (issue.severity === 'Medium') score -= 5
    else score -= 2
  })
  
  // Robots.txt (-10 points if missing or unreachable)
  const robotsIssues = issues.filter(i => 
    i.category === 'Technical' && matchesIssue(i, ['robots.txt', 'robots'])
  )
  if (!siteWide.robotsTxtExists || robotsIssues.length > 0) {
    score -= weights.robotsTxt
  }
  
  // Sitemap (-10 points if missing)
  const sitemapIssues = issues.filter(i => 
    i.category === 'Technical' && matchesIssue(i, ['sitemap', 'sitemap.xml'])
  )
  if (!siteWide.sitemapExists || sitemapIssues.length > 0) {
    score -= weights.sitemap
  }
  
  // Schema issues (-15 points max) - CRITICAL: Missing schema is important
  const schemaIssues = issues.filter(i => 
    i.category === 'Technical' && matchesIssue(i, ['schema', 'structured data', 'json-ld'])
  )
  schemaIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 8
    else if (issue.severity === 'Medium') score -= 3
    else score -= 1
  })
  
  // Viewport meta tag - CRITICAL: High severity
  const viewportIssues = issues.filter(i => 
    i.category === 'Technical' && matchesIssue(i, ['viewport', 'mobile'])
  )
  viewportIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 10
    else if (issue.severity === 'Medium') score -= 3
    else score -= 1
  })
  
  // Canonical issues (-10 points max)
  const canonicalIssues = issues.filter(i => 
    i.category === 'Technical' && matchesIssue(i, ['canonical'])
  )
  canonicalIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 5
    else if (issue.severity === 'Medium') score -= 2
    else score -= 1
  })
  
  // CRITICAL: Cannot have perfect score if any High priority issues exist
  const hasHighPriorityIssues = issues.some(i => 
    i.category === 'Technical' && i.severity === 'High'
  )
  if (hasHighPriorityIssues) {
    // More aggressive cap based on number of high priority issues
    const highIssueCount = issues.filter(i => i.category === 'Technical' && i.severity === 'High').length
    const maxScore = Math.max(30, 85 - (highIssueCount * 10)) // Cap lower with more high issues
    score = Math.min(score, maxScore)
  }
  
  return Math.max(0, Math.round(score))
}

/**
 * Calculate On-Page score
 * CRITICAL FIX: Properly match issues and deduct points based on severity
 */
export function calculateOnPageScore(
  issues: Issue[],
  pages: PageData[],
  weights = DEFAULT_WEIGHTS.onPage
): number {
  let score = 100
  
  // Helper to check if issue matches pattern (checks both type and message)
  const matchesIssue = (issue: Issue, patterns: string[]): boolean => {
    const type = ((issue as any).type || '').toLowerCase()
    const message = (issue.message || '').toLowerCase()
    const title = ((issue as any).title || '').toLowerCase()
    return patterns.some(pattern => 
      type.includes(pattern) || message.includes(pattern) || title.includes(pattern)
    )
  }
  
  // Title issues (-25 points max) - CRITICAL: Missing title is HIGH severity
  const titleIssues = issues.filter(i => 
    i.category === 'On-page' && matchesIssue(i, ['title', 'missing page title', 'missing title tag'])
  )
  titleIssues.forEach(issue => {
    if (issue.severity === 'High') {
      score -= 10 // Major deduction for missing title
    } else if (issue.severity === 'Medium') {
      score -= 4
    } else {
      score -= 2
    }
  })
  
  // Also check actual page data for missing titles
  const pagesWithoutTitle = pages.filter(p => !p.title || p.title.trim().length === 0).length
  if (pagesWithoutTitle > 0) {
    const missingTitleRate = pagesWithoutTitle / pages.length
    score -= Math.min(weights.titleQuality, missingTitleRate * weights.titleQuality)
  }
  
  // Meta description issues (-20 points max) - CRITICAL: Missing meta is HIGH severity
  const metaIssues = issues.filter(i => 
    i.category === 'On-page' && matchesIssue(i, ['meta description', 'missing meta', 'missing description'])
  )
  metaIssues.forEach(issue => {
    if (issue.severity === 'High') {
      score -= 8 // Major deduction for missing meta
    } else if (issue.severity === 'Medium') {
      score -= 3
    } else {
      score -= 1
    }
  })
  
  // Also check actual page data for missing meta descriptions
  const pagesWithoutMeta = pages.filter(p => !p.metaDescription || p.metaDescription.trim().length === 0).length
  if (pagesWithoutMeta > 0) {
    const missingMetaRate = pagesWithoutMeta / pages.length
    score -= Math.min(weights.metaDescription, missingMetaRate * weights.metaDescription)
  }
  
  // Heading structure issues (-15 points max) - CRITICAL: Missing H1 is HIGH severity
  const headingIssues = issues.filter(i => 
    i.category === 'On-page' && matchesIssue(i, ['h1', 'heading', 'missing h1', 'no h1'])
  )
  headingIssues.forEach(issue => {
    if (issue.severity === 'High') {
      score -= 8 // Major deduction for missing H1
    } else if (issue.severity === 'Medium') {
      score -= 3
    } else {
      score -= 1
    }
  })
  
  // Also check actual page data for missing H1
  const pagesWithoutH1 = pages.filter(p => !p.h1Count || p.h1Count === 0).length
  if (pagesWithoutH1 > 0) {
    const missingH1Rate = pagesWithoutH1 / pages.length
    score -= Math.min(weights.headingStructure, missingH1Rate * weights.headingStructure)
  }
  
  // Internal linking issues (-15 points max)
  const linkIssues = issues.filter(i => 
    i.category === 'On-page' && matchesIssue(i, ['internal link', 'no internal link', 'internal linking'])
  )
  linkIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 5
    else if (issue.severity === 'Medium') score -= 2
    else score -= 1
  })
  
  // Duplicate content (-15 points max)
  const duplicateIssues = issues.filter(i => 
    i.category === 'On-page' && matchesIssue(i, ['duplicate', 'duplicate title', 'duplicate meta'])
  )
  duplicateIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 5
    else if (issue.severity === 'Medium') score -= 2
    else score -= 1
  })
  
  // Canonical issues
  const canonicalIssues = issues.filter(i => 
    i.category === 'On-page' && matchesIssue(i, ['canonical', 'missing canonical'])
  )
  canonicalIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 5
    else if (issue.severity === 'Medium') score -= 2
    else score -= 1
  })
  
  // URL structure (-10 points max)
  const urlIssues = issues.filter(i => 
    i.category === 'On-page' && matchesIssue(i, ['url', 'url structure'])
  )
  urlIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 3
    else if (issue.severity === 'Medium') score -= 1
    else score -= 0.5
  })
  
  // CRITICAL: Cannot have perfect score if any High priority issues exist
  const hasHighPriorityIssues = issues.some(i => 
    i.category === 'On-page' && i.severity === 'High'
  )
  if (hasHighPriorityIssues) {
    // More aggressive cap - missing title/meta/H1 are critical
    const highIssueCount = issues.filter(i => i.category === 'On-page' && i.severity === 'High').length
    const maxScore = Math.max(40, 80 - (highIssueCount * 15)) // Cap lower with more high issues
    score = Math.min(score, maxScore)
  }
  
  return Math.max(0, Math.round(score))
}

/**
 * Calculate Content score with readability integration
 * CRITICAL FIX: Properly match issues and deduct points
 */
export function calculateContentScore(
  issues: Issue[],
  pages: PageData[],
  weights = DEFAULT_WEIGHTS.content
): number {
  let score = 100
  
  // Helper to check if issue matches pattern
  const matchesIssue = (issue: Issue, patterns: string[]): boolean => {
    const issueAny = issue as any
    const type = (issueAny.type || '').toLowerCase()
    const message = (issue.message || '').toLowerCase()
    const title = (issueAny.title || '').toLowerCase()
    return patterns.some(pattern => 
      type.includes(pattern) || message.includes(pattern) || title.includes(pattern)
    )
  }
  
  // Content depth subscore (0-25 points)
  const depthSubscore = calculateDepthSubscore(pages)
  const depthPenalty = weights.depth * (1 - depthSubscore / 100)
  score -= depthPenalty
  
  // Readability subscore (0-30 points) - CRITICAL FIX
  const readabilitySubscore = calculateReadabilitySubscore(pages)
  const readabilityPenalty = weights.readability * (1 - readabilitySubscore / 100)
  score -= readabilityPenalty
  
  // Thin content penalty (-20 points max) - CRITICAL: High severity for 0 words
  const thinContentIssues = issues.filter(i => 
    i.category === 'Content' && matchesIssue(i, ['thin content', 'thin-content', 'word count', '0 words'])
  )
  thinContentIssues.forEach(issue => {
    // Check if it's 0 words (critical) or just low word count
    const isZeroWords = (issue.details || '').includes('0 words') || 
                       (issue.message || '').includes('0 words')
    if (isZeroWords) {
      score -= 15 // Major penalty for 0 words
    } else if (issue.severity === 'High') {
      score -= 8
    } else if (issue.severity === 'Medium') {
      score -= 4
    } else {
      score -= 2
    }
  })
  
  // Also check actual page data for thin content
  const thinPages = pages.filter(p => !p.wordCount || p.wordCount < 300).length
  if (thinPages > 0) {
    const thinContentRate = thinPages / pages.length
    score -= Math.min(weights.thinContent, thinContentRate * weights.thinContent)
  }
  
  // Readability issues (Flesch score, sentence length)
  const readabilityIssues = issues.filter(i => 
    i.category === 'Content' && matchesIssue(i, ['readability', 'flesch', 'reading ease', 'sentence', 'difficult to read'])
  )
  readabilityIssues.forEach(issue => {
    // Check for very difficult readability (Flesch < 30 or 0)
    let isVeryDifficult = false
    if ((issue.details || '').includes('Flesch')) {
      const fleschMatch = (issue.details || '').match(/Flesch.*?(\d+)/i)
      if (fleschMatch && fleschMatch[1]) {
        const fleschScore = parseInt(fleschMatch[1], 10)
        isVeryDifficult = fleschScore < 30
      }
    }
    
    if (isVeryDifficult) {
      score -= 10 // Major penalty for very difficult readability
    } else if (issue.severity === 'High') {
      score -= 6
    } else if (issue.severity === 'Medium') {
      score -= 3
    } else {
      score -= 1
    }
  })
  
  // Keyword usage
  const keywordIssues = issues.filter(i => 
    i.category === 'Content' && matchesIssue(i, ['keyword'])
  )
  keywordIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 3
    else if (issue.severity === 'Medium') score -= 1
    else score -= 0.5
  })
  
  // CRITICAL: Cannot have perfect score if any High priority issues exist
  const hasHighPriorityIssues = issues.some(i => 
    i.category === 'Content' && i.severity === 'High'
  )
  if (hasHighPriorityIssues) {
    // More aggressive cap - thin content (0 words) is critical
    const highIssueCount = issues.filter(i => i.category === 'Content' && i.severity === 'High').length
    const maxScore = Math.max(50, 80 - (highIssueCount * 10)) // Cap lower with more high issues
    score = Math.min(score, maxScore)
  }
  
  return Math.max(0, Math.round(score))
}

/**
 * Calculate depth subscore (0-100)
 * Based on word count and content structure
 */
function calculateDepthSubscore(pages: PageData[]): number {
  if (pages.length === 0) return 50
  
  let totalScore = 0
  let pageCount = 0
  
  pages.forEach(page => {
    if (!page.wordCount) return
    
    let pageScore = 0
    
    // Word count scoring
    if (page.wordCount < 300) pageScore = 30
    else if (page.wordCount < 600) pageScore = 60
    else if (page.wordCount < 1000) pageScore = 80
    else pageScore = 100
    
    // Bonus for good structure (H1, H2s)
    if (page.h1Text && page.h1Text.length > 0) pageScore += 5
    if (page.h2Count && page.h2Count >= 3) pageScore += 5
    
    totalScore += Math.min(100, pageScore)
    pageCount++
  })
  
  return pageCount > 0 ? totalScore / pageCount : 50
}

/**
 * Calculate readability subscore (0-100)
 * CRITICAL FIX: Properly integrate Flesch Reading Ease and sentence length
 */
function calculateReadabilitySubscore(pages: PageData[]): number {
  if (pages.length === 0) return 50
  
  let totalScore = 0
  let pageCount = 0
  
  pages.forEach(page => {
    let pageScore = 100
    
    // Flesch Reading Ease scoring (0-100, higher is easier)
    // 90-100: Very Easy (5th grade) → 100 points
    // 80-89: Easy (6th grade) → 90 points
    // 70-79: Fairly Easy (7th grade) → 80 points
    // 60-69: Standard (8th-9th grade) → 70 points
    // 50-59: Fairly Difficult (10th-12th grade) → 60 points
    // 30-49: Difficult (college) → 40 points
    // 0-29: Very Difficult (college graduate) → 20 points
    
    if (page.readability?.fleschScore !== undefined) {
      const flesch = page.readability.fleschScore
      if (flesch >= 90) pageScore = 100
      else if (flesch >= 80) pageScore = 90
      else if (flesch >= 70) pageScore = 80
      else if (flesch >= 60) pageScore = 70
      else if (flesch >= 50) pageScore = 60
      else if (flesch >= 30) pageScore = 40
      else pageScore = 20
    }
    
    // Sentence length penalty
    if (page.readability?.averageSentenceLength) {
      const avgLength = page.readability.averageSentenceLength
      
      // Ideal: 15-20 words per sentence
      // Acceptable: 10-25 words
      // Problem: <10 (choppy) or >30 (too complex)
      
      if (avgLength > 30) {
        // Very long sentences - major penalty
        pageScore *= 0.6
      } else if (avgLength > 25) {
        // Long sentences - moderate penalty
        pageScore *= 0.8
      } else if (avgLength < 10) {
        // Very short sentences - minor penalty
        pageScore *= 0.9
      }
      
      // Extreme cases (>50 words likely parsing error, but penalize heavily)
      if (avgLength > 50) {
        pageScore *= 0.4
      }
    }
    
    totalScore += Math.max(0, Math.min(100, pageScore))
    pageCount++
  })
  
  return pageCount > 0 ? totalScore / pageCount : 50
}

/**
 * Calculate Performance score with LCP validation
 */
export function calculatePerformanceScore(
  issues: Issue[],
  pages: PageData[],
  weights = DEFAULT_WEIGHTS.performance
): number {
  let score = 100
  
  // Core Web Vitals subscore (-50 points max)
  const cwvSubscore = calculateCoreWebVitalsSubscore(pages)
  score -= weights.coreWebVitals * (1 - cwvSubscore / 100)
  
  // Page size issues (-20 points max)
  const sizeIssues = issues.filter(i => 
    i.category === 'Performance' && ((i as any).type?.includes('size') || (i as any).type?.includes('image'))
  )
  score -= Math.min(weights.pageSize, sizeIssues.length * 4)
  
  // Compression issues (-15 points max)
  const compressionIssues = issues.filter(i => 
    i.category === 'Performance' && (i as any).type?.includes('compression')
  )
  score -= Math.min(weights.compression, compressionIssues.length * 7.5)
  
  // Caching issues (-15 points max)
  const cacheIssues = issues.filter(i => 
    i.category === 'Performance' && (i as any).type?.includes('cache')
  )
  score -= Math.min(weights.caching, cacheIssues.length * 5)
  
  return Math.max(0, Math.round(score))
}

/**
 * Calculate Core Web Vitals subscore with LCP validation
 * CRITICAL FIX: Clamp invalid metrics
 */
function calculateCoreWebVitalsSubscore(pages: PageData[]): number {
  const mainPage = pages.find(p => p.pageSpeedData || p.performanceMetrics) || pages[0]
  if (!mainPage) return 70 // Neutral if no data
  
  // Try to get metrics from pageSpeedData (simplified structure) or performanceMetrics
  let lcp: number | undefined
  let fcp: number | undefined
  let cls: number | undefined
  let ttfb: number | undefined
  
  if (mainPage.pageSpeedData) {
    // Handle both simplified structure and full PageSpeedData structure
    const psd = mainPage.pageSpeedData as any
    if (psd.lcp !== undefined) {
      lcp = psd.lcp
      fcp = psd.fcp
      cls = psd.cls
      ttfb = psd.ttfb
    } else if (psd.mobile) {
      // Full PageSpeedData structure
      lcp = psd.mobile.lcp
      fcp = psd.mobile.fcp
      cls = psd.mobile.cls
      ttfb = psd.mobile.ttfb
    }
  } else if (mainPage.performanceMetrics) {
    lcp = mainPage.performanceMetrics.lcp
    fcp = mainPage.performanceMetrics.fcp
    cls = mainPage.performanceMetrics.cls
    ttfb = mainPage.performanceMetrics.ttfb
  }
  
  if (lcp === undefined && fcp === undefined) return 70 // No paint metrics
  let score = 100
  
  // Validate and clamp LCP (should be reasonable relative to FCP/TTFB)
  let validatedLcp = lcp
  if (lcp && fcp && ttfb) {
    // LCP should be >= FCP and not absurdly high
    // If LCP > 30s and FCP < 5s, likely parsing error
    if (lcp > 30000 && fcp < 5000) {
      console.warn(`[Scoring] Suspicious LCP value: ${lcp}ms with FCP ${fcp}ms - capping to 10s`)
      validatedLcp = 10000 // Cap to 10s as fallback
    }
    
    // LCP must be >= FCP
    if (lcp < fcp) {
      console.warn(`[Scoring] Invalid LCP < FCP: ${lcp}ms < ${fcp}ms - using FCP`)
      validatedLcp = fcp
    }
  }
  
  // LCP scoring (in ms)
  if (validatedLcp) {
    if (validatedLcp <= 2500) score -= 0 // Good
    else if (validatedLcp <= 4000) score -= 15 // Needs improvement
    else score -= 30 // Poor
  }
  
  // FCP scoring
  if (fcp) {
    if (fcp <= 1800) score -= 0 // Good
    else if (fcp <= 3000) score -= 10 // Needs improvement
    else score -= 20 // Poor
  }
  
  // CLS scoring
  if (cls !== undefined) {
    if (cls <= 0.1) score -= 0 // Good
    else if (cls <= 0.25) score -= 5 // Needs improvement
    else score -= 10 // Poor
  }
  
  // TTFB scoring
  if (ttfb) {
    if (ttfb <= 800) score -= 0 // Good
    else if (ttfb <= 1800) score -= 5 // Needs improvement
    else score -= 10 // Poor
  }
  
  return Math.max(0, score)
}

/**
 * Calculate Accessibility score
 * CRITICAL FIX: Viewport missing affects accessibility, prevent 100/100 when High issues exist
 */
export function calculateAccessibilityScore(
  issues: Issue[],
  pages: PageData[],
  weights = DEFAULT_WEIGHTS.accessibility
): number {
  let score = 100
  
  // Helper to check if issue matches pattern
  const matchesIssue = (issue: Issue, patterns: string[]): boolean => {
    const issueAny = issue as any
    const type = (issueAny.type || '').toLowerCase()
    const message = (issue.message || '').toLowerCase()
    const title = (issueAny.title || '').toLowerCase()
    return patterns.some(pattern => 
      type.includes(pattern) || message.includes(pattern) || title.includes(pattern)
    )
  }
  
  // CRITICAL: Viewport meta tag is required for mobile accessibility
  const viewportIssues = issues.filter(i => 
    i.category === 'Technical' && matchesIssue(i, ['viewport', 'mobile'])
  )
  viewportIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 15 // Major penalty - viewport is critical for accessibility
    else if (issue.severity === 'Medium') score -= 8
    else score -= 3
  })
  
  // Also check actual page data for missing viewport
  const pagesWithoutViewport = pages.filter(p => !p.hasViewport).length
  if (pagesWithoutViewport > 0) {
    const missingViewportRate = pagesWithoutViewport / pages.length
    score -= Math.min(15, missingViewportRate * 15) // Up to 15 points for missing viewport
  }
  
  // Alt text issues (-40 points max) - CRITICAL: High severity
  const altIssues = issues.filter(i => 
    i.category === 'Accessibility' && matchesIssue(i, ['alt', 'alt text', 'missing alt', 'image alt'])
  )
  altIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 10
    else if (issue.severity === 'Medium') score -= 4
    else score -= 1
  })
  
  // Also check actual page data for missing alt text
  const totalImages = pages.reduce((sum, p) => sum + (p.imageCount || 0), 0)
  const totalMissingAlt = pages.reduce((sum, p) => sum + (p.missingAltCount || 0), 0)
  if (totalImages > 0) {
    const missingAltRate = totalMissingAlt / totalImages
    score -= Math.min(weights.altText, missingAltRate * weights.altText)
  }
  
  // ARIA label issues (-20 points max)
  const ariaIssues = issues.filter(i => 
    i.category === 'Accessibility' && matchesIssue(i, ['aria', 'aria label'])
  )
  ariaIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 5
    else if (issue.severity === 'Medium') score -= 2
    else score -= 1
  })
  
  // Color contrast issues (-20 points max)
  const contrastIssues = issues.filter(i => 
    i.category === 'Accessibility' && matchesIssue(i, ['contrast', 'color contrast'])
  )
  contrastIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 5
    else if (issue.severity === 'Medium') score -= 2
    else score -= 1
  })
  
  // Keyboard navigation issues (-20 points max)
  const keyboardIssues = issues.filter(i => 
    i.category === 'Accessibility' && matchesIssue(i, ['keyboard', 'keyboard navigation'])
  )
  keyboardIssues.forEach(issue => {
    if (issue.severity === 'High') score -= 5
    else if (issue.severity === 'Medium') score -= 2
    else score -= 1
  })
  
  // CRITICAL: Cannot have perfect score if any High priority issues exist (including viewport)
  const hasHighPriorityIssues = issues.some(i => 
    (i.category === 'Accessibility' || (i.category === 'Technical' && matchesIssue(i, ['viewport']))) && 
    i.severity === 'High'
  )
  const hasMissingViewport = pages.some(p => !p.hasViewport)
  
  if (hasHighPriorityIssues || hasMissingViewport) {
    score = Math.min(score, 85) // Cap at 85 if high priority issues exist or viewport missing
  }
  
  // CRITICAL FIX: Penalize score if comprehensive accessibility checks haven't been performed
  // True accessibility requires checks for: ARIA, contrast, keyboard nav, form labels, landmarks, etc.
  // If we're only checking alt text and viewport, we haven't done a comprehensive audit
  const hasAriaChecks = ariaIssues.length > 0 || issues.some(i => 
    i.category === 'Accessibility' && (matchesIssue(i, ['aria', 'role', 'landmark']) || 
    i.message.toLowerCase().includes('aria') || i.message.toLowerCase().includes('role'))
  )
  const hasContrastChecks = contrastIssues.length > 0 || issues.some(i => 
    i.category === 'Accessibility' && matchesIssue(i, ['contrast', 'color'])
  )
  const hasKeyboardChecks = keyboardIssues.length > 0 || issues.some(i => 
    i.category === 'Accessibility' && matchesIssue(i, ['keyboard', 'navigation', 'tab'])
  )
  const hasFormLabelChecks = issues.some(i => 
    i.category === 'Accessibility' && matchesIssue(i, ['form', 'label', 'input'])
  )
  
  // Count how many comprehensive checks were performed
  const comprehensiveChecksPerformed = [
    hasAriaChecks,
    hasContrastChecks,
    hasKeyboardChecks,
    hasFormLabelChecks
  ].filter(Boolean).length
  
  // If we've only done basic checks (alt text + viewport), reduce score
  // A comprehensive accessibility audit should check at least 3-4 of these areas
  if (comprehensiveChecksPerformed < 2) {
    // We're only doing basic checks (alt text + viewport), not comprehensive
    // Reduce score by 20-40 points to reflect incomplete audit
    const incompleteAuditPenalty = comprehensiveChecksPerformed === 0 ? 40 : 20
    score = Math.max(0, score - incompleteAuditPenalty)
  }
  
  // Additional penalty: If score is still 100 but we haven't checked comprehensive factors, cap it
  if (score >= 95 && comprehensiveChecksPerformed < 3) {
    score = Math.min(score, 80) // Cap at 80 if we haven't done comprehensive checks
  }
  
  return Math.max(0, Math.round(score))
}

/**
 * Calculate all category scores
 */
export function calculateAllScores(
  issues: Issue[],
  pages: PageData[],
  siteWide: { robotsTxtExists: boolean; sitemapExists: boolean }
): CategoryScores {
  return {
    technical: calculateTechnicalScore(issues, pages, siteWide),
    onPage: calculateOnPageScore(issues, pages),
    content: calculateContentScore(issues, pages),
    accessibility: calculateAccessibilityScore(issues, pages),
    performance: calculatePerformanceScore(issues, pages)
  }
}

/**
 * Calculate overall SEO score (weighted average)
 * Updated weights per Agency tier requirements:
 * - Technical: 35%
 * - On-Page: 25%
 * - Content: 25%
 * - Accessibility: 15%
 */
export function calculateOverallScore(categoryScores: CategoryScores): number {
  const weights = {
    technical: 0.35,  // Updated from 0.25
    onPage: 0.25,     // Same
    content: 0.25,     // Updated from 0.20
    performance: 0.0,  // Removed from overall (still calculated separately)
    accessibility: 0.15 // Updated from 0.10
  }
  
  // Apply diminishing returns to avoid 0/100 extremes
  const technical = applyDiminishingReturns(categoryScores.technical)
  const onPage = applyDiminishingReturns(categoryScores.onPage)
  const content = applyDiminishingReturns(categoryScores.content)
  const accessibility = applyDiminishingReturns(categoryScores.accessibility)
  
  const overall = 
    technical * weights.technical +
    onPage * weights.onPage +
    content * weights.content +
    accessibility * weights.accessibility
  
  // Ensure score is between 5-95 to avoid extremes
  return Math.max(5, Math.min(95, Math.round(overall)))
}

/**
 * Apply diminishing returns to prevent extreme scores
 * REMOVED: This was causing perfect scores when issues exist
 * Now only applies minimal compression to avoid true 0/100 extremes
 */
function applyDiminishingReturns(score: number): number {
  // Only apply minimal floor/ceiling to avoid true extremes
  // Don't compress valid scores - if there are issues, scores should reflect that
  if (score <= 0) return 5 // Minimum floor (only for true 0)
  if (score >= 100) return 100 // Allow 100 if truly perfect (no issues)
  
  // No compression for scores in the middle range
  // The scoring functions now properly deduct points, so we don't need artificial compression
  return score
}

