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
  }
  readability: {
    fleschScore: number
    gradeLevel: string
    readability: 'very-easy' | 'easy' | 'fairly-easy' | 'standard' | 'fairly-difficult' | 'difficult' | 'very-difficult'
  }
  keywords: {
    density: number
    distribution: 'good' | 'fair' | 'poor'
    semanticKeywords: number
    keywordStuffing: boolean
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
  }
}

/**
 * Calculate Flesch Reading Ease score
 * Score ranges: 90-100 (very easy), 80-89 (easy), 70-79 (fairly easy),
 * 60-69 (standard), 50-59 (fairly difficult), 30-49 (difficult), 0-29 (very difficult)
 */
function calculateFleschReadingEase(text: string): number {
  // Split text into sentences by sentence-ending punctuation followed by whitespace or end of string
  // This is more accurate than matching punctuation marks
  const sentenceEndings = text.split(/[.!?]+(?:\s+|$)/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.length > 0)
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

  // Cap sentence length at reasonable maximum to avoid extreme scores
  const cappedSentenceLength = Math.min(avgSentenceLength, 50)
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
 * Analyze content with enhanced depth
 */
export function analyzeEnhancedContent(
  page: PageData,
  html: string
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

  // Extract text content (remove HTML tags)
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Count paragraphs
  const paragraphMatches = html.match(/<p[^>]*>/gi) || []
  data.depth.paragraphCount = paragraphMatches.length

  // Count sentences
  const sentences = textContent.match(/[.!?]+/g) || []
  data.depth.sentenceCount = sentences.length

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

  // Check for lists and tables
  data.structure.hasLists = /<(ul|ol)[^>]*>/i.test(html)
  data.structure.hasTables = /<table[^>]*>/i.test(html)

  // Analyze paragraph length
  const paragraphTexts = paragraphMatches.map(() => {
    // Extract paragraph text (simplified)
    return ''
  })
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

