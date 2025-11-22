/**
 * Keyword Processing Utilities
 * 
 * Provides clean, deduplicated, and professionally formatted keyword extraction
 * for SEO audits and competitor analysis.
 */

// Import HTML entity decoder
import { decode } from 'html-entities'

/**
 * Stop words to filter out from keyword extraction
 */
const STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'your', 'their', 'have', 'been', 'will', 
  'would', 'could', 'should', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 
  'on', 'at', 'to', 'for', 'of', 'as', 'is', 'was', 'are', 'were', 'be',
  'by', 'it', 'its', 'they', 'them', 'we', 'us', 'you', 'he', 'she', 'his',
  'her', 'our', 'my', 'me', 'i', 'am', 'has', 'had', 'do', 'does', 'did',
  'can', 'may', 'might', 'must', 'shall', 'will', 'about', 'into', 'through',
  'over', 'under', 'again', 'then', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'now'
])

/**
 * Generic/low-value words to filter out
 */
const GENERIC_WORDS = new Set([
  'free', 'online', 'best', 'new', 'top', 'get', 'use', 'make', 'find', 'see',
  'more', 'here', 'page', 'site', 'web', 'www', 'com', 'org', 'net', 'gov',
  'edu', 'html', 'http', 'https', 'click', 'learn', 'read', 'view', 'home',
  'main', 'menu', 'search', 'contact', 'about', 'privacy', 'terms', 'copyright',
  'reserved', 'rights', 'inc', 'llc', 'ltd', 'corp', 'company'
])

/**
 * Nonsense patterns to filter out
 */
const NONSENSE_PATTERNS = [
  /^[a-z]\s[a-z]$/i, // Single letter words like "a b"
  /^(lost|found|captain|orbit|space|time)\s+(your|my|their|his|her)\s+/i, // Weird UI fragments
  /^(click|tap|press|swipe)\s+(here|now|button)/i, // UI instructions
  /^(loading|please|wait|error|success|failed)/i, // Status messages
  /^(yes|no|ok|cancel|submit|close|open)/i, // Button text
  /\d{4,}/, // Long numbers (likely IDs or dates)
  /^[^a-z]*$/i, // No letters at all
]

/**
 * Clean and normalize a keyword phrase
 * Sprint 1.4: Added HTML entity decoding to fix garbage text
 */
export function cleanKeyword(keyword: string): string {
  // First decode HTML entities (e.g., &nbsp; → space, &amp; → &)
  let decoded = decode(keyword)
  
  return decoded
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace (including decoded &nbsp;)
    .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
    .replace(/\s*-\s*/g, '-') // Normalize hyphens
}

/**
 * Check if a keyword is valid (not a stop word, generic, or nonsense)
 */
export function isValidKeyword(keyword: string): boolean {
  const cleaned = cleanKeyword(keyword)
  
  // Must have at least 2 words or be a compound word with hyphen
  const words = cleaned.split(/[\s-]+/).filter(w => w.length > 0)
  if (words.length < 2 && !cleaned.includes('-')) {
    return false
  }
  
  // Check for concatenated words (single word that's too long, like "frontiersread")
  // If it's a single word without spaces/hyphens and >12 chars, it's likely concatenated
  if (words.length === 1 && cleaned.length > 12 && !cleaned.includes('-')) {
    return false
  }
  
  // Check if any individual word is suspiciously long (likely concatenated)
  for (const word of words) {
    if (word.length > 15 && !word.includes('-')) {
      // Word is too long and not hyphenated - likely concatenated
      return false
    }
  }
  
  // Check minimum length
  if (cleaned.length < 6) {
    return false
  }
  
  // Check maximum length (avoid overly long phrases)
  if (cleaned.length > 60) {
    return false
  }
  
  // Filter out if all words are stop words
  const meaningfulWords = words.filter(w => !STOP_WORDS.has(w) && !GENERIC_WORDS.has(w))
  if (meaningfulWords.length === 0) {
    return false
  }
  
  // Filter out if it matches nonsense patterns
  for (const pattern of NONSENSE_PATTERNS) {
    if (pattern.test(cleaned)) {
      return false
    }
  }
  
  // Filter out if it has repeated words (e.g., "news news images images")
  const uniqueWords = new Set(words)
  if (uniqueWords.size < words.length * 0.7) {
    // More than 30% repetition
    return false
  }
  
  return true
}

/**
 * Deduplicate and clean a list of keywords
 */
export function deduplicateKeywords(keywords: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  
  for (const kw of keywords) {
    const cleaned = cleanKeyword(kw)
    
    if (!cleaned || !isValidKeyword(cleaned)) {
      continue
    }
    
    // Check for duplicates (case-insensitive)
    if (seen.has(cleaned)) {
      continue
    }
    
    // Check for substring duplicates (e.g., "space exploration" vs "exploration")
    let isDuplicate = false
    for (const existing of seen) {
      if (existing.includes(cleaned) || cleaned.includes(existing)) {
        // Keep the longer one
        if (cleaned.length > existing.length) {
          seen.delete(existing)
          result.splice(result.indexOf(existing), 1)
        } else {
          isDuplicate = true
          break
        }
      }
    }
    
    if (!isDuplicate) {
      seen.add(cleaned)
      result.push(cleaned)
    }
  }
  
  return result
}

/**
 * Group keywords into thematic clusters
 */
export interface KeywordCluster {
  theme: string
  keywords: string[]
}

export function clusterKeywords(keywords: string[]): KeywordCluster[] {
  // Simple clustering based on shared words
  const clusters = new Map<string, Set<string>>()
  
  for (const kw of keywords) {
    const words = cleanKeyword(kw).split(/[\s-]+/)
    const meaningfulWords = words.filter(w => 
      w.length >= 3 && 
      !STOP_WORDS.has(w) && 
      !GENERIC_WORDS.has(w)
    )
    
    if (meaningfulWords.length === 0) continue
    
    // Use the first meaningful word as the cluster key
    const clusterKey = meaningfulWords[0]
    
    if (!clusters.has(clusterKey)) {
      clusters.set(clusterKey, new Set())
    }
    clusters.get(clusterKey)!.add(kw)
  }
  
  // Convert to array and sort by cluster size
  return Array.from(clusters.entries())
    .map(([theme, keywords]) => ({
      theme: theme.charAt(0).toUpperCase() + theme.slice(1), // Capitalize
      keywords: Array.from(keywords).sort()
    }))
    .sort((a, b) => b.keywords.length - a.keywords.length)
}

/**
 * Format keywords for display (remove duplicates, clean, limit)
 */
export function formatKeywordsForDisplay(
  keywords: string[],
  maxKeywords: number = 20
): string[] {
  const cleaned = deduplicateKeywords(keywords)
  
  // Sort by length (longer phrases first, as they're usually more specific)
  const sorted = cleaned.sort((a, b) => {
    const lenDiff = b.length - a.length
    if (lenDiff !== 0) return lenDiff
    return a.localeCompare(b)
  })
  
  return sorted.slice(0, maxKeywords)
}

/**
 * Calculate keyword similarity (0-1, where 1 is identical)
 */
export function keywordSimilarity(kw1: string, kw2: string): number {
  const words1 = new Set(cleanKeyword(kw1).split(/[\s-]+/))
  const words2 = new Set(cleanKeyword(kw2).split(/[\s-]+/))
  
  const intersection = new Set([...words1].filter(w => words2.has(w)))
  const union = new Set([...words1, ...words2])
  
  return intersection.size / union.size
}

/**
 * Find keyword gaps (keywords in competitor but not in client)
 */
export function findKeywordGaps(
  clientKeywords: string[],
  competitorKeywords: string[]
): {
  gaps: string[]
  shared: string[]
  unique: string[]
} {
  const clientSet = new Set(clientKeywords.map(cleanKeyword))
  const competitorSet = new Set(competitorKeywords.map(cleanKeyword))
  
  const gaps: string[] = []
  const shared: string[] = []
  const unique: string[] = []
  
  // Find gaps (in competitor but not in client)
  for (const kw of competitorKeywords) {
    const cleaned = cleanKeyword(kw)
    if (!clientSet.has(cleaned)) {
      // Check for partial matches (similar keywords)
      let isSimilar = false
      for (const clientKw of clientKeywords) {
        if (keywordSimilarity(cleaned, clientKw) > 0.6) {
          isSimilar = true
          break
        }
      }
      if (!isSimilar) {
        gaps.push(kw)
      }
    }
  }
  
  // Find shared keywords
  for (const kw of clientKeywords) {
    const cleaned = cleanKeyword(kw)
    if (competitorSet.has(cleaned)) {
      shared.push(kw)
    }
  }
  
  // Find unique (in client but not in competitor)
  for (const kw of clientKeywords) {
    const cleaned = cleanKeyword(kw)
    if (!competitorSet.has(cleaned)) {
      // Check for partial matches
      let isSimilar = false
      for (const compKw of competitorKeywords) {
        if (keywordSimilarity(cleaned, compKw) > 0.6) {
          isSimilar = true
          break
        }
      }
      if (!isSimilar) {
        unique.push(kw)
      }
    }
  }
  
  return {
    gaps: deduplicateKeywords(gaps),
    shared: deduplicateKeywords(shared),
    unique: deduplicateKeywords(unique)
  }
}

