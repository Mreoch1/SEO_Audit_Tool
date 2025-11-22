/**
 * URL Normalization and Canonicalization Utilities
 * 
 * Handles URL normalization, redirect following, canonical detection,
 * and host/domain comparisons to prevent duplicate URL issues.
 */

export interface NormalizedUrlResult {
  normalizedUrl: string
  redirectedFrom?: string
  canonicalUrl?: string
  finalUrl: string
  redirectChain: string[]
}

export interface CrawlContext {
  preferredHostname: string
  preferredProtocol: string
  rootDomain: string
}

/**
 * Basic URL normalization - add protocol if missing, clean format
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Remove hash, normalize trailing slash
    parsed.hash = ''
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }
    return parsed.toString()
  } catch {
    // If invalid, try adding protocol
    if (!url.startsWith('http')) {
      try {
        return normalizeUrl(`https://${url}`)
      } catch {
        return url
      }
    }
    return url
  }
}

/**
 * Get root domain from hostname (e.g., "www.example.com" -> "example.com")
 */
export function getRootDomain(hostname: string): string {
  const cleanHost = hostname.replace(/\.$/, '').toLowerCase()
  const parts = cleanHost.split('.')
  
  // Handle special TLDs like .co.uk, .com.au
  const specialTlds = ['co.uk', 'com.au', 'co.jp', 'co.nz', 'com.br']
  const lastTwo = parts.slice(-2).join('.')
  
  if (specialTlds.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.')
  }
  
  if (parts.length >= 2) {
    return parts.slice(-2).join('.')
  }
  return cleanHost
}

/**
 * Check if two domains are the same (handles www. prefix and subdomains)
 */
export function isSameDomain(domain1: string, domain2: string): boolean {
  const root1 = getRootDomain(domain1)
  const root2 = getRootDomain(domain2)
  return root1 === root2
}

/**
 * Determine if hostname is www variant
 */
export function isWwwVariant(hostname: string): boolean {
  return hostname.toLowerCase().startsWith('www.')
}

/**
 * Normalize hostname (prefer www or non-www based on first URL seen)
 */
export function normalizeHostname(hostname: string, preferredHostname: string): string {
  if (!isSameDomain(hostname, preferredHostname)) {
    return hostname.toLowerCase()
  }
  
  // If same domain, use preferred hostname format
  return preferredHostname.toLowerCase()
}

/**
 * Follow redirects and get final URL
 */
export async function followRedirects(
  url: string,
  userAgent: string,
  maxRedirects = 5
): Promise<NormalizedUrlResult> {
  const redirectChain: string[] = [url]
  let currentUrl = url
  let redirectCount = 0
  
  while (redirectCount < maxRedirects) {
    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': userAgent }
      })
      
      // Check for redirect status codes
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) break
        
        // Resolve relative redirects
        const nextUrl = new URL(location, currentUrl).toString()
        redirectChain.push(nextUrl)
        currentUrl = nextUrl
        redirectCount++
      } else {
        // Not a redirect, we've reached the final URL
        break
      }
    } catch (error) {
      // Network error or timeout - use current URL as final
      console.warn(`[URLNormalizer] Error following redirects for ${currentUrl}:`, error)
      break
    }
  }
  
  const finalUrl = normalizeUrl(currentUrl)
  
  return {
    normalizedUrl: normalizeUrl(url),
    redirectedFrom: redirectChain.length > 1 ? redirectChain[0] : undefined,
    finalUrl,
    redirectChain,
    canonicalUrl: undefined // Will be set when parsing HTML
  }
}

/**
 * Canonicalize URL (apply all normalization rules)
 */
export function canonicalizeUrl(input: string, context?: CrawlContext): string {
  try {
    const parsed = new URL(input)
    
    // Remove hash
    parsed.hash = ''
    
    // Normalize protocol to preferred
    if (context?.preferredProtocol) {
      parsed.protocol = context.preferredProtocol
    }
    
    // Normalize hostname to preferred
    if (context?.preferredHostname && isSameDomain(parsed.hostname, context.preferredHostname)) {
      parsed.hostname = context.preferredHostname
    } else {
      parsed.hostname = parsed.hostname.toLowerCase()
    }
    
    // Remove default ports
    if (
      (parsed.protocol === 'https:' && parsed.port === '443') ||
      (parsed.protocol === 'http:' && parsed.port === '80')
    ) {
      parsed.port = ''
    }
    
    // Normalize trailing slashes
    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '')
      if (parsed.pathname === '') parsed.pathname = '/'
    }
    
    // Sort query parameters for consistency
    if (parsed.search) {
      const params = new URLSearchParams(parsed.search)
      const sortedParams = new URLSearchParams(
        Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      )
      parsed.search = sortedParams.toString()
    }
    
    return parsed.toString()
  } catch {
    return input
  }
}

/**
 * Determine if a link is internal based on domain matching
 */
export function isInternalLink(linkUrl: string, baseUrl: string, context?: CrawlContext): boolean {
  try {
    const link = new URL(linkUrl, baseUrl)
    const base = new URL(baseUrl)
    
    // If we have a context with preferred hostname, use root domain comparison
    if (context) {
      return isSameDomain(link.hostname, base.hostname)
    }
    
    // Otherwise, exact hostname match
    return link.hostname.toLowerCase() === base.hostname.toLowerCase()
  } catch {
    // Invalid URL or relative URL - treat as internal
    return true
  }
}

/**
 * Merge URLs that point to the same content (via redirects or canonical)
 */
export function shouldMergeUrls(url1: string, url2: string, context?: CrawlContext): boolean {
  try {
    const parsed1 = new URL(url1)
    const parsed2 = new URL(url2)
    
    // Same path and query, different host variants (www vs non-www)
    if (
      isSameDomain(parsed1.hostname, parsed2.hostname) &&
      parsed1.pathname === parsed2.pathname &&
      parsed1.search === parsed2.search
    ) {
      return true
    }
    
    return false
  } catch {
    return false
  }
}

/**
 * Get preferred URL from a set of duplicate URLs
 */
export function getPreferredUrl(urls: string[], context?: CrawlContext): string {
  if (urls.length === 0) return ''
  if (urls.length === 1) return urls[0]
  
  // Prefer HTTPS over HTTP
  const httpsUrls = urls.filter(u => u.startsWith('https://'))
  if (httpsUrls.length > 0) {
    urls = httpsUrls
  }
  
  // Prefer www or non-www based on context
  if (context?.preferredHostname) {
    const preferWww = isWwwVariant(context.preferredHostname)
    const matchingVariant = urls.filter(u => {
      try {
        const parsed = new URL(u)
        return isWwwVariant(parsed.hostname) === preferWww
      } catch {
        return false
      }
    })
    if (matchingVariant.length > 0) {
      return matchingVariant[0]
    }
  }
  
  // Prefer shorter URLs (often cleaner)
  return urls.sort((a, b) => a.length - b.length)[0]
}

