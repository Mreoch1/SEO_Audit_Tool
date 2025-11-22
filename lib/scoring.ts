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
 */
export function calculateTechnicalScore(
  issues: Issue[],
  pages: PageData[],
  siteWide: { robotsTxtExists: boolean; sitemapExists: boolean },
  weights = DEFAULT_WEIGHTS.technical
): number {
  let score = 100
  
  // Security headers (-20 points max)
  const securityIssues = issues.filter(i => 
    i.category === 'technical' && 
    (i.type.includes('header') || i.type.includes('csp') || i.type.includes('security'))
  )
  score -= Math.min(weights.securityHeaders, securityIssues.length * 4)
  
  // HTTPS/redirects (-15 points max)
  const httpsIssues = issues.filter(i => 
    i.category === 'technical' && 
    (i.type.includes('https') || i.type.includes('redirect'))
  )
  score -= Math.min(weights.httpsRedirects, httpsIssues.length * 5)
  
  // Mixed content (-20 points max)
  const mixedContentIssues = issues.filter(i => 
    i.category === 'technical' && i.type.includes('mixed-content')
  )
  score -= Math.min(weights.mixedContent, mixedContentIssues.length * 10)
  
  // Robots.txt (-10 points if missing or unreachable)
  if (!siteWide.robotsTxtExists) {
    score -= weights.robotsTxt
  }
  
  // Sitemap (-10 points if missing)
  if (!siteWide.sitemapExists) {
    score -= weights.sitemap
  }
  
  // Schema issues (-15 points max)
  const schemaIssues = issues.filter(i => 
    i.category === 'technical' && i.type.includes('schema')
  )
  score -= Math.min(weights.schema, schemaIssues.length * 3)
  
  // Canonical issues (-10 points max)
  const canonicalIssues = issues.filter(i => 
    i.category === 'technical' && i.type.includes('canonical')
  )
  score -= Math.min(weights.canonicals, canonicalIssues.length * 5)
  
  return Math.max(0, Math.round(score))
}

/**
 * Calculate On-Page score
 */
export function calculateOnPageScore(
  issues: Issue[],
  pages: PageData[],
  weights = DEFAULT_WEIGHTS.onPage
): number {
  let score = 100
  
  // Title issues (-25 points max)
  const titleIssues = issues.filter(i => 
    i.category === 'on-page' && i.type.includes('title')
  )
  titleIssues.forEach(issue => {
    if (issue.severity === 'high') score -= 5
    else if (issue.severity === 'medium') score -= 2
    else score -= 1
  })
  score = Math.max(score, 100 - weights.titleQuality)
  
  // Meta description issues (-20 points max)
  const metaIssues = issues.filter(i => 
    i.category === 'on-page' && i.type.includes('meta')
  )
  metaIssues.forEach(issue => {
    if (issue.severity === 'high') score -= 4
    else if (issue.severity === 'medium') score -= 2
    else score -= 1
  })
  score = Math.max(score, 100 - weights.titleQuality - weights.metaDescription)
  
  // Heading structure issues (-15 points max)
  const headingIssues = issues.filter(i => 
    i.category === 'on-page' && (i.type.includes('h1') || i.type.includes('heading'))
  )
  score -= Math.min(weights.headingStructure, headingIssues.length * 3)
  
  // Internal linking issues (-15 points max)
  const linkIssues = issues.filter(i => 
    i.category === 'on-page' && i.type.includes('internal-link')
  )
  score -= Math.min(weights.internalLinking, linkIssues.length * 2)
  
  // Duplicate content (-15 points max)
  const duplicateIssues = issues.filter(i => 
    i.category === 'on-page' && i.type.includes('duplicate')
  )
  score -= Math.min(weights.duplicateContent, duplicateIssues.length * 5)
  
  // URL structure (-10 points max)
  const urlIssues = issues.filter(i => 
    i.category === 'on-page' && i.type.includes('url')
  )
  score -= Math.min(weights.urlStructure, urlIssues.length * 2)
  
  return Math.max(0, Math.round(score))
}

/**
 * Calculate Content score with readability integration
 */
export function calculateContentScore(
  issues: Issue[],
  pages: PageData[],
  weights = DEFAULT_WEIGHTS.content
): number {
  let score = 100
  
  // Content depth subscore (0-25 points)
  const depthSubscore = calculateDepthSubscore(pages)
  const depthPenalty = weights.depth * (1 - depthSubscore / 100)
  score -= depthPenalty
  
  // Readability subscore (0-30 points) - CRITICAL FIX
  const readabilitySubscore = calculateReadabilitySubscore(pages)
  const readabilityPenalty = weights.readability * (1 - readabilitySubscore / 100)
  score -= readabilityPenalty
  
  // Thin content penalty (-20 points max)
  const thinContentIssues = issues.filter(i => 
    i.category === 'content' && i.type.includes('thin-content')
  )
  score -= Math.min(weights.thinContent, thinContentIssues.length * 4)
  
  // Freshness (if we can detect dates) - currently neutral
  // Could integrate publication dates if available
  
  // Keyword usage
  const keywordIssues = issues.filter(i => 
    i.category === 'content' && i.type.includes('keyword')
  )
  score -= Math.min(weights.keywordUsage, keywordIssues.length * 2)
  
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
    i.category === 'performance' && (i.type.includes('size') || i.type.includes('image'))
  )
  score -= Math.min(weights.pageSize, sizeIssues.length * 4)
  
  // Compression issues (-15 points max)
  const compressionIssues = issues.filter(i => 
    i.category === 'performance' && i.type.includes('compression')
  )
  score -= Math.min(weights.compression, compressionIssues.length * 7.5)
  
  // Caching issues (-15 points max)
  const cacheIssues = issues.filter(i => 
    i.category === 'performance' && i.type.includes('cache')
  )
  score -= Math.min(weights.caching, cacheIssues.length * 5)
  
  return Math.max(0, Math.round(score))
}

/**
 * Calculate Core Web Vitals subscore with LCP validation
 * CRITICAL FIX: Clamp invalid metrics
 */
function calculateCoreWebVitalsSubscore(pages: PageData[]): number {
  const mainPage = pages.find(p => p.pageSpeedData) || pages[0]
  if (!mainPage?.pageSpeedData) return 70 // Neutral if no data
  
  const { lcp, fcp, cls, ttfb } = mainPage.pageSpeedData
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
 */
export function calculateAccessibilityScore(
  issues: Issue[],
  pages: PageData[],
  weights = DEFAULT_WEIGHTS.accessibility
): number {
  let score = 100
  
  // Alt text issues (-40 points max)
  const altIssues = issues.filter(i => 
    i.category === 'accessibility' && i.type.includes('alt')
  )
  score -= Math.min(weights.altText, altIssues.length * 8)
  
  // ARIA label issues (-20 points max)
  const ariaIssues = issues.filter(i => 
    i.category === 'accessibility' && i.type.includes('aria')
  )
  score -= Math.min(weights.ariaLabels, ariaIssues.length * 5)
  
  // Color contrast issues (-20 points max)
  const contrastIssues = issues.filter(i => 
    i.category === 'accessibility' && i.type.includes('contrast')
  )
  score -= Math.min(weights.colorContrast, contrastIssues.length * 10)
  
  // Keyboard navigation issues (-20 points max)
  const keyboardIssues = issues.filter(i => 
    i.category === 'accessibility' && i.type.includes('keyboard')
  )
  score -= Math.min(weights.keyboardNav, keyboardIssues.length * 10)
  
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
 * Maps 0-100 to approximately 10-90 range to avoid 0/100 extremes
 */
function applyDiminishingReturns(score: number): number {
  if (score <= 0) return 10 // Minimum floor
  if (score >= 100) return 90 // Maximum ceiling
  
  // Use a sigmoid-like curve to compress extremes
  // Maps 0-100 to approximately 10-90
  const normalized = score / 100
  const compressed = 10 + (normalized * 80) // Scale to 10-90 range
  
  // Add slight curve to further compress extremes
  if (normalized < 0.2) {
    // Very low scores get slight boost
    return Math.max(10, compressed * 1.1)
  } else if (normalized > 0.8) {
    // Very high scores get slight reduction
    return Math.min(90, compressed * 0.95)
  }
  
  return compressed
}

