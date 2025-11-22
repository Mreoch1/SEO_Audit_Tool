/**
 * Real Competitor Analysis
 * 
 * Fetches and analyzes actual competitor URLs to find keyword gaps,
 * instead of using synthetic pattern-based keywords
 */

import { extractTitle, extractMetaDescription } from './titleMetaExtractor'

export interface CompetitorKeywordData {
  url: string
  keywords: string[]
  title?: string
  metaDescription?: string
  h1s: string[]
  extractedPhrases: string[]
}

export interface KeywordGap {
  keyword: string
  foundOn: string[] // URLs where this keyword appears
  frequency: number
}

/**
 * Analyze a single competitor URL
 */
export async function analyzeCompetitorUrl(
  url: string,
  userAgent: string
): Promise<CompetitorKeywordData | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': userAgent }
    })
    
    if (!response.ok) {
      console.warn(`[Competitor] Failed to fetch ${url}: ${response.status}`)
      return null
    }
    
    const html = await response.text()
    
    // Extract basic SEO elements
    const titleData = extractTitle(html)
    const metaData = extractMetaDescription(html)
    const h1s = extractH1Tags(html)
    
    // Extract keywords from title, meta, H1s, and body
    const keywords = extractKeywordsFromCompetitor(html, titleData?.title, metaData?.description, h1s)
    
    return {
      url,
      keywords,
      title: titleData?.title,
      metaDescription: metaData?.description,
      h1s,
      extractedPhrases: keywords
    }
  } catch (error) {
    console.warn(`[Competitor] Error analyzing ${url}:`, error)
    return null
  }
}

/**
 * Extract H1 tags from HTML
 */
function extractH1Tags(html: string): string[] {
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  
  const h1Matches = cleanHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || []
  return h1Matches
    .map(m => m.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
}

/**
 * Extract H2 tags from HTML
 */
function extractH2Tags(html: string): string[] {
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  
  const h2Matches = cleanHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || []
  return h2Matches
    .map(m => m.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
    .slice(0, 10) // Limit to first 10 H2s
}

/**
 * Extract meaningful keyword phrases from competitor HTML
 */
function extractKeywordsFromCompetitor(
  html: string,
  title?: string,
  metaDescription?: string,
  h1s?: string[]
): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'your', 'our', 'their', 'its', 'his', 'her', 'them', 'they', 'we', 'you', 'it', 'he', 'she'
  ])
  
  const keywords = new Set<string>()
  
  // Extract from title
  if (title) {
    extractPhrasesFromText(title, stopWords).forEach(p => keywords.add(p))
  }
  
  // Extract from meta description
  if (metaDescription) {
    extractPhrasesFromText(metaDescription, stopWords).forEach(p => keywords.add(p))
  }
  
  // Extract from H1s
  if (h1s) {
    h1s.forEach(h1 => {
      extractPhrasesFromText(h1, stopWords).forEach(p => keywords.add(p))
    })
  }
  
  // Extract from H2s
  const h2s = extractH2Tags(html)
  h2s.forEach(h2 => {
    extractPhrasesFromText(h2, stopWords).forEach(p => keywords.add(p))
  })
  
  // Extract from first few paragraphs
  const paragraphs = extractFirstParagraphs(html, 5)
  paragraphs.forEach(p => {
    extractPhrasesFromText(p, stopWords).forEach(phrase => keywords.add(phrase))
  })
  
  return Array.from(keywords).slice(0, 50) // Limit to 50 most prominent
}

/**
 * Extract meaningful 2-3 word phrases from text
 */
function extractPhrasesFromText(text: string, stopWords: Set<string>): string[] {
  const phrases: string[] = []
  
  // Normalize text
  const normalized = text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  const words = normalized
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
  
  // Extract 2-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`
    if (phrase.length >= 6 && phrase.length <= 40) {
      phrases.push(phrase)
    }
  }
  
  // Extract 3-word phrases
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
    if (phrase.length >= 10 && phrase.length <= 50) {
      phrases.push(phrase)
    }
  }
  
  return phrases
}

/**
 * Extract first N paragraphs from HTML
 */
function extractFirstParagraphs(html: string, count: number): string[] {
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  
  const pMatches = cleanHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
  return pMatches
    .map(m => m.replace(/<[^>]+>/g, '').trim())
    .filter(p => p.length > 50) // Only substantial paragraphs
    .slice(0, count)
}

/**
 * Analyze multiple competitors and find keyword gaps
 */
export async function analyzeCompetitors(
  competitorUrls: string[],
  siteKeywords: string[],
  userAgent: string
): Promise<{
  competitorData: CompetitorKeywordData[]
  keywordGaps: KeywordGap[]
}> {
  console.log(`[Competitor] Analyzing ${competitorUrls.length} competitor URLs...`)
  
  // Fetch all competitors in parallel (with limit)
  const batchSize = 3 // Process 3 at a time to avoid overwhelming
  const competitorData: CompetitorKeywordData[] = []
  
  for (let i = 0; i < competitorUrls.length; i += batchSize) {
    const batch = competitorUrls.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(url => analyzeCompetitorUrl(url, userAgent))
    )
    competitorData.push(...results.filter((r): r is CompetitorKeywordData => r !== null))
  }
  
  console.log(`[Competitor] Successfully analyzed ${competitorData.length} competitors`)
  
  // Build keyword frequency map across all competitors
  const keywordFrequency = new Map<string, { count: number; urls: Set<string> }>()
  
  competitorData.forEach(comp => {
    comp.keywords.forEach(keyword => {
      const existing = keywordFrequency.get(keyword)
      if (existing) {
        existing.count++
        existing.urls.add(comp.url)
      } else {
        keywordFrequency.set(keyword, { count: 1, urls: new Set([comp.url]) })
      }
    })
  })
  
  // Find gaps: keywords in competitors but not in site
  const siteKeywordSet = new Set(siteKeywords.map(k => k.toLowerCase()))
  const gaps: KeywordGap[] = []
  
  keywordFrequency.forEach((data, keyword) => {
    const keywordLower = keyword.toLowerCase()
    
    // Check if this keyword (or close variant) exists in site keywords
    const existsInSite = Array.from(siteKeywordSet).some(sk => {
      return sk === keywordLower ||
        sk.includes(keywordLower) ||
        keywordLower.includes(sk)
    })
    
    if (!existsInSite && data.count >= 2) { // Must appear in at least 2 competitors
      gaps.push({
        keyword,
        foundOn: Array.from(data.urls),
        frequency: data.count
      })
    }
  })
  
  // Sort gaps by frequency (most common first)
  gaps.sort((a, b) => b.frequency - a.frequency)
  
  return {
    competitorData,
    keywordGaps: gaps.slice(0, 30) // Top 30 gaps
  }
}

/**
 * Generate fallback keyword suggestions if no competitors provided
 * (Uses pattern-based approach only as fallback)
 */
export function generateFallbackKeywordSuggestions(
  siteKeywords: string[]
): string[] {
  // Only use generic high-value patterns as fallback
  const fallbackPatterns = [
    'best practices',
    'how to guide',
    'getting started',
    'tutorial',
    'complete guide',
    'tips and tricks'
  ]
  
  // Extract core topics from site keywords
  const coreTopics = new Set<string>()
  siteKeywords.forEach(kw => {
    const words = kw.toLowerCase().split(/\s+/)
    if (words.length >= 2) {
      coreTopics.add(words.slice(0, 2).join(' '))
    }
  })
  
  const suggestions: string[] = []
  
  // Combine core topics with fallback patterns (limited to 10)
  Array.from(coreTopics).slice(0, 3).forEach(topic => {
    fallbackPatterns.slice(0, 3).forEach(pattern => {
      suggestions.push(`${topic} ${pattern}`)
    })
  })
  
  return suggestions.slice(0, 10)
}

