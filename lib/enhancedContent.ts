/**
 * Enhanced Content SEO Analysis
 * 
 * Comprehensive content analysis including:
 * - Content depth and quality metrics
 * - Readability analysis (Flesch Reading Ease, etc.)
 * - Keyword density and distribution
 * - Content freshness and update frequency
 * - Content structure and formatting
 * - Semantic keyword usage
 * - Content uniqueness
 */

import { Issue, PageData } from './types'

export interface EnhancedContentData {
  depth: {
    wordCount: number
    paragraphCount: number
    sentenceCount: number
    averageWordsPerSentence: number
    quality: 'excellent' | 'good' | 'fair' | 'poor'
    depthScore?: number // NEW: Agency tier - Content depth score (0-100)
    industryBenchmark?: 'above' | 'at' | 'below' // NEW: Agency tier - vs industry benchmarks
  }
  readability: {
    fleschScore: number
    gradeLevel: string
    readability: 'very-easy' | 'easy' | 'fairly-easy' | 'standard' | 'fairly-difficult' | 'difficult' | 'very-difficult'
    paragraphLevelReadability?: { // NEW: Agency tier - Paragraph-level readability
      paragraphIndex: number
      fleschScore: number
      wordCount: number
    }[]
  }
  keywords: {
    density: number
    distribution: 'good' | 'fair' | 'poor'
    semanticKeywords: number
    keywordStuffing: boolean
    placement?: { // NEW: Agency tier - Keyword placement analysis
      inTitle: boolean
      inH1: boolean
      inIntro: boolean // First 100 words
      inFirst100Words: boolean
      placementScore: number // 0-100
    }
  }
  structure: {
    hasLists: boolean
    hasTables: boolean
    hasImages: boolean
    paragraphLength: 'good' | 'fair' | 'poor'
    formatting: 'good' | 'fair' | 'poor'
  }
  freshness: {
    lastModified?: string
    updateFrequency: 'frequent' | 'moderate' | 'rare' | 'unknown'
    isFresh?: boolean // NEW: Agency tier - Content freshness detection
    daysSinceUpdate?: number // NEW: Agency tier
  }
  topicCoverage?: { // NEW: Agency tier - Topic coverage map
    topics: string[]
    coverageScore: number // 0-100
    missingTopics?: string[]
  }
  aiContentLikelihood?: { // NEW: Agency tier - AI content detection (optional)
    score: number // 0-100 (higher = more likely AI-generated)
    indicators: string[]
  }
}

/**
 * Calculate Flesch Reading Ease score
 * Score ranges: 90-100 (very easy), 80-89 (easy), 70-79 (fairly easy),
 * 60-69 (standard), 50-59 (fairly difficult), 30-49 (difficult), 0-29 (very difficult)
 */
function calculateFleschReadingEase(text: string): number {
  // CRITICAL FIX #5: Improved sentence splitting to avoid false positives
  // Split on sentence-ending punctuation followed by space or end of string
  // Exclude abbreviations and URLs
  const cleanedText = text
    .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
    .replace(/\b[A-Z]{2,}\b/g, '') // Remove acronyms that might be mistaken for sentence endings
    .replace(/\.{2,}/g, '.') // Normalize multiple periods
  
  // Split sentences more accurately
  const sentenceEndings = cleanedText.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => {
    const trimmed = s.trim()
    // Filter out very short fragments that aren't sentences
    return trimmed.length > 10 && /[.!?]$/.test(trimmed)
  })
  
  const words = cleanedText.split(/\s+/).filter(w => w.length > 0 && /[a-zA-Z]/.test(w))
  const syllables = words.reduce((count, word) => {
    return count + countSyllables(word)
  }, 0)

  // Need at least 1 sentence and 1 word for valid calculation
  if (sentenceEndings.length === 0 || words.length === 0) {
    // If no sentences detected but we have words, assume 1 sentence
    if (words.length > 0) {
      const avgSyllablesPerWord = syllables / words.length
      // Use a conservative estimate: assume reasonable sentence length
      const estimatedSentenceLength = Math.min(words.length, 20)
      const score = 206.835 - (1.015 * estimatedSentenceLength) - (84.6 * avgSyllablesPerWord)
      return Math.max(0, Math.min(100, score))
    }
    return 0
  }

  const avgSentenceLength = words.length / sentenceEndings.length
  const avgSyllablesPerWord = syllables / words.length

  // CRITICAL FIX #5: Cap sentence length more aggressively to prevent unrealistic scores
  // If avg sentence length is > 50, something is wrong with sentence splitting
  const cappedSentenceLength = Math.min(avgSentenceLength, 30) // Reduced from 50 to 30
  const cappedSyllablesPerWord = Math.min(avgSyllablesPerWord, 3)

  const score = 206.835 - (1.015 * cappedSentenceLength) - (84.6 * cappedSyllablesPerWord)
  return Math.max(0, Math.min(100, score))
}

/**
 * Count syllables in a word (approximation)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase()
  if (word.length <= 3) return 1
  
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')
  
  const matches = word.match(/[aeiouy]{1,2}/g)
  return matches ? Math.max(1, matches.length) : 1
}

/**
 * Analyze content with enhanced depth (Enhanced for Agency tier)
 */
export function analyzeEnhancedContent(
  page: PageData,
  html: string,
  primaryKeyword?: string // NEW: Agency tier - Primary keyword for placement analysis
): { data: EnhancedContentData; issues: Issue[] } {
  const issues: Issue[] = []
  const data: EnhancedContentData = {
    depth: {
      wordCount: page.wordCount,
      paragraphCount: 0,
      sentenceCount: 0,
      averageWordsPerSentence: 0,
      quality: 'fair'
    },
    readability: {
      fleschScore: 0,
      gradeLevel: 'unknown',
      readability: 'standard'
    },
    keywords: {
      density: 0,
      distribution: 'fair',
      semanticKeywords: 0,
      keywordStuffing: false
    },
    structure: {
      hasLists: false,
      hasTables: false,
      hasImages: page.imageCount > 0,
      paragraphLength: 'fair',
      formatting: 'fair'
    },
    freshness: {
      updateFrequency: 'unknown'
    }
  }

  // CRITICAL FIX #9 & #11: Extract text content from main content areas, exclude nav/header/footer
  // Prefer <main>, <article>, <section> over full page content
  let mainContent = ''
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const sectionMatches = html.match(/<section[^>]*>([\s\S]*?)<\/section>/gi) || []
  
  if (mainMatch) {
    mainContent = mainMatch[1]
  } else if (articleMatch) {
    mainContent = articleMatch[1]
  } else if (sectionMatches.length > 0) {
    // Use all sections combined
    mainContent = sectionMatches.join(' ')
  } else {
    // Fallback: exclude common nav/header/footer patterns
    mainContent = html
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
  }
  
  // Extract text content (remove HTML tags)
  const textContent = mainContent
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  
  // CRITICAL FIX #1: Update word count from rendered content (if different from page.wordCount)
  // Recalculate word count from extracted main content
  // Use the same word counting method as parseHtml for consistency (filter single-character words)
  const renderedWordCount = textContent
    .split(/\s+/)
    .filter(w => w.length > 0 && w.length > 1) // Filter single-character "words" - same as parseHtml
    .length
  
  // Use rendered word count if it's higher (more accurate), otherwise use page.wordCount
  if (renderedWordCount > 0 && renderedWordCount !== page.wordCount) {
    // Update the data with rendered word count
    data.depth.wordCount = renderedWordCount
  } else {
    // Use page.wordCount if it's already accurate
    data.depth.wordCount = page.wordCount || renderedWordCount
  }
  
  // NEW: Agency tier - Extract first 100 words for keyword placement analysis
  const first100Words = textContent.split(/\s+/).slice(0, 100).join(' ').toLowerCase()
  const introText = first100Words
  
  // NEW: Agency tier - Extract paragraphs for paragraph-level readability
  const paragraphTexts: string[] = []
  const paragraphMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
  paragraphMatches.forEach(para => {
    const paraText = para
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (paraText.length > 20) { // Only include substantial paragraphs
      paragraphTexts.push(paraText)
    }
  })

  // Count paragraphs (use extracted paragraphs if available)
  data.depth.paragraphCount = paragraphTexts.length > 0 ? paragraphTexts.length : (html.match(/<p[^>]*>/gi) || []).length

  // CRITICAL FIX #5: Count sentences more accurately (same logic as Flesch calculation)
  const cleanedText = textContent
    .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
    .replace(/\b[A-Z]{2,}\b/g, '') // Remove acronyms
    .replace(/\.{2,}/g, '.') // Normalize multiple periods
  
  const sentenceEndings = cleanedText.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => {
    const trimmed = s.trim()
    return trimmed.length > 10 && /[.!?]$/.test(trimmed)
  })
  
  data.depth.sentenceCount = Math.max(1, sentenceEndings.length) // At least 1 sentence

  // Calculate average words per sentence
  if (data.depth.sentenceCount > 0) {
    data.depth.averageWordsPerSentence = data.depth.wordCount / data.depth.sentenceCount
  }

  // Assess content quality based on word count
  if (data.depth.wordCount >= 2000) {
    data.depth.quality = 'excellent'
  } else if (data.depth.wordCount >= 1000) {
    data.depth.quality = 'good'
  } else if (data.depth.wordCount >= 300) {
    data.depth.quality = 'fair'
  } else {
    data.depth.quality = 'poor'
  }

  // Calculate readability
  data.readability.fleschScore = calculateFleschReadingEase(textContent)
  
  if (data.readability.fleschScore >= 90) {
    data.readability.readability = 'very-easy'
    data.readability.gradeLevel = '5th grade'
  } else if (data.readability.fleschScore >= 80) {
    data.readability.readability = 'easy'
    data.readability.gradeLevel = '6th grade'
  } else if (data.readability.fleschScore >= 70) {
    data.readability.readability = 'fairly-easy'
    data.readability.gradeLevel = '7th grade'
  } else if (data.readability.fleschScore >= 60) {
    data.readability.readability = 'standard'
    data.readability.gradeLevel = '8th-9th grade'
  } else if (data.readability.fleschScore >= 50) {
    data.readability.readability = 'fairly-difficult'
    data.readability.gradeLevel = '10th-12th grade'
  } else if (data.readability.fleschScore >= 30) {
    data.readability.readability = 'difficult'
    data.readability.gradeLevel = 'College'
  } else {
    data.readability.readability = 'very-difficult'
    data.readability.gradeLevel = 'College graduate'
  }

  // NEW: Agency tier - Keyword placement analysis
  if (primaryKeyword) {
    const keywordLower = primaryKeyword.toLowerCase()
    data.keywords.placement = {
      inTitle: page.title ? page.title.toLowerCase().includes(keywordLower) : false,
      inH1: page.h1Text ? page.h1Text.some(h1 => h1.toLowerCase().includes(keywordLower)) : false,
      inIntro: introText.includes(keywordLower),
      inFirst100Words: first100Words.includes(keywordLower),
      placementScore: 0
    }
    
    // Calculate placement score (0-100)
    let placementScore = 0
    if (data.keywords.placement.inTitle) placementScore += 30
    if (data.keywords.placement.inH1) placementScore += 30
    if (data.keywords.placement.inIntro) placementScore += 20
    if (data.keywords.placement.inFirst100Words) placementScore += 20
    data.keywords.placement.placementScore = placementScore
  }
  
  // NEW: Agency tier - Content depth score (0-100)
  let depthScore = 0
  if (data.depth.wordCount >= 2000) depthScore += 40
  else if (data.depth.wordCount >= 1000) depthScore += 30
  else if (data.depth.wordCount >= 500) depthScore += 20
  else if (data.depth.wordCount >= 300) depthScore += 10
  
  if (data.depth.paragraphCount >= 10) depthScore += 20
  else if (data.depth.paragraphCount >= 5) depthScore += 15
  else if (data.depth.paragraphCount >= 3) depthScore += 10
  
  if (data.structure.hasLists) depthScore += 10
  if (data.structure.hasTables) depthScore += 10
  if (data.structure.hasImages) depthScore += 10
  
  data.depth.depthScore = Math.min(100, depthScore)
  
  // NEW: Agency tier - Industry benchmark comparison (simplified)
  // In production, this would compare against actual industry data
  const industryAvgWordCount = 800 // Simplified benchmark
  if (data.depth.wordCount >= industryAvgWordCount * 1.5) {
    data.depth.industryBenchmark = 'above'
  } else if (data.depth.wordCount >= industryAvgWordCount * 0.8) {
    data.depth.industryBenchmark = 'at'
  } else {
    data.depth.industryBenchmark = 'below'
  }
  
  // NEW: Agency tier - Paragraph-level readability
  if (paragraphTexts.length > 0) {
    data.readability.paragraphLevelReadability = paragraphTexts.slice(0, 10).map((paraText, idx) => ({
      paragraphIndex: idx + 1,
      fleschScore: calculateFleschReadingEase(paraText),
      wordCount: paraText.split(/\s+/).filter(w => w.length > 0).length
    }))
  }
  
  // NEW: Agency tier - Topic coverage analysis
  // Extract topics from headings and key phrases
  const headingTexts = [
    ...(page.h1Text || []),
    ...(html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || []).map(h => h.replace(/<[^>]+>/g, '').trim())
  ]
  const detectedTopics = headingTexts.filter(h => h.length > 3).slice(0, 10)
  
  if (detectedTopics.length > 0) {
    data.topicCoverage = {
      topics: detectedTopics,
      coverageScore: Math.min(100, detectedTopics.length * 10), // Simplified scoring
      missingTopics: [] // Would be populated with expected topics for the industry
    }
  }
  
  // NEW: Agency tier - Content freshness detection
  // Check for last modified date in HTML or meta tags
  const lastModifiedMatch = html.match(/<meta[^>]*name=["']last-modified["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*http-equiv=["']last-modified["'][^>]*content=["']([^"']+)["']/i)
  
  if (lastModifiedMatch) {
    try {
      const lastModified = new Date(lastModifiedMatch[1])
      const daysSinceUpdate = Math.floor((Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24))
      data.freshness.lastModified = lastModified.toISOString()
      data.freshness.daysSinceUpdate = daysSinceUpdate
      data.freshness.isFresh = daysSinceUpdate < 90 // Content is "fresh" if updated within 90 days
      
      if (daysSinceUpdate < 30) {
        data.freshness.updateFrequency = 'frequent'
      } else if (daysSinceUpdate < 180) {
        data.freshness.updateFrequency = 'moderate'
      } else {
        data.freshness.updateFrequency = 'rare'
      }
    } catch (e) {
      // Invalid date format
    }
  }
  
  // NEW: Agency tier - AI content likelihood (basic heuristic)
  // This is a simplified check - production would use more sophisticated analysis
  const aiIndicators: string[] = []
  let aiScore = 0
  
  // Check for repetitive sentence structures
  const aiSentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 10)
  if (aiSentences.length > 5) {
    const avgLength = aiSentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / aiSentences.length
    const lengthVariance = aiSentences.reduce((sum, s) => {
      const len = s.split(/\s+/).length
      return sum + Math.pow(len - avgLength, 2)
    }, 0) / aiSentences.length
    
    if (lengthVariance < 5) { // Very uniform sentence lengths
      aiIndicators.push('Uniform sentence structure')
      aiScore += 20
    }
  }
  
  // Check for excessive use of transition words (AI often overuses these)
  const transitionWords = ['furthermore', 'moreover', 'additionally', 'consequently', 'therefore', 'thus', 'hence']
  const transitionCount = transitionWords.reduce((count, word) => {
    return count + (textContent.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g')) || []).length
  }, 0)
  
  if (transitionCount > aiSentences.length * 0.1) { // More than 10% of sentences have transition words
    aiIndicators.push('Excessive transition words')
    aiScore += 15
  }
  
  // Check for generic phrases
  const genericPhrases = ['it is important to', 'it should be noted', 'in conclusion', 'in summary']
  const genericCount = genericPhrases.reduce((count, phrase) => {
    return count + (textContent.toLowerCase().includes(phrase) ? 1 : 0)
  }, 0)
  
  if (genericCount >= 2) {
    aiIndicators.push('Generic phrases detected')
    aiScore += 10
  }
  
  if (aiScore > 0) {
    data.aiContentLikelihood = {
      score: Math.min(100, aiScore),
      indicators: aiIndicators
    }
  }
  
  // Check for lists and tables
  data.structure.hasLists = /<(ul|ol)[^>]*>/i.test(html)
  data.structure.hasTables = /<table[^>]*>/i.test(html)

  // Analyze paragraph length (using already extracted paragraphTexts)
  const avgParagraphLength = data.depth.paragraphCount > 0 
    ? data.depth.wordCount / data.depth.paragraphCount 
    : 0

  if (avgParagraphLength >= 50 && avgParagraphLength <= 150) {
    data.structure.paragraphLength = 'good'
  } else if (avgParagraphLength > 200) {
    data.structure.paragraphLength = 'poor'
  }

  // Check formatting quality
  const hasHeadings = page.h1Count > 0 || page.h2Count > 0
  const hasImages = data.structure.hasImages
  const hasLists = data.structure.hasLists
  
  if (hasHeadings && hasImages && (hasLists || data.structure.hasTables)) {
    data.structure.formatting = 'good'
  } else if (hasHeadings && (hasImages || hasLists)) {
    data.structure.formatting = 'fair'
  } else {
    data.structure.formatting = 'poor'
  }

  // Generate issues based on analysis
  if (data.depth.wordCount < 300) {
    issues.push({
      category: 'Content',
      severity: 'High',
      message: 'Thin content',
      details: `Page has only ${data.depth.wordCount} words. Aim for at least 300 words for basic pages, 1000+ for comprehensive content.`,
      affectedPages: [page.url]
    })
  } else if (data.depth.wordCount < 500) {
    issues.push({
      category: 'Content',
      severity: 'Medium',
      message: 'Content could be more comprehensive',
      details: `Page has ${data.depth.wordCount} words. Consider expanding to 500+ words for better SEO value.`,
      affectedPages: [page.url]
    })
  }

  if (data.readability.fleschScore < 30) {
    issues.push({
      category: 'Content',
      severity: 'Medium',
      message: 'Content is very difficult to read',
      details: `Flesch Reading Ease score: ${Math.round(data.readability.fleschScore)}. Aim for 60+ for general audiences. Simplify sentence structure and use shorter words.`,
      affectedPages: [page.url]
    })
  } else if (data.readability.fleschScore < 50) {
    issues.push({
      category: 'Content',
      severity: 'Low',
      message: 'Content readability could be improved',
      details: `Flesch Reading Ease score: ${Math.round(data.readability.fleschScore)}. Consider simplifying language for broader audience appeal.`,
      affectedPages: [page.url]
    })
  }

  if (data.depth.averageWordsPerSentence > 20) {
    issues.push({
      category: 'Content',
      severity: 'Low',
      message: 'Sentences are too long',
      details: `Average sentence length is ${Math.round(data.depth.averageWordsPerSentence)} words. Aim for 15-20 words per sentence for better readability.`,
      affectedPages: [page.url]
    })
  }

  if (data.depth.paragraphCount === 0 && data.depth.wordCount > 100) {
    issues.push({
      category: 'Content',
      severity: 'Medium',
      message: 'Content not structured with paragraphs',
      details: 'Break content into paragraphs for better readability and user experience.',
      affectedPages: [page.url]
    })
  }

  if (!data.structure.hasLists && data.depth.wordCount > 500) {
    issues.push({
      category: 'Content',
      severity: 'Low',
      message: 'Content could benefit from lists',
      details: 'Use bulleted or numbered lists to break up long text and improve scannability.',
      affectedPages: [page.url]
    })
  }

  if (data.structure.paragraphLength === 'poor') {
    issues.push({
      category: 'Content',
      severity: 'Low',
      message: 'Paragraphs are too long',
      details: 'Break long paragraphs into shorter ones (3-5 sentences) for better readability.',
      affectedPages: [page.url]
    })
  }

  if (!data.structure.hasImages && data.depth.wordCount > 800) {
    issues.push({
      category: 'Content',
      severity: 'Low',
      message: 'Long content without images',
      details: 'Add relevant images to break up text and improve engagement. Images should be optimized with alt text.',
      affectedPages: [page.url]
    })
  }

  return { data, issues }
}

/**
 * Generate actionable fix instructions for content issues
 */
export function getContentFixInstructions(issue: Issue): string {
  const message = issue.message.toLowerCase()
  
  if (message.includes('thin content')) {
    return `1. Expand content to at least 300 words for basic pages
2. Aim for 1000+ words for comprehensive, authoritative content
3. Add more detail, examples, and explanations
4. Include FAQs, case studies, or related information
5. Break content into logical sections with headings
6. Add supporting images, charts, or infographics
7. Consider creating a content calendar for regular updates`
  }
  
  if (message.includes('readability') || message.includes('difficult to read')) {
    return `1. Simplify sentence structure - aim for 15-20 words per sentence
2. Use shorter, more common words instead of complex vocabulary
3. Break long sentences into shorter ones
4. Use active voice instead of passive voice
5. Add transition words to connect ideas
6. Use bullet points and lists for complex information
7. Test readability using tools like Hemingway Editor
8. Aim for Flesch Reading Ease score of 60+ for general audiences`
  }
  
  if (message.includes('sentence')) {
    return `1. Break long sentences into shorter ones
2. Aim for 15-20 words per sentence on average
3. Remove unnecessary clauses and phrases
4. Use commas and semicolons appropriately
5. Read sentences aloud to check natural flow
6. Use sentence variety - mix short and medium sentences`
  }
  
  if (message.includes('paragraph')) {
    return `1. Break content into paragraphs of 3-5 sentences
2. Each paragraph should focus on one main idea
3. Use topic sentences to introduce each paragraph
4. Keep paragraphs to 50-150 words when possible
5. Add white space between paragraphs for readability
6. Use paragraph breaks to create visual breathing room`
  }
  
  if (message.includes('list')) {
    return `1. Use bulleted lists for unordered items
2. Use numbered lists for sequential steps
3. Keep list items concise (one line when possible)
4. Use parallel structure in list items
5. Introduce lists with a brief sentence
6. Limit lists to 5-7 items for readability
7. Break very long lists into multiple shorter lists`
  }
  
  if (message.includes('image')) {
    return `1. Add relevant images every 300-500 words
2. Use high-quality, optimized images
3. Include descriptive alt text for all images
4. Use images to illustrate key points
5. Add captions to images when helpful
6. Ensure images are properly sized (not too large)
7. Use lazy loading for images below the fold
8. Consider infographics for complex data`
  }
  
  return `Review the content issue and implement improvements based on best practices for web content. Focus on user experience and readability.`
}

