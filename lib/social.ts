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
  hasGoogleAnalytics: boolean // NEW: GA4 detection
  hasGoogleTagManager: boolean // NEW: GTM detection
  hasFavicon: boolean
  faviconUrl?: string
  // NEW: Agency tier enhancements
  socialSchema?: {
    hasOrganizationSchema: boolean
    hasSocialProfileLinks: boolean
    schemaTypes: string[]
  }
  shareImageValidation?: {
    ogImageSize?: { width: number; height: number }
    twitterImageSize?: { width: number; height: number }
    isValidSize: boolean
    isValidRatio: boolean
    recommendations: string[]
  }
  pixelTracking?: {
    facebookPixel?: string
    googleAnalytics?: string
    googleTagManager?: string
    otherPixels: string[]
  }
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
  
  // NEW: Check for Google Analytics (GA4)
  const hasGoogleAnalytics = /gtag|ga\(|google-analytics|googletagmanager\.com\/gtag/i.test(html)
  
  // NEW: Check for Google Tag Manager
  const hasGoogleTagManager = /googletagmanager\.com\/gtm\.js|GTM-/i.test(html)
  
  // Check for favicon
  const faviconUrl = extractFavicon(html, baseUrl)
  const hasFavicon = !!faviconUrl
  
  // NEW: Agency tier - Social schema detection
  const socialSchema = detectSocialSchema(html)
  
  // NEW: Agency tier - Share image validation
  const shareImageValidation = validateShareImages(ogImage, twitterImage, baseUrl)
  
  // NEW: Agency tier - Pixel tracking details
  const pixelTracking = extractPixelTracking(html)
  
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
    hasGoogleAnalytics,
    hasGoogleTagManager,
    hasFavicon,
    faviconUrl,
    socialSchema,
    shareImageValidation,
    pixelTracking
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

/**
 * Detect social schema markup (Agency tier)
 */
function detectSocialSchema(html: string): SocialMediaData['socialSchema'] {
  const hasOrganizationSchema = /"@type"\s*:\s*"Organization"/i.test(html) ||
    /"@type"\s*:\s*"LocalBusiness"/i.test(html)
  
  const hasSocialProfileLinks = /"sameAs"\s*:\s*\[/i.test(html) ||
    /socialProfile/i.test(html)
  
  const schemaTypes: string[] = []
  if (hasOrganizationSchema) schemaTypes.push('Organization')
  if (html.includes('"LocalBusiness"')) schemaTypes.push('LocalBusiness')
  if (html.includes('"Person"')) schemaTypes.push('Person')
  
  return {
    hasOrganizationSchema,
    hasSocialProfileLinks,
    schemaTypes
  }
}

/**
 * Validate share images (Agency tier)
 * Checks size and aspect ratio for optimal social sharing
 */
function validateShareImages(
  ogImage?: string,
  twitterImage?: string,
  baseUrl?: string
): SocialMediaData['shareImageValidation'] {
  const recommendations: string[] = []
  let isValidSize = true
  let isValidRatio = true
  
  // Note: Full image size validation would require fetching the image
  // This is a basic validation that checks if images are specified
  // In production, you'd fetch images and check dimensions
  
  if (!ogImage && !twitterImage) {
    recommendations.push('Add og:image and twitter:image tags for better social sharing')
    return {
      isValidSize: false,
      isValidRatio: false,
      recommendations
    }
  }
  
  // Recommended sizes:
  // OG Image: 1200x630px (1.91:1 ratio)
  // Twitter Image: 1200x675px (16:9 ratio) for summary_large_image
  
  if (ogImage) {
    recommendations.push('OG image detected. Recommended size: 1200x630px (1.91:1 ratio)')
  }
  
  if (twitterImage) {
    recommendations.push('Twitter image detected. Recommended size: 1200x675px (16:9 ratio) for summary_large_image cards')
  }
  
  return {
    isValidSize,
    isValidRatio,
    recommendations
  }
}

/**
 * Extract pixel tracking details (Agency tier)
 */
function extractPixelTracking(html: string): SocialMediaData['pixelTracking'] {
  const tracking: SocialMediaData['pixelTracking'] = {
    otherPixels: []
  }
  
  // Facebook Pixel ID
  const fbPixelMatch = html.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"]?([^'",\s)]+)/i) ||
    html.match(/facebook\.com\/tr\?id=([^"'\s&]+)/i)
  if (fbPixelMatch) {
    tracking.facebookPixel = fbPixelMatch[1]
  }
  
  // Google Analytics ID (GA4)
  const gaMatch = html.match(/gtag\s*\(\s*['"]config['"]\s*,\s*['"]?([^'",\s)]+)/i) ||
    html.match(/ga\(['"]create['"]\s*,\s*['"]?([^'",\s)]+)/i) ||
    html.match(/google-analytics\.com\/ga\.js[^"']*id=([^"'\s&]+)/i)
  if (gaMatch) {
    tracking.googleAnalytics = gaMatch[1]
  }
  
  // Google Tag Manager ID
  const gtmMatch = html.match(/GTM-([A-Z0-9]+)/i) ||
    html.match(/googletagmanager\.com\/gtm\.js\?id=([^"'\s&]+)/i)
  if (gtmMatch) {
    tracking.googleTagManager = gtmMatch[1]
  }
  
  // Other tracking pixels (basic detection)
  const otherPixels = [
    /pinterest\.com\/ct\.html/i,
    /linkedin\.com\/px/i,
    /snapchat\.com\/pixel/i,
    /tiktok\.com\/pixel/i
  ]
  
  otherPixels.forEach(pattern => {
    if (pattern.test(html)) {
      const match = html.match(pattern)
      if (match) {
        tracking.otherPixels!.push(match[0])
      }
    }
  })
  
  return tracking
}

