/**
 * Core types for SEO audit system
 */

export type IssueCategory = 
  | "Technical" 
  | "On-page" 
  | "Content" 
  | "Accessibility" 
  | "Performance"

export type IssueSeverity = "High" | "Medium" | "Low"

export interface Issue {
  category: IssueCategory
  severity: IssueSeverity
  message: string
  details?: string
  affectedPages?: string[]
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
    initialHtmlLength: number
    renderedHtmlLength: number
    hasHighRendering: boolean
  }
  error?: string
}

export interface SiteWideData {
  robotsTxtExists: boolean
  robotsTxtReachable: boolean
  sitemapExists: boolean
  sitemapReachable: boolean
  duplicateTitles: string[]
  duplicateMetaDescriptions: string[]
  brokenPages: string[]
}

export interface ImageAltAnalysis {
  url: string
  imageUrl?: string
  currentAlt?: string
  recommendation?: string
  issue?: 'missing' | 'too-short' | 'too-long' | 'generic' | 'good'
}

export interface CompetitorAnalysis {
  competitorUrl: string
  competitorKeywords: string[]
  keywordGaps: string[]
  sharedKeywords: string[]
}

export interface AuditResult {
  summary: {
    totalPages: number
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
  pages: PageData[]
  siteWide: SiteWideData
  imageAltAnalysis?: ImageAltAnalysis[]
  competitorAnalysis?: CompetitorAnalysis
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

export type AuditTier = 'starter' | 'standard' | 'advanced'

export type AuditAddOn = 
  | 'fastDelivery'
  | 'additionalPages'
  | 'additionalKeywords'
  | 'imageAltTags'
  | 'schemaMarkup'
  | 'competitorAnalysis'

export interface AuditAddOns {
  fastDelivery?: boolean
  additionalPages?: number // Number of additional pages
  additionalKeywords?: number // Number of additional keywords
  imageAltTags?: boolean
  schemaMarkup?: boolean
  competitorAnalysis?: boolean
}

export interface AuditOptions {
  maxPages?: number
  maxDepth?: number
  userAgent?: string
  tier?: AuditTier
  addOns?: AuditAddOns
  competitorUrls?: string[] // URLs of competitor sites to analyze
}

