/**
 * AI Assistant Wrapper for SEO Audit Pro
 * 
 * Handles API calls to DeepSeek (or other LLMs) for:
 * - Competitor detection
 * - Executive summaries
 * - Priority action plans
 * - Keyword opportunities
 * - Content rewrite suggestions
 */

import { AIResponse, getCompetitorDetectionPrompt, getExecutiveSummaryPrompt, getPriorityActionPlanPrompt, getKeywordOpportunityPrompt } from './aiPrompts'

/**
 * Configuration for AI API
 */
interface AIConfig {
  provider: 'deepseek' | 'openai' | 'anthropic'
  apiKey?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AIConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  temperature: 0.3, // Lower temperature for more consistent, factual output
  maxTokens: 2000
}

/**
 * Call AI API with prompt
 */
export async function callAI(
  prompt: string,
  config: Partial<AIConfig> = {}
): Promise<AIResponse> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const apiKey = finalConfig.apiKey || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.warn('[AI] No API key found, returning empty response')
    return getEmptyResponse('AI API key not configured')
  }

  try {
    if (finalConfig.provider === 'deepseek') {
      return await callDeepSeek(prompt, apiKey, finalConfig)
    } else if (finalConfig.provider === 'openai') {
      return await callOpenAI(prompt, apiKey, finalConfig)
    } else {
      throw new Error(`Unsupported AI provider: ${finalConfig.provider}`)
    }
  } catch (error) {
    console.error('[AI] Error calling AI API:', error)
    return getEmptyResponse(`AI API error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Call DeepSeek API
 */
async function callDeepSeek(
  prompt: string,
  apiKey: string,
  config: AIConfig
): Promise<AIResponse> {
  const model = config.model || 'deepseek-chat'
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant that outputs valid JSON only. Always follow the exact output format specified in the prompt.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: config.temperature || 0.3,
      max_tokens: config.maxTokens || 2000,
      response_format: { type: 'json_object' } // Force JSON output
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No content in AI response')
  }

  // Parse JSON response
  try {
    const parsed = JSON.parse(content)
    return validateAIResponse(parsed)
  } catch (parseError) {
    console.error('[AI] Failed to parse JSON response:', content)
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        return validateAIResponse(parsed)
      } catch {
        // Fall through to error
      }
    }
    throw new Error('Invalid JSON response from AI')
  }
}

/**
 * Call OpenAI API (fallback)
 */
async function callOpenAI(
  prompt: string,
  apiKey: string,
  config: AIConfig
): Promise<AIResponse> {
  const model = config.model || 'gpt-4o-mini'
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant that outputs valid JSON only. Always follow the exact output format specified in the prompt.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: config.temperature || 0.3,
      max_tokens: config.maxTokens || 2000,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No content in AI response')
  }

  try {
    const parsed = JSON.parse(content)
    return validateAIResponse(parsed)
  } catch (parseError) {
    console.error('[AI] Failed to parse JSON response:', content)
    throw new Error('Invalid JSON response from AI')
  }
}

/**
 * Validate and normalize AI response
 */
function validateAIResponse(data: any): AIResponse {
  return {
    competitors: Array.isArray(data.competitors) 
      ? data.competitors.map((c: any) => ({
          domain: String(c.domain || c.url || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
          reason: String(c.reason || c.explanation || '')
        }))
      : [],
    executiveSummary: String(data.executiveSummary || ''),
    priorityActions: String(data.priorityActions || ''),
    keywordOpportunities: String(data.keywordOpportunities || ''),
    rewriteSuggestions: String(data.rewriteSuggestions || ''),
    notes: String(data.notes || '')
  }
}

/**
 * Get empty response with note
 */
function getEmptyResponse(note: string): AIResponse {
  return {
    competitors: [],
    executiveSummary: '',
    priorityActions: '',
    keywordOpportunities: '',
    rewriteSuggestions: '',
    notes: note
  }
}

/**
 * Detect competitors using AI
 */
export async function detectCompetitorsWithAI(data: {
  keywords: string[]
  topics?: string[]
  businessType?: string
  schemaTypes?: string[]
  location?: string
  siteUrl?: string
}, config?: Partial<AIConfig>): Promise<AIResponse> {
  const prompt = getCompetitorDetectionPrompt(data)
  return await callAI(prompt, config)
}

/**
 * Generate executive summary using AI
 */
export async function generateExecutiveSummaryWithAI(data: {
  overallScore: number
  categoryScores: {
    technical: number
    onPage: number
    content: number
    accessibility: number
  }
  highPriorityIssues: number
  mediumPriorityIssues: number
  lowPriorityIssues: number
  totalPages: number
  keyFindings: string[]
}, config?: Partial<AIConfig>): Promise<AIResponse> {
  const prompt = getExecutiveSummaryPrompt(data)
  return await callAI(prompt, config)
}

/**
 * Generate priority action plan using AI
 */
export async function generatePriorityActionPlanWithAI(data: {
  highPriorityIssues: Array<{ title: string; category: string; affectedPages: number }>
  mediumPriorityIssues: Array<{ title: string; category: string; affectedPages: number }>
}, config?: Partial<AIConfig>): Promise<AIResponse> {
  const prompt = getPriorityActionPlanPrompt(data)
  return await callAI(prompt, config)
}

/**
 * Analyze keyword opportunities using AI
 */
export async function analyzeKeywordOpportunitiesWithAI(data: {
  siteKeywords: string[]
  competitorKeywords: string[]
  keywordGaps: string[]
  sharedKeywords: string[]
}, config?: Partial<AIConfig>): Promise<AIResponse> {
  const prompt = getKeywordOpportunityPrompt(data)
  return await callAI(prompt, config)
}

