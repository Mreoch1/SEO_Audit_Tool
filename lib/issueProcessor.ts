/**
 * Issue Processing Utilities
 * 
 * Provides intelligent deduplication, consolidation, and formatting
 * for SEO audit issues to create professional, client-ready reports.
 */

import { Issue } from './types'

/**
 * Issue normalization patterns for better deduplication
 */
const ISSUE_PATTERNS = {
  // Title issues
  'title-too-short': /^(Title tag too short|Page title too short)/i,
  'title-too-long': /^(Title tag too long|Page title too long)/i,
  'title-missing': /^(Missing title tag|No title tag|Title tag not found)/i,
  
  // Meta description issues
  'meta-too-short': /^Meta description too short/i,
  'meta-too-long': /^Meta description too long/i,
  'meta-missing': /^(Missing meta description|No meta description)/i,
  'meta-duplicate': /^Duplicate meta description/i,
  
  // Heading issues
  'h1-missing': /^(Missing H1|No H1|H1 tag not found)/i,
  'h1-multiple': /^(Multiple H1|More than one H1)/i,
  'h2-missing': /^(Missing H2|No H2)/i,
  
  // Image issues
  'alt-missing': /^(Missing alt|No alt|Alt attribute missing)/i,
  
  // Schema issues
  'schema-missing': /^(Missing schema|No schema)/i,
  'identity-schema-missing': /^(Missing Identity Schema|No Organization|No Person)/i,
  
  // Technical issues
  'mixed-content': /^Mixed content/i,
  'no-compression': /^(No compression|Compression not enabled)/i,
  'canonical-missing': /^(Missing canonical|No canonical)/i,
  
  // Performance issues
  'lcp-slow': /^(LCP|Largest Contentful Paint)/i,
  'tbt-high': /^(TBT|Total Blocking Time)/i,
  'fcp-slow': /^(FCP|First Contentful Paint)/i,
  
  // Content issues
  'readability-poor': /^(Content is|Readability|Reading ease)/i,
  'content-thin': /^(Content|Page has|Word count)/i,
  'sentences-long': /^Sentences are too long/i,
}

/**
 * Normalize issue message to a canonical form
 */
function normalizeIssueMessage(message: string): string {
  for (const [key, pattern] of Object.entries(ISSUE_PATTERNS)) {
    if (pattern.test(message)) {
      return key
    }
  }
  return message.toLowerCase().trim()
}

/**
 * Group issues by normalized type
 */
export interface IssueGroup {
  type: string
  severity: string
  category: string
  message: string
  details?: string
  affectedPages: string[]
  count: number
  fixInstructions?: string
  priority?: number
}

export function groupIssues(issues: Issue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>()
  
  for (const issue of issues) {
    const normalizedType = normalizeIssueMessage(issue.message)
    const key = `${issue.category}|${issue.severity}|${normalizedType}`
    
    if (groups.has(key)) {
      const group = groups.get(key)!
      // Add affected pages
      if (issue.affectedPages) {
        group.affectedPages.push(...issue.affectedPages)
      }
      group.count++
    } else {
      groups.set(key, {
        type: normalizedType,
        severity: issue.severity,
        category: issue.category,
        message: issue.message,
        details: issue.details,
        affectedPages: issue.affectedPages || [],
        count: 1,
        fixInstructions: issue.fixInstructions,
        priority: issue.priority
      })
    }
  }
  
  // Deduplicate affected pages within each group
  for (const group of groups.values()) {
    group.affectedPages = Array.from(new Set(group.affectedPages))
  }
  
  return Array.from(groups.values())
}

/**
 * Sort issues by priority (severity + count)
 */
export function sortIssuesByPriority(groups: IssueGroup[]): IssueGroup[] {
  const severityWeight = {
    'High': 100,
    'Medium': 50,
    'Low': 10
  }
  
  return groups.sort((a, b) => {
    const aWeight = (severityWeight[a.severity as keyof typeof severityWeight] || 0) + a.count
    const bWeight = (severityWeight[b.severity as keyof typeof severityWeight] || 0) + b.count
    return bWeight - aWeight
  })
}

/**
 * Format issue details with specific values (e.g., character counts)
 */
export function formatIssueDetails(issue: Issue): string {
  if (!issue.details) return ''
  
  // Extract numeric values from details
  const charMatch = issue.details.match(/(\d+)\s*characters?/i)
  const wordMatch = issue.details.match(/(\d+)\s*words?/i)
  const scoreMatch = issue.details.match(/score:?\s*(\d+)/i)
  
  let formatted = issue.details
  
  // Add specific recommendations based on the issue type
  if (issue.message.toLowerCase().includes('title') && charMatch) {
    const chars = parseInt(charMatch[1])
    if (chars < 50) {
      formatted += ` (recommended: 50-60 characters)`
    } else if (chars > 60) {
      formatted += ` (recommended: 50-60 characters)`
    }
  }
  
  if (issue.message.toLowerCase().includes('meta description') && charMatch) {
    const chars = parseInt(charMatch[1])
    if (chars < 120) {
      formatted += ` (recommended: 120-160 characters)`
    } else if (chars > 160) {
      formatted += ` (recommended: 120-160 characters)`
    }
  }
  
  if (issue.message.toLowerCase().includes('readability') && scoreMatch) {
    const score = parseInt(scoreMatch[1])
    if (score < 60) {
      formatted += ` (aim for 60+ for general audiences)`
    }
  }
  
  return formatted
}

/**
 * Create a consolidated fix instruction for a group of similar issues
 */
export function consolidateFixInstructions(group: IssueGroup): string {
  if (!group.fixInstructions) {
    return 'Review the issue details and implement the recommended changes.'
  }
  
  // If the group has multiple affected pages, add a note about applying to all
  if (group.affectedPages.length > 1) {
    return `${group.fixInstructions}\n\nApply these fixes to all ${group.affectedPages.length} affected pages.`
  }
  
  return group.fixInstructions
}

/**
 * Generate a summary of issues for executive reporting
 */
export interface IssueSummary {
  totalIssues: number
  highPriority: number
  mediumPriority: number
  lowPriority: number
  topIssues: Array<{
    message: string
    severity: string
    count: number
  }>
  categoryCounts: Record<string, number>
}

export function generateIssueSummary(issues: Issue[]): IssueSummary {
  const groups = groupIssues(issues)
  const sorted = sortIssuesByPriority(groups)
  
  const categoryCounts: Record<string, number> = {}
  for (const group of groups) {
    categoryCounts[group.category] = (categoryCounts[group.category] || 0) + group.count
  }
  
  return {
    totalIssues: issues.length,
    highPriority: issues.filter(i => i.severity === 'High').length,
    mediumPriority: issues.filter(i => i.severity === 'Medium').length,
    lowPriority: issues.filter(i => i.severity === 'Low').length,
    topIssues: sorted.slice(0, 10).map(g => ({
      message: g.message,
      severity: g.severity,
      count: g.count
    })),
    categoryCounts
  }
}

/**
 * Format performance metrics with better context
 */
export interface PerformanceContext {
  metric: string
  value: number
  unit: string
  rating: 'good' | 'needs-improvement' | 'poor'
  context: string
  isLabData?: boolean
}

export function formatPerformanceMetric(
  metric: string,
  value: number,
  unit: string,
  isLabData: boolean = false
): PerformanceContext {
  let rating: 'good' | 'needs-improvement' | 'poor' = 'good'
  let context = ''
  
  switch (metric.toUpperCase()) {
    case 'LCP':
      if (value > 4000) {
        rating = 'poor'
        context = 'Most users will experience a very slow page load. The main content takes too long to appear.'
      } else if (value > 2500) {
        rating = 'needs-improvement'
        context = 'Some users may experience slow page loads. Consider optimizing images and reducing render-blocking resources.'
      } else {
        rating = 'good'
        context = 'Main content loads quickly for most users.'
      }
      break
      
    case 'TBT':
      if (value > 600) {
        rating = 'poor'
        context = 'The page is unresponsive for too long. Break up long JavaScript tasks and defer non-critical scripts.'
      } else if (value > 300) {
        rating = 'needs-improvement'
        context = 'Some delay in page responsiveness. Consider code splitting and optimizing JavaScript execution.'
      } else {
        rating = 'good'
        context = 'Page remains responsive during load.'
      }
      break
      
    case 'FCP':
      if (value > 3000) {
        rating = 'poor'
        context = 'First visual content appears too slowly. Optimize critical rendering path and reduce server response time.'
      } else if (value > 1800) {
        rating = 'needs-improvement'
        context = 'First content could appear faster. Consider inlining critical CSS and optimizing fonts.'
      } else {
        rating = 'good'
        context = 'First content appears quickly.'
      }
      break
      
    case 'CLS':
      if (value > 0.25) {
        rating = 'poor'
        context = 'Significant layout shifts occur. Reserve space for images and ads, and avoid inserting content above existing content.'
      } else if (value > 0.1) {
        rating = 'needs-improvement'
        context = 'Some layout shifts detected. Ensure all images and embeds have dimensions specified.'
      } else {
        rating = 'good'
        context = 'Minimal layout shifts.'
      }
      break
      
    case 'TTFB':
      if (value > 800) {
        rating = 'poor'
        context = 'Server response is very slow. Optimize server-side processing, use a CDN, and enable caching.'
      } else if (value > 600) {
        rating = 'needs-improvement'
        context = 'Server response could be faster. Consider server-side optimizations and caching strategies.'
      } else {
        rating = 'good'
        context = 'Server responds quickly.'
      }
      break
  }
  
  if (isLabData) {
    context += ' (Lab data - simulated under controlled conditions. Real user experience may vary.)'
  }
  
  return {
    metric,
    value,
    unit,
    rating,
    context,
    isLabData
  }
}

