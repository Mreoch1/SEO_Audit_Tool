/**
 * Social Media Presence Checker
 * 
 * Checks for Open Graph tags, Twitter Cards, social media links, and favicons
 */

export interface SocialMetaTags {
  openGraph: {
    hasTags: boolean
    ogTitle?: string
    ogDescription?: string
    ogImage?: string
    ogUrl?: string
    ogType?: string
    missingRequired: string[]
  }
  twitter: {
    hasCards: boolean
    cardType?: string
    twitterTitle?: string
    twitterDescription?: string
    twitterImage?: string
    twitterSite?: string
    missingRequired: string[]
  }
}

export interface SocialMediaLinks {
  facebook?: string
  twitter?: string
  instagram?: string
  youtube?: string
  linkedin?: string
  tiktok?: string
}

export interface SocialMediaData {
  metaTags: SocialMetaTags
  socialLinks: SocialMediaLinks
  hasFacebookPixel: boolean
  hasFavicon: boolean
  faviconUrl?: string
}

/**
 * Check social media presence from HTML
 */
export function checkSocialMediaPresence(html: string, baseUrl: string): SocialMediaData {
  // Extract Open Graph tags
  const ogTitle = extractMetaProperty(html, 'og:title')
  const ogDescription = extractMetaProperty(html, 'og:description')
  const ogImage = extractMetaProperty(html, 'og:image')
  const ogUrl = extractMetaProperty(html, 'og:url')
  const ogType = extractMetaProperty(html, 'og:type')
  
  const requiredOGTags = ['og:title', 'og:description', 'og:image']
  const missingOG: string[] = []
  if (!ogTitle) missingOG.push('og:title')
  if (!ogDescription) missingOG.push('og:description')
  if (!ogImage) missingOG.push('og:image')
  
  const hasOGTags = !!(ogTitle || ogDescription || ogImage || ogUrl || ogType)
  
  // Extract Twitter Card tags
  const twitterCard = extractMetaName(html, 'twitter:card')
  const twitterTitle = extractMetaName(html, 'twitter:title')
  const twitterDescription = extractMetaName(html, 'twitter:description')
  const twitterImage = extractMetaName(html, 'twitter:image')
  const twitterSite = extractMetaName(html, 'twitter:site') || extractMetaName(html, 'twitter:creator')
  
  const requiredTwitterTags = ['twitter:card', 'twitter:title', 'twitter:description']
  const missingTwitter: string[] = []
  if (!twitterCard) missingTwitter.push('twitter:card')
  if (!twitterTitle) missingTwitter.push('twitter:title')
  if (!twitterDescription) missingTwitter.push('twitter:description')
  
  const hasTwitterCards = !!(twitterCard || twitterTitle || twitterDescription || twitterImage || twitterSite)
  
  // Extract social media links
  const socialLinks = extractSocialLinks(html, baseUrl)
  
  // Check for Facebook Pixel
  const hasFacebookPixel = /fbq|facebook\.com\/tr|fb:app_id/i.test(html)
  
  // Check for favicon
  const faviconUrl = extractFavicon(html, baseUrl)
  const hasFavicon = !!faviconUrl
  
  return {
    metaTags: {
      openGraph: {
        hasTags: hasOGTags,
        ogTitle,
        ogDescription,
        ogImage,
        ogUrl,
        ogType,
        missingRequired: missingOG
      },
      twitter: {
        hasCards: hasTwitterCards,
        cardType: twitterCard,
        twitterTitle,
        twitterDescription,
        twitterImage,
        twitterSite,
        missingRequired: missingTwitter
      }
    },
    socialLinks,
    hasFacebookPixel,
    hasFavicon,
    faviconUrl
  }
}

/**
 * Extract meta property value (for Open Graph)
 */
function extractMetaProperty(html: string, property: string): string | undefined {
  const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i')
  const match = html.match(regex)
  return match ? match[1].trim() : undefined
}

/**
 * Extract meta name value (for Twitter Cards and other tags)
 */
function extractMetaName(html: string, name: string): string | undefined {
  const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i')
  const match = html.match(regex)
  return match ? match[1].trim() : undefined
}

/**
 * Extract social media links from HTML
 */
function extractSocialLinks(html: string, baseUrl: string): SocialMediaLinks {
  const links: SocialMediaLinks = {}
  
  // Patterns for different social platforms
  const patterns = {
    facebook: /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com)\/([a-zA-Z0-9.]+)/gi,
    twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/gi,
    instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/gi,
    youtube: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:channel\/|user\/|@)?|youtu\.be\/)([a-zA-Z0-9_-]+)/gi,
    linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9-]+)/gi,
    tiktok: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/gi
  }
  
  // Search in all <a> tags and plain text
  const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi) || []
  const allLinks = [...linkMatches.map(link => {
    const hrefMatch = link.match(/href=["']([^"']+)["']/i)
    return hrefMatch ? hrefMatch[1] : ''
  }), html]
  
  const allLinksText = allLinks.join(' ')
  
  // Check each platform
  for (const [platform, pattern] of Object.entries(patterns)) {
    const matches = allLinksText.match(pattern)
    if (matches) {
      // Filter out favicon and other non-profile URLs
      const validMatches = matches.filter(match => {
        const url = match.toLowerCase()
        // Filter out favicon URLs
        if (url.includes('/favicon') || url.includes('/favicon.ico')) {
          return false
        }
        // Filter out other common non-profile paths
        const nonProfilePaths = ['/icon', '/logo', '/image', '/img', '/assets', '/static', '/cdn']
        if (nonProfilePaths.some(path => url.includes(path))) {
          return false
        }
        // For Twitter/X, filter out paths that are clearly not usernames
        if ((platform === 'twitter') && url.match(/\/[^\/]+\.[a-z]{2,4}$/i)) {
          // URLs ending with file extensions are likely not profiles
          return false
        }
        return true
      })
      
      if (validMatches.length > 0) {
        // Get the first valid match
        const url = validMatches[0]
        if (url.startsWith('http')) {
          links[platform as keyof SocialMediaLinks] = url
        } else {
          // Construct full URL
          links[platform as keyof SocialMediaLinks] = `https://${url}`
        }
      }
    }
  }
  
  return links
}

/**
 * Extract favicon URL
 */
function extractFavicon(html: string, baseUrl: string): string | undefined {
  // Check for <link rel="icon"> or <link rel="shortcut icon">
  const iconPatterns = [
    /<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/i
  ]
  
  for (const pattern of iconPatterns) {
    const match = html.match(pattern)
    if (match) {
      const href = match[1]
      try {
        // Resolve relative URLs
        return new URL(href, baseUrl).toString()
      } catch {
        return href.startsWith('http') ? href : undefined
      }
    }
  }
  
  // Check for default favicon.ico
  try {
    const defaultFavicon = new URL('/favicon.ico', baseUrl).toString()
    return defaultFavicon
  } catch {
    return undefined
  }
}

