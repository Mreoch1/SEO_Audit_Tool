import { AuditOptions, AuditTier, PageData, Issue } from './types'
import { normalizeUrl as normalizeUrlNew } from './urlNormalizer'

export const DEFAULT_OPTIONS: Required<Omit<AuditOptions, 'tier' | 'addOns' | 'competitorUrls'>> & Pick<AuditOptions, 'addOns' | 'competitorUrls'> = {
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
export function filterValidPages(pages: PageData[]): {
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
export function deduplicatePages(pages: PageData[]): PageData[] {
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
export function deduplicateIssues(issues: Issue[]): Issue[] {
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
