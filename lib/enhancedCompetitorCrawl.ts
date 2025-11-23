/**
 * Enhanced Competitor Crawling for Agency Tier
 * 
 * Performs full multi-page crawls of competitor sites to provide
 * comprehensive comparison data including site structure, keywords,
 * schema, performance, and internal linking.
 */

import { extractTitle, extractMetaDescription } from './titleMetaExtractor'
import { analyzeSchema } from './schemaAnalyzer'
import { isInternalLink } from './urlNormalizer'
import { normalizeUrl } from './urlNormalizer'

export interface CompetitorCrawlData {
  url: string
  pages: CompetitorPageData[]
  totalPages: number
  avgWordCount: number
  schemaTypes: string[]
  keywords: string[]
  sharedKeywords: string[]
  keywordGaps: string[]
  siteStructure: {
    maxDepth: number
    avgInternalLinks: number
    hubPages: number
  }
  performance: {
    avgLoadTime: number
    fastPages: number
    slowPages: number
  }
  localSEO: {
    hasNAP: boolean
    hasLocalSchema: boolean
    hasGBP: boolean
  }
}

export interface CompetitorPageData {
  url: string
  title?: string
  metaDescription?: string
  h1?: string
  wordCount: number
  internalLinkCount: number
  schemaTypes: string[]
  loadTime: number
  statusCode: number
}

/**
 * Crawl a competitor site (up to maxPages pages)
 */
export async function crawlCompetitorSite(
  rootUrl: string,
  maxPages: number = 20,
  maxDepth: number = 3,
  userAgent: string
): Promise<CompetitorCrawlData | null> {
  console.log(`[Competitor Crawl] Starting crawl of ${rootUrl} (max ${maxPages} pages, depth ${maxDepth})`)
  
  try {
    const crawledUrls = new Set<string>()
    const pages: CompetitorPageData[] = []
    const queue: Array<{ url: string; depth: number }> = [{ url: rootUrl, depth: 0 }]
    const allKeywords = new Set<string>()
    const allSchemaTypes = new Set<string>()
    let totalWordCount = 0
    let totalLoadTime = 0
    let totalInternalLinks = 0
    let hasNAP = false
    let hasLocalSchema = false
    let hasGBP = false
    
    while (queue.length > 0 && pages.length < maxPages) {
      const { url, depth } = queue.shift()!
      
      if (crawledUrls.has(url) || depth > maxDepth) {
        continue
      }
      
      crawledUrls.add(url)
      
      try {
        const startTime = Date.now()
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': userAgent }
        })
        
        if (!response.ok) {
          continue
        }
        
        const html = await response.text()
        const loadTime = Date.now() - startTime
        totalLoadTime += loadTime
        
        // Extract basic data
        const titleData = extractTitle(html)
        const metaData = extractMetaDescription(html)
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
        const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : undefined
        
        // Word count
        const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length
        totalWordCount += wordCount
        
        // Extract keywords
        const keywords = extractKeywordsFromPage(html, titleData?.title, metaData?.description, h1)
        keywords.forEach(k => allKeywords.add(k))
        
        // Schema analysis
        const schemaAnalysis = analyzeSchema(html, url)
        schemaAnalysis.schemaTypes.forEach(t => allSchemaTypes.add(t))
        if (schemaAnalysis.schemaTypes.some(t => t.includes('LocalBusiness') || t.includes('Organization'))) {
          hasLocalSchema = true
        }
        
        // Check for NAP (Name, Address, Phone)
        const hasPhone = /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(html)
        const hasAddress = /(street|avenue|road|drive|boulevard|lane|way|city|state|zip|postal)/i.test(html)
        if (hasPhone && hasAddress) {
          hasNAP = true
        }
        
        // Check for Google Business Profile indicators
        if (/google.*business|google.*my.*business|gbp|google.*maps.*embed/i.test(html)) {
          hasGBP = true
        }
        
        // Extract internal links
        const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["']/gi) || []
        const baseUrl = new URL(url)
        let internalLinkCount = 0
        const internalLinks: string[] = []
        
        linkMatches.forEach(link => {
          const hrefMatch = link.match(/href=["']([^"']+)["']/i)
          if (hrefMatch) {
            try {
              const href = hrefMatch[1].trim()
              if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
                return
              }
              
              const linkUrl = new URL(href, url)
              if (isInternalLink(href, url)) {
                internalLinkCount++
                const normalized = normalizeUrl(linkUrl.toString())
                if (!internalLinks.includes(normalized) && !crawledUrls.has(normalized) && depth < maxDepth) {
                  internalLinks.push(normalized)
                  queue.push({ url: normalized, depth: depth + 1 })
                }
              }
            } catch {
              // Invalid URL, skip
            }
          }
        })
        
        totalInternalLinks += internalLinkCount
        
        pages.push({
          url,
          title: titleData?.title,
          metaDescription: metaData?.description,
          h1,
          wordCount,
          internalLinkCount,
          schemaTypes: schemaAnalysis.schemaTypes,
          loadTime,
          statusCode: response.status
        })
        
        console.log(`[Competitor Crawl] Crawled ${pages.length}/${maxPages}: ${url} (${wordCount} words, ${internalLinkCount} links)`)
      } catch (error) {
        console.warn(`[Competitor Crawl] Error crawling ${url}:`, error)
        continue
      }
    }
    
    const avgWordCount = pages.length > 0 ? totalWordCount / pages.length : 0
    const avgLoadTime = pages.length > 0 ? totalLoadTime / pages.length : 0
    const avgInternalLinks = pages.length > 0 ? totalInternalLinks / pages.length : 0
    
    // Calculate site structure metrics
    const depths = pages.map(p => {
      try {
        const urlObj = new URL(p.url)
        return urlObj.pathname.split('/').filter(p => p).length
      } catch {
        return 0
      }
    })
    const actualMaxDepth = Math.max(...depths, 0)
    
    const hubPages = pages.filter(p => p.internalLinkCount >= 10).length
    
    const fastPages = pages.filter(p => p.loadTime < 2000).length
    const slowPages = pages.filter(p => p.loadTime >= 3000).length
    
    console.log(`[Competitor Crawl] Completed crawl of ${rootUrl}: ${pages.length} pages, ${allKeywords.size} unique keywords`)
    
    return {
      url: rootUrl,
      pages,
      totalPages: pages.length,
      avgWordCount,
      schemaTypes: Array.from(allSchemaTypes),
      keywords: Array.from(allKeywords).slice(0, 100), // Top 100 keywords
      sharedKeywords: [], // Will be filled by caller
      keywordGaps: [], // Will be filled by caller
      siteStructure: {
        maxDepth: actualMaxDepth,
        avgInternalLinks,
        hubPages
      },
      performance: {
        avgLoadTime,
        fastPages,
        slowPages
      },
      localSEO: {
        hasNAP,
        hasLocalSchema,
        hasGBP
      }
    }
  } catch (error) {
    console.error(`[Competitor Crawl] Failed to crawl ${rootUrl}:`, error)
    return null
  }
}

/**
 * Extract keywords from a single page
 */
function extractKeywordsFromPage(
  html: string,
  title?: string,
  metaDescription?: string,
  h1?: string
): string[] {
  const keywords = new Set<string>()
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had'
  ])
  
  const extractPhrases = (text: string) => {
    if (!text) return []
    const words = text.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
    
    const phrases: string[] = []
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`
      if (phrase.length >= 6 && phrase.length <= 40) {
        phrases.push(phrase)
      }
    }
    return phrases
  }
  
  if (title) extractPhrases(title).forEach(p => keywords.add(p))
  if (metaDescription) extractPhrases(metaDescription).forEach(p => keywords.add(p))
  if (h1) extractPhrases(h1).forEach(p => keywords.add(p))
  
  // Extract from H2s
  const h2Matches = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || []
  h2Matches.slice(0, 5).forEach(h2 => {
    const text = h2.replace(/<[^>]+>/g, '').trim()
    extractPhrases(text).forEach(p => keywords.add(p))
  })
  
  return Array.from(keywords)
}

/**
 * Compare multiple competitor crawls and find gaps
 */
export function compareCompetitorCrawls(
  siteKeywords: string[],
  competitorCrawls: CompetitorCrawlData[]
): {
  sharedKeywords: string[]
  keywordGaps: Array<{ keyword: string; foundOn: string[]; frequency: number }>
  siteStructureComparison: Array<{
    competitor: string
    pageCount: number
    avgWordCount: number
    schemaTypes: string[]
    maxDepth: number
    avgInternalLinks: number
  }>
} {
  const siteKeywordSet = new Set(siteKeywords.map(k => k.toLowerCase()))
  
  // Find shared keywords
  const sharedKeywords: string[] = []
  competitorCrawls.forEach(crawl => {
    crawl.keywords.forEach(kw => {
      if (siteKeywordSet.has(kw.toLowerCase()) && !sharedKeywords.includes(kw)) {
        sharedKeywords.push(kw)
      }
    })
  })
  
  // Find keyword gaps
  const keywordFrequency = new Map<string, { count: number; foundOn: string[] }>()
  competitorCrawls.forEach(crawl => {
    crawl.keywords.forEach(kw => {
      if (!siteKeywordSet.has(kw.toLowerCase())) {
        const existing = keywordFrequency.get(kw)
        if (existing) {
          existing.count++
          if (!existing.foundOn.includes(crawl.url)) {
            existing.foundOn.push(crawl.url)
          }
        } else {
          keywordFrequency.set(kw, { count: 1, foundOn: [crawl.url] })
        }
      }
    })
  })
  
  const keywordGaps = Array.from(keywordFrequency.entries())
    .filter(([_, data]) => data.count >= 2) // Must appear in at least 2 competitors
    .map(([keyword, data]) => ({
      keyword,
      foundOn: data.foundOn,
      frequency: data.count
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 50) // Top 50 gaps
  
  // Build site structure comparison
  const siteStructureComparison = competitorCrawls.map(crawl => ({
    competitor: crawl.url,
    pageCount: crawl.totalPages,
    avgWordCount: crawl.avgWordCount,
    schemaTypes: crawl.schemaTypes,
    maxDepth: crawl.siteStructure.maxDepth,
    avgInternalLinks: crawl.siteStructure.avgInternalLinks
  }))
  
  return {
    sharedKeywords,
    keywordGaps,
    siteStructureComparison
  }
}

