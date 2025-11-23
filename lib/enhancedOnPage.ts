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
    h4Count?: number // NEW: Agency tier
    h5Count?: number // NEW: Agency tier
    h6Count?: number // NEW: Agency tier
    hierarchy: 'good' | 'fair' | 'poor'
    keywordUsage: number
    hierarchyMap?: { // NEW: Agency tier - Heading hierarchy map
      level: number
      text: string
      order: number
    }[]
    hasProperHierarchy?: boolean // NEW: Agency tier - Checks for proper H1->H2->H3 order
  }
  titleH1Alignment?: { // NEW: Agency tier - Title/H1 alignment
    isAligned: boolean
    similarityScore: number // 0-100
    titleText?: string
    h1Text?: string
    recommendations: string[]
  }
  duplicateTitles?: { // NEW: Agency tier - Duplicate title detection
    count: number
    pages: string[]
  }
  ogConflicts?: { // NEW: Agency tier - OG/Twitter conflicts
    titleMismatch: boolean
    descriptionMismatch: boolean
    conflicts: string[]
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
  primaryKeyword?: string,
  siteCategory?: string
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

    // CRITICAL FIX #3: Title length issues - Contextual rules
    // Homepage brand names (like "NASA") are acceptable even if short
    // News articles: 35-60 chars is acceptable
    // Not strict 50-60 requirement
    const isHomepage = page.url === page.url.split('/').slice(0, 3).join('/') || page.url.endsWith('/')
    const isBrandName = page.title && page.title.length < 20 && /^[A-Z\s]+$/.test(page.title.trim())
    const isNewsArticle = page.url.toLowerCase().includes('/news/') || page.url.toLowerCase().includes('/article/')
    
    if (page.titleLength! < 30 && !isHomepage && !isBrandName) {
      // For non-homepage, non-brand pages, flag if very short (< 30)
      issues.push({
        category: 'On-page',
        severity: 'Medium', // Reduced from High
        message: 'Title tag too short',
        details: `Title is ${page.titleLength} characters. Recommended: 35-60 characters for optimal display in search results.`,
        affectedPages: [page.url]
      })
    } else if (page.titleLength! > 70) {
      // Only flag if significantly over (70+ chars), not 60+
      issues.push({
        category: 'On-page',
        severity: 'Low', // Reduced from Medium
        message: 'Title tag too long',
        details: `Title is ${page.titleLength} characters. May be truncated in search results. Recommended: 35-60 characters for best results.`,
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

    // CRITICAL FIX #14: Only flag missing CTA for business/commercial sites
    // Check if page has business-related schema or is a commercial site
    const hasBusinessSchema = page.schemaTypes?.some(t => 
      t.includes('LocalBusiness') || 
      t.includes('Business') || 
      t.includes('Service') ||
      t.includes('Product') ||
      t.includes('Store') ||
      t.includes('Restaurant') ||
      t.includes('Organization')
    ) || false
    
    // Only flag missing CTA for business/commercial sites (not Government/Education/News/Nonprofit)
    const isCommercialSite = !siteCategory || (siteCategory !== 'Government' && siteCategory !== 'Education' && siteCategory !== 'News' && siteCategory !== 'Nonprofit')
    if (!data.metaDescription.hasCallToAction && (hasBusinessSchema || isCommercialSite)) {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'Meta description lacks call-to-action',
        details: 'Add a compelling call-to-action to improve click-through rates from search results.',
        affectedPages: [page.url]
      })
    }
  }

  // NEW: Agency tier - Extract all headings for hierarchy map
  const headingMap: { level: number; text: string; order: number }[] = []
  const headingOrder = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  let headingOrderIndex = 0
  
  headingOrder.forEach((tag, level) => {
    const matches = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'gi')) || []
    matches.forEach(match => {
      const text = match.replace(new RegExp(`<${tag}[^>]*>|</${tag}>`, 'gi'), '').trim()
      if (text.length > 0) {
        headingMap.push({
          level: level + 1,
          text: text.substring(0, 100), // Limit length
          order: headingOrderIndex++
        })
      }
    })
  })
  
  data.headings.hierarchyMap = headingMap
  
  // NEW: Agency tier - Check for proper heading hierarchy
  let hasProperHierarchy = true
  let lastLevel = 0
  for (const heading of headingMap) {
    if (heading.level > lastLevel + 1) {
      // Skipped a level (e.g., H1 -> H3 without H2)
      hasProperHierarchy = false
      break
    }
    lastLevel = heading.level
  }
  data.headings.hasProperHierarchy = hasProperHierarchy
  
  // Count all heading levels
  const h3Matches = html.match(/<h3[^>]*>/gi) || []
  data.headings.h3Count = h3Matches.length
  const h4Matches = html.match(/<h4[^>]*>/gi) || []
  data.headings.h4Count = h4Matches.length
  const h5Matches = html.match(/<h5[^>]*>/gi) || []
  data.headings.h5Count = h5Matches.length
  const h6Matches = html.match(/<h6[^>]*>/gi) || []
  data.headings.h6Count = h6Matches.length

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
  
  // NEW: Agency tier - Title/H1 alignment analysis
  if (page.title && page.h1Text && page.h1Text.length > 0) {
    const titleText = page.title.toLowerCase().trim()
    const h1Text = page.h1Text[0].toLowerCase().trim()
    
    // Calculate similarity (simple word overlap)
    const titleWords = new Set(titleText.split(/\s+/).filter(w => w.length > 2))
    const h1Words = new Set(h1Text.split(/\s+/).filter(w => w.length > 2))
    
    const commonWords = Array.from(titleWords).filter(w => h1Words.has(w))
    const totalUniqueWords = new Set([...titleWords, ...h1Words]).size
    const similarityScore = totalUniqueWords > 0 
      ? Math.round((commonWords.length / totalUniqueWords) * 100)
      : 0
    
    const isAligned = similarityScore >= 30 // At least 30% word overlap
    
    data.titleH1Alignment = {
      isAligned,
      similarityScore,
      titleText: page.title,
      h1Text: page.h1Text[0],
      recommendations: []
    }
    
    if (!isAligned) {
      data.titleH1Alignment.recommendations.push(
        'Title and H1 should be aligned. Consider using similar keywords and phrasing.',
        'H1 should reinforce the main topic stated in the title tag.'
      )
    } else if (similarityScore < 50) {
      data.titleH1Alignment.recommendations.push(
        'Title and H1 could be more closely aligned for better SEO consistency.'
      )
    }
  } else {
    data.titleH1Alignment = {
      isAligned: false,
      similarityScore: 0,
      recommendations: ['Ensure both title tag and H1 exist and are aligned.']
    }
  }
  
  // NEW: Agency tier - Check for improper heading hierarchy
  if (!data.headings.hasProperHierarchy && headingMap.length > 1) {
    issues.push({
      category: 'On-page',
      severity: 'Medium',
      message: 'Improper heading hierarchy',
      details: 'Headings skip levels (e.g., H1 followed by H3 without H2). Maintain proper hierarchy: H1 → H2 → H3 → H4.',
      affectedPages: [page.url]
    })
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
    
    // CRITICAL FIX #13: Only flag stop words if URL is excessively long (8+ words)
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
    const urlWordCount = pathSegments.join('-').split(/[-_]/).filter(w => w.length > 0).length
    data.url.hasStopWords = urlWordCount >= 8 && stopWords.some(word => urlText.includes(word))
    
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

    // CRITICAL FIX #13: Only flag stop words if URL is excessively long (8+ words)
    if (data.url.hasStopWords && urlWordCount >= 8) {
      issues.push({
        category: 'On-page',
        severity: 'Low',
        message: 'URL contains stop words and is excessively long',
        details: `URL has ${urlWordCount} words and contains stop words. Consider removing stop words (the, a, an, etc.) for cleaner URLs.`,
        affectedPages: [page.url]
      })
    }
  } catch {
    // URL parsing failed, skip URL analysis
  }

  // Check for social meta tags
  data.social.hasOpenGraph = /<meta[^>]*property=["']og:/i.test(html)
  data.social.hasTwitterCard = /<meta[^>]*(name|property)=["']twitter:/i.test(html)
  
  // NEW: Agency tier - OG/Twitter conflicts detection
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
  const ogDescriptionMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
  const twitterTitleMatch = html.match(/<meta[^>]*(name|property)=["']twitter:title["'][^>]*content=["']([^"']+)["']/i)
  const twitterDescriptionMatch = html.match(/<meta[^>]*(name|property)=["']twitter:description["'][^>]*content=["']([^"']+)["']/i)
  
  const conflicts: string[] = []
  let titleMismatch = false
  let descriptionMismatch = false
  
  if (page.title && ogTitleMatch) {
    const ogTitle = ogTitleMatch[1].trim()
    const pageTitle = page.title.trim()
    if (ogTitle.toLowerCase() !== pageTitle.toLowerCase()) {
      titleMismatch = true
      conflicts.push(`OG title ("${ogTitle}") differs from page title ("${pageTitle}")`)
    }
  }
  
  if (page.metaDescription && ogDescriptionMatch) {
    const ogDesc = ogDescriptionMatch[1].trim()
    const pageDesc = page.metaDescription.trim()
    if (ogDesc.toLowerCase() !== pageDesc.toLowerCase()) {
      descriptionMismatch = true
      conflicts.push(`OG description differs from meta description`)
    }
  }
  
  if (ogTitleMatch && twitterTitleMatch) {
    const ogTitle = ogTitleMatch[1].trim()
    const twitterTitle = twitterTitleMatch[2] ? twitterTitleMatch[2].trim() : twitterTitleMatch[1].trim()
    if (ogTitle.toLowerCase() !== twitterTitle.toLowerCase()) {
      conflicts.push(`OG title and Twitter title differ`)
    }
  }
  
  if (ogDescriptionMatch && twitterDescriptionMatch) {
    const ogDesc = ogDescriptionMatch[1].trim()
    const twitterDesc = twitterDescriptionMatch[2] ? twitterDescriptionMatch[2].trim() : twitterDescriptionMatch[1].trim()
    if (ogDesc.toLowerCase() !== twitterDesc.toLowerCase()) {
      conflicts.push(`OG description and Twitter description differ`)
    }
  }
  
  if (conflicts.length > 0) {
    data.ogConflicts = {
      titleMismatch,
      descriptionMismatch,
      conflicts
    }
    
    issues.push({
      category: 'On-page',
      severity: 'Low',
      message: 'Social media tag conflicts detected',
      details: conflicts.join('; '),
      affectedPages: [page.url]
    })
  }

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

