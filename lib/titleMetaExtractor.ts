/**
 * Title and Meta Tag Extraction
 * 
 * Robust extraction of title and meta tags from HTML,
 * handling multiple title tags, JS-rendered content, and accurate length measurement
 */

export interface TitleData {
  title: string
  length: number
  pixelWidth?: number
  source: 'static' | 'rendered'
}

export interface MetaDescriptionData {
  description: string
  length: number
  source: 'static' | 'rendered'
}

/**
 * Extract title from HTML (prefers last/rendered title)
 */
export function extractTitle(html: string): TitleData | null {
  // Find all <title> tags
  const titleMatches = html.match(/<title[^>]*>([\s\S]*?)<\/title>/gi)
  
  if (!titleMatches || titleMatches.length === 0) {
    return null
  }
  
  // Use the LAST title tag found (most likely to be the JS-rendered final title)
  const lastTitleMatch = titleMatches[titleMatches.length - 1]
  const titleContent = lastTitleMatch.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  
  if (!titleContent || !titleContent[1]) {
    return null
  }
  
  // Clean and decode HTML entities
  const cleanTitle = decodeHtmlEntities(titleContent[1])
    .replace(/<[^>]+>/g, '') // Remove any nested tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
  
  if (!cleanTitle) {
    return null
  }
  
  return {
    title: cleanTitle,
    length: cleanTitle.length,
    pixelWidth: estimateTitlePixelWidth(cleanTitle),
    source: titleMatches.length > 1 ? 'rendered' : 'static'
  }
}

/**
 * Extract meta description from HTML
 */
export function extractMetaDescription(html: string): MetaDescriptionData | null {
  // Try multiple patterns for meta description
  const patterns = [
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/gi,
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/gi
  ]
  
  let description: string | null = null
  let matchCount = 0
  
  for (const pattern of patterns) {
    const matches = html.match(pattern)
    if (matches && matches.length > 0) {
      matchCount = matches.length
      // Use the LAST match (most likely to be the JS-rendered one)
      const lastMatch = matches[matches.length - 1]
      const contentMatch = lastMatch.match(/content=["']([^"']+)["']/i)
      if (contentMatch) {
        description = contentMatch[1]
        break
      }
    }
  }
  
  if (!description) {
    return null
  }
  
  // Clean and decode
  const cleanDescription = decodeHtmlEntities(description)
    .replace(/\s+/g, ' ')
    .trim()
  
  if (!cleanDescription) {
    return null
  }
  
  return {
    description: cleanDescription,
    length: cleanDescription.length,
    source: matchCount > 1 ? 'rendered' : 'static'
  }
}

/**
 * Decode HTML entities properly
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™'
  }
  
  let decoded = text
  
  // Replace named entities
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), char)
  }
  
  // Replace numeric entities (&#123; or &#xAB;)
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => 
    String.fromCharCode(parseInt(num, 10))
  )
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => 
    String.fromCharCode(parseInt(hex, 16))
  )
  
  return decoded
}

/**
 * Estimate pixel width of title for Google SERP display
 * Google truncates at approximately 600 pixels
 */
function estimateTitlePixelWidth(title: string): number {
  // Average character widths in Google's SERP font (approximate)
  const charWidths: Record<string, number> = {
    'i': 4, 'j': 4, 'l': 4, 't': 4, 'f': 5, 'r': 6,
    'a': 9, 'b': 9, 'c': 8, 'd': 9, 'e': 9, 'g': 9,
    'h': 9, 'k': 8, 'n': 9, 'o': 9, 'p': 9, 'q': 9,
    's': 8, 'u': 9, 'v': 8, 'w': 13, 'x': 8, 'y': 8, 'z': 8,
    'A': 11, 'B': 11, 'C': 11, 'D': 12, 'E': 10, 'F': 10,
    'G': 12, 'H': 12, 'I': 5, 'J': 7, 'K': 11, 'L': 9,
    'M': 14, 'N': 12, 'O': 12, 'P': 10, 'Q': 12, 'R': 11,
    'S': 10, 'T': 10, 'U': 12, 'V': 11, 'W': 16, 'X': 11,
    'Y': 10, 'Z': 10,
    ' ': 4, '-': 5, '_': 8, '.': 4, ',': 4, ':': 4, ';': 4,
    '!': 5, '?': 9, '(': 5, ')': 5, '[': 5, ']': 5,
    '|': 4, '/': 5, '\\': 5, '&': 11, '#': 10, '@': 15,
    '0': 9, '1': 9, '2': 9, '3': 9, '4': 9, '5': 9,
    '6': 9, '7': 9, '8': 9, '9': 9
  }
  
  let width = 0
  for (const char of title) {
    width += charWidths[char] || 9 // Default to 9px for unknown chars
  }
  
  return width
}

/**
 * Check if title is too short (SEO best practice: 50-60 chars, ~500-600px)
 */
export function isTitleTooShort(titleData: TitleData): boolean {
  // Character-based check
  if (titleData.length < 30) return true
  
  // Pixel-based check (if available)
  if (titleData.pixelWidth && titleData.pixelWidth < 300) return true
  
  return false
}

/**
 * Check if title is too long (will be truncated in SERPs)
 */
export function isTitleTooLong(titleData: TitleData): boolean {
  // Character-based check (Google typically truncates around 60 chars)
  if (titleData.length > 70) return true
  
  // Pixel-based check (Google truncates at ~600px)
  if (titleData.pixelWidth && titleData.pixelWidth > 600) return true
  
  return false
}

/**
 * Check if meta description is too short
 */
export function isMetaDescriptionTooShort(metaData: MetaDescriptionData): boolean {
  return metaData.length < 70
}

/**
 * Check if meta description is too long
 */
export function isMetaDescriptionTooLong(metaData: MetaDescriptionData): boolean {
  return metaData.length > 160
}

/**
 * Extract canonical URL from HTML
 */
export function extractCanonical(html: string): string | null {
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
  if (canonicalMatch) {
    return canonicalMatch[1].trim()
  }
  
  // Try alternate format
  const altMatch = html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)
  if (altMatch) {
    return altMatch[1].trim()
  }
  
  return null
}

/**
 * Extract Open Graph title (for social meta validation)
 */
export function extractOgTitle(html: string): string | null {
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  if (ogTitleMatch) {
    return decodeHtmlEntities(ogTitleMatch[1].trim())
  }
  
  const altMatch = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)
  if (altMatch) {
    return decodeHtmlEntities(altMatch[1].trim())
  }
  
  return null
}

/**
 * Extract Open Graph description
 */
export function extractOgDescription(html: string): string | null {
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
  if (ogDescMatch) {
    return decodeHtmlEntities(ogDescMatch[1].trim())
  }
  
  const altMatch = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)
  if (altMatch) {
    return decodeHtmlEntities(altMatch[1].trim())
  }
  
  return null
}

/**
 * Check for common title issues
 */
export function analyzeTitleIssues(titleData: TitleData | null, url: string): {
  issues: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
}[] {
  const issues: { issues: string[]; severity: 'critical' | 'high' | 'medium' | 'low' }[] = []
  
  if (!titleData) {
    issues.push({
      issues: ['Missing page title'],
      severity: 'critical'
    })
    return issues
  }
  
  if (isTitleTooShort(titleData)) {
    issues.push({
      issues: [`Title too short: ${titleData.length} characters (recommended: 50-60)`],
      severity: 'high'
    })
  }
  
  if (isTitleTooLong(titleData)) {
    issues.push({
      issues: [`Title too long: ${titleData.length} characters (will be truncated at ~60)`],
      severity: 'medium'
    })
  }
  
  // Check for duplicates, missing keywords, etc. would be done at site-wide level
  
  return issues
}

/**
 * Check for common meta description issues
 */
export function analyzeMetaDescriptionIssues(
  metaData: MetaDescriptionData | null,
  url: string
): {
  issues: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
}[] {
  const issues: { issues: string[]; severity: 'critical' | 'high' | 'medium' | 'low' }[] = []
  
  if (!metaData) {
    issues.push({
      issues: ['Missing meta description'],
      severity: 'high'
    })
    return issues
  }
  
  if (isMetaDescriptionTooShort(metaData)) {
    issues.push({
      issues: [`Meta description too short: ${metaData.length} characters (recommended: 120-160)`],
      severity: 'medium'
    })
  }
  
  if (isMetaDescriptionTooLong(metaData)) {
    issues.push({
      issues: [`Meta description too long: ${metaData.length} characters (will be truncated at ~160)`],
      severity: 'low'
    })
  }
  
  return issues
}

