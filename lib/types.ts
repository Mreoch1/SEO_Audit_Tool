/**
 * Core types for SEO audit system
 */

import { PageSpeedData } from './pagespeed'

// Simplified PageSpeedData structure (used after validation)
export interface SimplifiedPageSpeedData {
  lcp?: number
  fcp?: number
  cls?: number
  ttfb?: number
}

export type IssueCategory = 
  | "Technical" 
  | "On-page" 
  | "Content" 
  | "Accessibility" 
  | "Performance"

export type IssueSeverity = "High" | "Medium" | "Low"

export interface Issue {
  id?: string // Unique identifier for the issue
  category: IssueCategory
  severity: IssueSeverity
  message: string
  details?: string
  affectedPages?: string[]
  fixInstructions?: string // Step-by-step fix instructions
  priority?: number // 1-10 priority score for sorting
}

export interface PageData {
  url: string
  statusCode: number
  loadTime: number
  contentType: string
  title?: string
  titleLength?: number
  metaDescription?: string
  metaDescriptionLength?: number
  canonical?: string
  h1Count: number
  h1Text?: string[]
  h2Count: number
  wordCount: number
  imageCount: number
  missingAltCount: number
  internalLinkCount: number
  externalLinkCount: number
  internalLinks?: string[] // Array of actual internal link URLs (for link graph analysis)
  hasNoindex: boolean
  hasNofollow: boolean
  hasViewport: boolean
  hasSchemaMarkup: boolean
  schemaTypes?: string[]
  schemaAnalysis?: {
    hasIdentitySchema: boolean
    identityType?: 'Organization' | 'Person'
    missingFields?: string[]
  }
  extractedKeywords?: string[]
  performanceMetrics?: {
    lcp?: number
    fid?: number
    cls?: number
    tbt?: number
    fcp?: number
    ttfb?: number
  }
  llmReadability?: {
    renderingPercentage: number
    similarity?: number // Similarity percentage between initial and rendered HTML
    initialHtmlLength: number
    renderedHtmlLength: number
    hasHighRendering: boolean
    hydrationIssues?: {
      hasHydrationMismatch: boolean
      missingContentWithJSDisabled: boolean
      criticalContentMissing: string[]
    }
    shadowDOMAnalysis?: {
      hasShadowDOM: boolean
      shadowRootCount: number
      recommendations: string[]
    }
    scriptBundleAnalysis?: {
      totalScriptSize: number
      largeBundles: Array<{ src?: string; size: number; inline: boolean }>
      renderBlockingScripts: number
      recommendations: string[]
    }
    preRenderedVsPostRendered?: {
      h1InInitial: boolean
      h1InRendered: boolean
      mainContentInInitial: boolean
      mainContentInRendered: boolean
      navigationInInitial: boolean
      navigationInRendered: boolean
    }
    contentAnalysis?: {
      textContentInInitial: number
      textContentInRendered: number
      criticalElementsMissing: string[]
      recommendations: string[]
    }
  }
  readability?: {
    fleschScore: number
    averageSentenceLength?: number
  }
  httpVersion?: 'http/1.1' | 'http/2' | 'http/3' | 'unknown'
  compression?: {
    gzip: boolean
    brotli: boolean
    uncompressedSize?: number
    compressedSize?: number
    savingsPercent?: number
  }
  pageSpeedData?: PageSpeedData | SimplifiedPageSpeedData
  error?: string
}

import { SocialMediaData } from './social'

export interface SiteWideData {
  robotsTxtExists: boolean
  robotsTxtReachable: boolean
  sitemapExists: boolean
  sitemapReachable: boolean
  duplicateTitles: string[]
  duplicateMetaDescriptions: string[]
  brokenPages: string[]
  socialMedia?: SocialMediaData
}

export interface ImageAltAnalysis {
  url: string
  imageUrl?: string
  currentAlt?: string
  recommendation?: string
  issue?: 'missing' | 'too-short' | 'too-long' | 'generic' | 'good'
}

export interface CompetitorData {
  url: string
  keywords: string[]
  title?: string
  metaDescription?: string
  pageCount?: number
  authoritySignals?: {
    backlinks?: number
    domainAge?: number
    socialShares?: number
    hubPages?: number
    avgInternalLinks?: number
    maxDepth?: number
  }
}

export interface CompetitorAnalysis {
  competitorUrl: string // Primary competitor (for backward compatibility)
  competitorKeywords: string[]
  keywordGaps: string[]
  sharedKeywords: string[]
  detectedIndustry?: string // Auto-detected industry category
  industryConfidence?: number // Confidence score (0-1)
  allCompetitors?: string[] // All detected competitors (not just the one analyzed)
  // NEW: Track which competitors were auto-detected vs user-provided
  autoDetectedCompetitors?: string[] // URLs that were auto-detected
  userProvidedCompetitors?: string[] // URLs that were user-provided
  // NEW: Agency tier - multiple competitor crawls
  competitorCrawls?: CompetitorData[] // Full data for all crawled competitors (up to 3 for Agency)
  crawlSummary?: {
    totalCompetitorsAnalyzed: number
    totalPagesCrawled: number
    averagePageCount: number
    siteStructureComparison?: {
      competitor: string
      pageCount: number
      avgWordCount: number
      schemaTypes: string[]
      maxDepth: number
    }[]
  }
}

// Import CrawlDiagnostics and LocalSEOAnalysis types
import { CrawlDiagnostics } from './crawlDiagnostics'
import { LocalSEOAnalysis } from './localSEO'

export interface AuditResult {
  summary: {
    totalPages: number // Valid pages only (for SEO analysis)
    totalPagesCrawled?: number // NEW: Total pages including errors
    errorPages?: number // NEW: Number of error pages
    overallScore: number
    technicalScore: number
    onPageScore: number
    contentScore: number
    accessibilityScore: number
    highSeverityIssues: number
    mediumSeverityIssues: number
    lowSeverityIssues: number
    extractedKeywords?: string[]
  }
  technicalIssues: Issue[]
  onPageIssues: Issue[]
  contentIssues: Issue[]
  accessibilityIssues: Issue[]
  performanceIssues: Issue[]
  pages: PageData[] // Valid pages only
  allPages?: PageData[] // NEW: All pages including errors (for page-level table)
  siteWide: SiteWideData
  imageAltAnalysis?: ImageAltAnalysis[]
  competitorAnalysis?: CompetitorAnalysis
  crawlDiagnostics?: CrawlDiagnostics // NEW: Crawl diagnostics
  localSEO?: LocalSEOAnalysis // NEW: Local SEO analysis
  enhancedTechnical?: import('./enhancedTechnical').EnhancedTechnicalData // NEW: Enhanced technical SEO data
  mobileResponsiveness?: {
    hasViewport: boolean
    responsiveDesign: boolean
    mobileFriendly: boolean
    touchTargets: boolean
    fontSizing: boolean
  }
  serverTechnology?: {
    server: string
    cms: string
    framework: string
    cdn: string
  }
  // NEW: Agency tier - Internal link graph and duplicate URL analysis
  internalLinkGraph?: import('./internalLinkGraph').InternalLinkGraph
  duplicateUrlAnalysis?: import('./duplicateUrlCleaner').DuplicateUrlAnalysis
  raw: {
    startTime: number
    endTime: number
    crawlDuration: number
    options: {
      maxPages: number
      maxDepth: number
      userAgent: string
      tier?: AuditTier
      addOns?: AuditAddOns
    }
  }
}

export type AuditTier = 'starter' | 'standard' | 'professional' | 'agency'

export type AuditAddOn = 
  | 'blankReport' // Unbranded/white-label report
  | 'additionalPages' // Additional pages (per 50)
  | 'additionalKeywords' // Extra keywords (per keyword)
  | 'competitorAnalysis' // Competitor gap analysis
  | 'schemaDeepDive' // Schema deep-dive analysis
  | 'additionalCompetitors' // Additional competitor crawls (Agency tier)
  | 'extraCrawlDepth' // Extra crawl depth (Agency tier)

export interface AuditAddOns {
  blankReport?: boolean // Unbranded/white-label report ($10, free for Agency)
  additionalPages?: number // Number of additional pages (per 50 pages, $5 per 50)
  additionalKeywords?: number // Number of additional keywords ($1 each)
  competitorAnalysis?: boolean // Competitor keyword gap analysis ($15)
  schemaDeepDive?: boolean // Schema deep-dive analysis ($15, Starter tier)
  additionalCompetitors?: number // Additional competitor crawls ($10 each, Agency tier)
  extraCrawlDepth?: boolean // Extra crawl depth (+$15, Agency tier)
  expedited?: boolean // 24-hour expedited delivery (+$15, all tiers)
}

export interface AuditOptions {
  maxPages?: number
  maxDepth?: number
  userAgent?: string
  tier?: AuditTier
  addOns?: AuditAddOns
  competitorUrls?: string[] // URLs of competitor sites to analyze
}

