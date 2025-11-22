/**
 * Duplicate URL Detection and Cleaning
 * 
 * Identifies duplicate URLs, canonical conflicts, and URL variations
 * that should be consolidated for Agency tier reports
 */

import { PageData } from './types'
import { normalizeUrl, canonicalizeUrl, shouldMergeUrls, getPreferredUrl } from './urlNormalizer'

export interface DuplicateUrlGroup {
  canonical: string // Preferred URL
  duplicates: string[] // All variations of this URL
  type: 'www' | 'trailing-slash' | 'protocol' | 'query-params' | 'case' | 'canonical-conflict'
  recommendation: string
}

export interface DuplicateUrlAnalysis {
  duplicateGroups: DuplicateUrlGroup[]
  totalDuplicates: number
  canonicalConflicts: number
  recommendedCanonicals: Map<string, string> // URL -> preferred canonical
}

/**
 * Analyze pages for duplicate URLs
 */
export function analyzeDuplicateUrls(
  pages: PageData[]
): DuplicateUrlAnalysis {
  const urlGroups = new Map<string, string[]>() // Normalized URL -> all variations
  const canonicalMap = new Map<string, string>() // URL -> declared canonical
  const duplicateGroups: DuplicateUrlGroup[] = []
  
  // Group URLs by their normalized form
  // ENHANCED: Also check for variations (trailing slash, case, params, www, protocol)
  pages.forEach(page => {
    const normalized = normalizeUrl(page.url)
    if (!urlGroups.has(normalized)) {
      urlGroups.set(normalized, [])
    }
    urlGroups.get(normalized)!.push(page.url)
    
    // Also check for common variations
    const variations = [
      page.url,
      page.url.replace(/\/$/, ''), // Without trailing slash
      page.url + '/', // With trailing slash
      page.url.toLowerCase(), // Lowercase
      page.url.replace(/^https?:\/\//, 'https://'), // Force HTTPS
      page.url.replace(/^https?:\/\/(www\.)?/, 'https://'), // Remove www
      page.url.replace(/^https?:\/\//, 'https://www.'), // Add www
      page.url.split('?')[0], // Without query params
    ]
    
    variations.forEach(variation => {
      const varNormalized = normalizeUrl(variation)
      if (varNormalized === normalized && !urlGroups.get(normalized)!.includes(variation)) {
        // This is a variation we should track
        urlGroups.get(normalized)!.push(variation)
      }
    })
    
    // Track declared canonicals
    if (page.canonical) {
      canonicalMap.set(page.url, page.canonical)
    }
  })
  
  // Identify duplicate groups
  urlGroups.forEach((variations, normalized) => {
    if (variations.length > 1) {
      // Determine duplicate type
      let type: DuplicateUrlGroup['type'] = 'query-params'
      if (variations.some(v => v.includes('www.') && variations.some(v2 => !v2.includes('www.')))) {
        type = 'www'
      } else if (variations.some(v => v.endsWith('/') && variations.some(v2 => !v2.endsWith('/')))) {
        type = 'trailing-slash'
      } else if (variations.some(v => v.startsWith('http://') && variations.some(v2 => v2.startsWith('https://')))) {
        type = 'protocol'
      } else if (variations.some(v => v.toLowerCase() !== v) && variations.some(v2 => v2.toLowerCase() === v2)) {
        type = 'case'
      }
      
      // Determine preferred canonical
      const preferred = getPreferredUrl(variations)
      
      duplicateGroups.push({
        canonical: preferred,
        duplicates: variations.filter(v => v !== preferred),
        type,
        recommendation: generateDuplicateRecommendation(type, preferred, variations)
      })
    }
  })
  
  // Check for canonical conflicts
  let canonicalConflicts = 0
  const recommendedCanonicals = new Map<string, string>()
  
  pages.forEach(page => {
    const declaredCanonical = page.canonical
    const recommendedCanonical = getPreferredUrl([page.url])
    
    if (declaredCanonical && declaredCanonical !== recommendedCanonical) {
      // Check if this is a conflict or intentional
      const normalizedDeclared = normalizeUrl(declaredCanonical)
      const normalizedRecommended = normalizeUrl(recommendedCanonical)
      
      if (normalizedDeclared !== normalizedRecommended) {
        canonicalConflicts++
      }
    }
    
    recommendedCanonicals.set(page.url, recommendedCanonical)
  })
  
  return {
    duplicateGroups,
    totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.duplicates.length, 0),
    canonicalConflicts,
    recommendedCanonicals
  }
}

/**
 * Generate recommendation for duplicate URL group
 */
function generateDuplicateRecommendation(
  type: DuplicateUrlGroup['type'],
  canonical: string,
  variations: string[]
): string {
  switch (type) {
    case 'www':
      return `Consolidate www and non-www versions. Use ${canonical} as canonical and redirect others.`
    case 'trailing-slash':
      return `Choose one URL format (with or without trailing slash). Use ${canonical} as canonical.`
    case 'protocol':
      return `Ensure all URLs use HTTPS. Redirect HTTP to HTTPS version: ${canonical}`
    case 'query-params':
      return `Remove or consolidate query parameters. Use ${canonical} as canonical.`
    case 'case':
      return `URLs are case-sensitive. Standardize to lowercase: ${canonical}`
    case 'canonical-conflict':
      return `Canonical tags conflict. Use ${canonical} as the preferred URL.`
    default:
      return `Consolidate duplicate URLs to ${canonical}`
  }
}

/**
 * Generate duplicate URL issues for audit report
 */
export function generateDuplicateUrlIssues(
  analysis: DuplicateUrlAnalysis
): Array<{ message: string; severity: 'High' | 'Medium' | 'Low'; details: string }> {
  const issues: Array<{ message: string; severity: 'High' | 'Medium' | 'Low'; details: string }> = []
  
  if (analysis.duplicateGroups.length > 0) {
    issues.push({
      message: `Found ${analysis.totalDuplicates} duplicate URL variations`,
      severity: 'High',
      details: `${analysis.duplicateGroups.length} groups of duplicate URLs detected. ` +
        `These should be consolidated using canonical tags and redirects.`
    })
  }
  
  if (analysis.canonicalConflicts > 0) {
    issues.push({
      message: `Found ${analysis.canonicalConflicts} canonical tag conflicts`,
      severity: 'High',
      details: `Some pages have canonical tags pointing to different URLs than recommended. ` +
        `This can confuse search engines about which URL is preferred.`
    })
  }
  
  return issues
}

