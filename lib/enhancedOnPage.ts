/**
 * Enhanced On-Page SEO Analysis
 * 
 * Comprehensive on-page analysis including:
 * - Title tag optimization (length, keyword usage, uniqueness)
 * - Meta description optimization
 * - Heading structure (H1-H6 hierarchy)
 * - Internal linking analysis
 * - Image optimization
 * - URL structure and keywords
 * - Open Graph and Twitter Card tags
 * - Canonical tags
 */

import { Issue, PageData } from './types'

export interface EnhancedOnPageData {
  title: {
    exists: boolean
    length: number
    hasPrimaryKeyword: boolean
    keywordPosition: 'start' | 'middle' | 'end' | 'none'
    readability: 'good' | 'fair' | 'poor'
  }
  metaDescription: {
    exists: boolean
    length: number
    hasPrimaryKeyword: boolean
    hasCallToAction: boolean
    readability: 'good' | 'fair' | 'poor'
  }
  headings: {
    h1Count: number
    h2Count: number
    h3Count: number
    hierarchy: 'good' | 'fair' | 'poor'
    keywordUsage: number
  }
  internalLinking: {
    count: number
    anchorTextQuality: 'good' | 'fair' | 'poor'
    hasContextualLinks: boolean
  }
  images: {
    total: number
    withAlt: number
    withoutAlt: number
    oversized: number
    lazyLoaded: number
  }
  url: {
    length: number
    hasKeywords: boolean
    hasStopWords: boolean
    readability: 'good' | 'fair' | 'poor'
  }
  social: {
    hasOpenGraph: boolean
    hasTwitterCard: boolean
    hasCanonical: boolean
  }
}

/**
 * Analyze on-page SEO factors with enhanced depth
 */
export function analyzeEnhancedOnPage(
  page: PageData,
  html: string,
  primaryKeyword?: string
): { data: EnhancedOnPageData; issues: Issue[] } {
  const issues: Issue[] = []
  const data: EnhancedOnPageData = {
    title: {
      exists: !!page.title,
      length: page.titleLength || 0,
      hasPrimaryKeyword: false,
      keywordPosition: 'none',
      readability: 'fair'
    },
    metaDescription: {
      exists: !!page.metaDescription,
      length: page.metaDescriptionLength || 0,
      hasPrimaryKeyword: false,
      hasCallToAction: false,
      readability: 'fair'
    },
    headings: {
      h1Count: page.h1Count,
      h2Count: page.h2Count,
      h3Count: 0,
      hierarchy: 'fair',
      keywordUsage: 0
    },
    internalLinking: {
      count: page.internalLinkCount,
      anchorTextQuality: 'fair',
      hasContextualLinks: page.internalLinkCount > 0
    },
    images: {
      total: page.imageCount,
      withAlt: page.imageCount - page.missingAltCount,
      withoutAlt: page.missingAltCount,
      oversized: 0,
      lazyLoaded: 0
    },
    url: {
      length: page.url.length,
      hasKeywords: false,
      hasStopWords: false,
      readability: 'fair'
    },
    social: {
      hasOpenGraph: false,
      hasTwitterCard: false,
      hasCanonical: !!page.canonical
    }
  }

  // Analyze title tag
  if (page.title) {
    const titleLower = page.title.toLowerCase()
    
    // Check for primary keyword
    if (primaryKeyword) {
      const keywordLower = primaryKeyword.toLowerCase()
      data.title.hasPrimaryKeyword = titleLower.includes(keywordLower)
      
      if (data.title.hasPrimaryKeyword) {
        const keywordIndex = titleLower.indexOf(keywordLower)
        const titleLength = page.title.length
        if (keywordIndex < titleLength * 0.3) {
          data.title.keywordPosition = 'start'
        } else if (keywordIndex < titleLength * 0.7) {
          data.title.keywordPosition = 'middle'
        } else {
          data.title.keywordPosition = 'end'
        }
      }
    }

    // Title readability (check for keyword stuffing, special characters)
    const specialCharCount = (page.title.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length
    const wordCount = page.title.split(/\s+/).length
    if (specialCharCount > 2 || wordCount > 12) {
      data.title.readability = 'poor'
    } else if (specialCharCount <= 1 && wordCount <= 10) {
      data.title.readability = 'good'
    }

    // Title length issues
    if (page.titleLength! < 30) {
      issues.push({
        category: 'On-page',
        severity: 'High',
        message: 'Title tag too short',
        details: `Title is ${page.titleLength} characters. Recommended: 50-60 characters for optimal display in search results.`,
        affectedPages: [page.url]
      })
    } else if (page.titleLength! > 60) {
      issues.push({
        category: 'On-page',
        severity: 'Medium',
        message: 'Title tag too long',
        details: `Title is ${page.titleLength} characters. May be truncated in search results. Recommended: 50-60 characters.`,
        affectedPages: [page.url]
      })
    }

    // Keyword position
    if (primaryKeyword && !data.title.hasPrimaryKeyword) {
      issues.push({
        category: 'On-page',
        severity: 'Medium',
        message: 'Primary keyword not in title tag',
        details: `Include your primary keyword "${primaryKeyword}" in the title tag for better SEO.`,
        affectedPages: [page.url]
      })
    } else if (primaryKeyword && data.title.keywordPosition === 'end') {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'Primary keyword at end of title',
        details: 'Keywords at the beginning of title tags have more SEO weight. Consider moving keyword closer to the start.',
        affectedPages: [page.url]
      })
    }
  }

  // Analyze meta description
  if (page.metaDescription) {
    const metaLower = page.metaDescription.toLowerCase()
    
    if (primaryKeyword) {
      data.metaDescription.hasPrimaryKeyword = metaLower.includes(primaryKeyword.toLowerCase())
    }

    // Check for call-to-action words
    const ctaWords = ['learn', 'discover', 'get', 'buy', 'shop', 'try', 'start', 'download', 'sign up', 'contact']
    data.metaDescription.hasCallToAction = ctaWords.some(word => metaLower.includes(word))

    // Meta description readability
    const wordCount = page.metaDescription.split(/\s+/).length
    if (wordCount < 15 || wordCount > 25) {
      data.metaDescription.readability = 'poor'
    } else {
      data.metaDescription.readability = 'good'
    }

    // Meta description length issues
    if (page.metaDescriptionLength! < 120) {
      issues.push({
        category: 'On-page',
        severity: 'Medium',
        message: 'Meta description too short',
        details: `Description is ${page.metaDescriptionLength} characters. Recommended: 120-160 characters for optimal display.`,
        affectedPages: [page.url]
      })
    } else if (page.metaDescriptionLength! > 160) {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'Meta description too long',
        details: `Description is ${page.metaDescriptionLength} characters. May be truncated in search results. Recommended: 120-160 characters.`,
        affectedPages: [page.url]
      })
    }

    if (primaryKeyword && !data.metaDescription.hasPrimaryKeyword) {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'Primary keyword not in meta description',
        details: `Include your primary keyword "${primaryKeyword}" in the meta description for better relevance.`,
        affectedPages: [page.url]
      })
    }

    if (!data.metaDescription.hasCallToAction) {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'Meta description lacks call-to-action',
        details: 'Add a compelling call-to-action to improve click-through rates from search results.',
        affectedPages: [page.url]
      })
    }
  }

  // Analyze heading structure
  const h3Matches = html.match(/<h3[^>]*>/gi) || []
  data.headings.h3Count = h3Matches.length

  // Check heading hierarchy
  if (data.headings.h1Count === 0) {
    issues.push({
      category: 'On-page',
      severity: 'High',
      message: 'Missing H1 tag',
      details: 'Every page should have exactly one H1 tag. This is the most important heading for SEO.',
      affectedPages: [page.url]
    })
  } else if (data.headings.h1Count > 1) {
    issues.push({
      category: 'On-page',
      severity: 'Medium',
      message: 'Multiple H1 tags',
      details: `Found ${data.headings.h1Count} H1 tags. Use only one H1 per page for better SEO structure.`,
      affectedPages: [page.url]
    })
  }

  if (data.headings.h2Count === 0 && data.headings.h1Count > 0) {
    issues.push({
      category: 'On-page',
      severity: 'Medium',
      message: 'Missing H2 tags',
      details: 'Use H2 tags to structure your content and break it into logical sections.',
      affectedPages: [page.url]
    })
  }

  // Check heading hierarchy quality
  if (data.headings.h1Count === 1 && data.headings.h2Count >= 2) {
    data.headings.hierarchy = 'good'
  } else if (data.headings.h1Count === 1 && data.headings.h2Count >= 1) {
    data.headings.hierarchy = 'fair'
  } else {
    data.headings.hierarchy = 'poor'
  }

  // Analyze images
  if (data.images.total > 0 && data.images.withoutAlt > 0) {
    const missingAltPercent = (data.images.withoutAlt / data.images.total) * 100
    
    if (missingAltPercent > 50) {
      issues.push({
        category: 'Accessibility', // Changed from 'On-page' to 'Accessibility'
        severity: 'High',
        message: 'Missing alt attributes on images',
        details: `${data.images.withoutAlt} of ${data.images.total} images missing alt text (${Math.round(missingAltPercent)}%). This hurts accessibility and SEO.`,
        affectedPages: [page.url]
      })
    } else if (missingAltPercent > 25) {
      issues.push({
        category: 'Accessibility', // Changed from 'On-page' to 'Accessibility'
        severity: 'Medium',
        message: 'Missing alt attributes on images',
        details: `${data.images.withoutAlt} of ${data.images.total} images missing alt text (${Math.round(missingAltPercent)}%).`,
        affectedPages: [page.url]
      })
    } else if (data.images.withoutAlt > 0) {
      // Even if percentage is low, still flag it as low severity if any are missing
      issues.push({
        category: 'Accessibility',
        severity: 'Low',
        message: 'Missing alt attributes on images',
        details: `${data.images.withoutAlt} of ${data.images.total} images missing alt text (${Math.round(missingAltPercent)}%).`,
        affectedPages: [page.url]
      })
    }

    // Check for lazy loading (basic check)
    const lazyLoadMatches = html.match(/loading=["']lazy["']/gi) || []
    data.images.lazyLoaded = lazyLoadMatches.length
    
    if (data.images.lazyLoaded < data.images.total * 0.5 && data.images.total > 5) {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'Images not using lazy loading',
        details: 'Lazy loading images improves page load time. Add loading="lazy" to images below the fold.',
        affectedPages: [page.url]
      })
    }
  }

  // Analyze URL structure
  try {
    const urlObj = new URL(page.url)
    const pathSegments = urlObj.pathname.split('/').filter(Boolean)
    const urlText = pathSegments.join(' ').toLowerCase()
    
    data.url.hasKeywords = pathSegments.length > 0 && pathSegments.some(seg => seg.length > 3)
    
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
    data.url.hasStopWords = stopWords.some(word => urlText.includes(word))
    
    if (urlObj.pathname.length > 3 && pathSegments.length <= 3 && !data.url.hasStopWords) {
      data.url.readability = 'good'
    } else if (urlObj.pathname.length > 5) {
      data.url.readability = 'poor'
    }

    if (page.url.length > 100) {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'URL too long',
        details: `URL is ${page.url.length} characters. Keep URLs concise and under 100 characters when possible.`,
        affectedPages: [page.url]
      })
    }

    if (data.url.hasStopWords) {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'URL contains stop words',
        details: 'Remove stop words (the, a, an, etc.) from URLs for cleaner, more keyword-focused URLs.',
        affectedPages: [page.url]
      })
    }
  } catch {
    // URL parsing failed, skip URL analysis
  }

  // Check for social meta tags
  data.social.hasOpenGraph = /<meta[^>]*property=["']og:/i.test(html)
  data.social.hasTwitterCard = /<meta[^>]*(name|property)=["']twitter:/i.test(html)

  if (!data.social.hasOpenGraph) {
    issues.push({
      category: 'On-page',
      severity: 'Low',
      message: 'Missing Open Graph tags',
      details: 'Open Graph tags improve how your content appears when shared on social media. Add og:title, og:description, and og:image.',
      affectedPages: [page.url]
    })
  }

  if (!data.social.hasTwitterCard) {
    issues.push({
      category: 'On-page',
      severity: 'Low',
      message: 'Missing Twitter Card tags',
      details: 'Twitter Card tags improve how your content appears when shared on Twitter. Add twitter:card, twitter:title, and twitter:description.',
      affectedPages: [page.url]
    })
  }

  // Check canonical tag
  if (!data.social.hasCanonical) {
    issues.push({
      category: 'On-page',
      severity: 'Medium',
      message: 'Missing canonical tag',
      details: 'Canonical tags prevent duplicate content issues. Add <link rel="canonical" href="[URL]"> to each page.',
      affectedPages: [page.url]
    })
  }

  // Analyze internal linking
  if (data.internalLinking.count === 0) {
    issues.push({
      category: 'On-page',
      severity: 'Medium',
      message: 'No internal links found',
      details: 'Internal linking helps distribute page authority and improves user navigation. Add contextual internal links to related pages.',
      affectedPages: [page.url]
    })
  } else if (data.internalLinking.count < 3) {
    issues.push({
      category: 'On-page',
      severity: 'Low',
      message: 'Few internal links',
      details: `Only ${data.internalLinking.count} internal link(s) found. Aim for 3-5 contextual internal links per page.`,
      affectedPages: [page.url]
    })
  }

  return { data, issues }
}

/**
 * Generate actionable fix instructions for on-page issues
 */
export function getOnPageFixInstructions(issue: Issue): string {
  const message = issue.message.toLowerCase()
  
  if (message.includes('title')) {
    if (message.includes('too short')) {
      return `1. Expand your title tag to 50-60 characters
2. Include your primary keyword near the beginning
3. Add your brand name at the end (if space allows)
4. Make it compelling and click-worthy
5. Example: "Best [Keyword] Guide 2024 | [Brand Name]"`
    }
    if (message.includes('too long')) {
      return `1. Trim your title tag to 50-60 characters
2. Remove unnecessary words or brand name if needed
3. Keep the most important keywords
4. Test how it appears in search results using SERP preview tools
5. Ensure it's not truncated in Google search results`
    }
    if (message.includes('keyword')) {
      return `1. Identify your primary keyword for this page
2. Place the keyword within the first 60% of the title
3. Keep the title natural and readable
4. Avoid keyword stuffing
5. Example: "[Primary Keyword] - Complete Guide | [Brand]"`
    }
  }
  
  if (message.includes('meta description')) {
    if (message.includes('too short')) {
      return `1. Expand your meta description to 120-160 characters
2. Include your primary keyword naturally
3. Add a compelling call-to-action
4. Highlight unique value proposition
5. Example: "Discover the best [keyword] strategies. Learn proven techniques to [benefit]. Get started today!"`
    }
    if (message.includes('too long')) {
      return `1. Trim your meta description to 120-160 characters
2. Remove redundant information
3. Keep the most compelling parts
4. Ensure it ends with a call-to-action
5. Test truncation in search results`
    }
    if (message.includes('call-to-action')) {
      return `1. Add action words: "Learn", "Discover", "Get", "Try", "Start"
2. Create urgency: "Today", "Now", "Free"
3. Highlight benefits: "Save time", "Increase traffic"
4. Example: "Learn how to [benefit]. Get started free today!"`
    }
  }
  
  if (message.includes('h1')) {
    return `1. Ensure exactly one H1 tag per page
2. Place H1 at the top of main content
3. Include your primary keyword
4. Make it descriptive and compelling
5. Example: <h1>Complete Guide to [Primary Keyword]</h1>
6. Remove duplicate H1 tags if multiple exist`
  }
  
  if (message.includes('h2')) {
    return `1. Use H2 tags to structure your content into sections
2. Create 3-5 H2 sections per page
3. Include related keywords in H2 tags
4. Maintain logical hierarchy: H1 → H2 → H3
5. Example structure:
   <h1>Main Topic</h1>
   <h2>Section 1</h2>
   <h2>Section 2</h2>
   <h3>Subsection 2.1</h3>`
  }
  
  if (message.includes('alt text') || message.includes('alt attribute') || message.includes('high percentage of images missing alt') || message.includes('missing alt')) {
    return `1. Add descriptive alt attributes to all images on affected pages
2. Describe what the image shows or its purpose (e.g., alt="Woman using laptop at desk")
3. Keep alt text concise (under 125 characters recommended)
4. For decorative images, use alt="" (empty but present)
5. Include relevant keywords naturally if the image is content-related
6. Example: <img src="image.jpg" alt="Descriptive text here">
7. Don't start with "image of" or "picture of" - be direct and descriptive`
  }
  
  if (message.includes('lazy loading')) {
    return `1. Add loading="lazy" attribute to images below the fold
2. Example: <img src="image.jpg" alt="Description" loading="lazy">
3. Don't lazy load images above the fold (visible immediately)
4. For modern browsers, this is supported natively
5. Consider using a lazy loading library for older browser support`
  }
  
  if (message.includes('canonical')) {
    return `1. Add canonical tag to the <head> section
2. Use the preferred URL (usually the HTTPS version)
3. Example: <link rel="canonical" href="https://example.com/page">
4. Ensure canonical points to the correct page
5. Use absolute URLs, not relative
6. If you have multiple URLs for the same content, canonicalize to one`
  }
  
  if (message.includes('open graph')) {
    return `1. Add Open Graph meta tags to <head> section
2. Required tags:
   <meta property="og:title" content="Page Title">
   <meta property="og:description" content="Page Description">
   <meta property="og:image" content="https://example.com/image.jpg">
   <meta property="og:url" content="https://example.com/page">
3. Optional but recommended:
   <meta property="og:type" content="website">
   <meta property="og:site_name" content="Site Name">`
  }
  
  if (message.includes('twitter card')) {
    return `1. Add Twitter Card meta tags to <head> section
2. Basic tags:
   <meta name="twitter:card" content="summary_large_image">
   <meta name="twitter:title" content="Page Title">
   <meta name="twitter:description" content="Page Description">
   <meta name="twitter:image" content="https://example.com/image.jpg">
3. Use "summary_large_image" for better visual impact
4. Image should be at least 1200x630px for best results`
  }
  
  if (message.includes('internal link')) {
    return `1. Add 3-5 contextual internal links per page
2. Link to related, high-value pages
3. Use descriptive anchor text (not "click here")
4. Place links naturally within content
5. Link to important pages (homepage, key service pages)
6. Example: "Learn more about our <a href="/services">SEO services</a>"
7. Create a logical site structure with clear navigation`
  }
  
  if (message.includes('url')) {
    if (message.includes('too long')) {
      return `1. Shorten URLs by removing unnecessary parameters
2. Use descriptive but concise slugs
3. Remove stop words (the, a, an, etc.)
4. Keep URLs under 100 characters when possible
5. Use hyphens to separate words: example.com/best-seo-tips
6. Avoid special characters and spaces`
    }
    if (message.includes('stop words')) {
      return `1. Remove common stop words from URLs: the, a, an, and, or, but, in, on, at, to, for, of, with, by
2. Keep only meaningful keywords
3. Example: Instead of "the-best-seo-tips-for-beginners", use "best-seo-tips-beginners"
4. Maintain readability while removing unnecessary words`
    }
  }
  
  return `Review the issue details and implement the recommended changes. Test changes in Google Search Console after implementation.`
}

