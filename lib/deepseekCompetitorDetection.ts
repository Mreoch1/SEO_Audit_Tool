/**
 * DeepSeek Competitor Detection Module
 * 
 * Automatically identifies competitors when client doesn't provide any.
 * Uses DeepSeek LLM to analyze the site and generate real competitor URLs.
 */

export interface IndustryAnalysis {
  industry: string
  subIndustry?: string
  niche?: string
  targetAudience?: string
  businessType?: string
}

export interface CompetitorSuggestion {
  url: string
  name?: string
  reason?: string
  confidence?: number
}

export interface CompetitorDetectionResult {
  industry: IndustryAnalysis
  competitors: CompetitorSuggestion[]
  detectionMethod: 'deepseek' | 'fallback' | 'user_provided'
}

/**
 * Analyze website to determine industry/niche using DeepSeek
 */
export async function analyzeIndustryWithDeepSeek(
  url: string,
  siteContent?: { title?: string; description?: string; headings?: string[] }
): Promise<IndustryAnalysis> {
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY
  
  if (!deepseekApiKey) {
    console.warn('[DeepSeek] API key not configured, using fallback')
    return getFallbackIndustry(url)
  }

  try {
    // Build context from site content if available
    const context = siteContent 
      ? `Title: ${siteContent.title || 'N/A'}\nDescription: ${siteContent.description || 'N/A'}\nHeadings: ${(siteContent.headings || []).slice(0, 5).join(', ')}`
      : `Website URL: ${url}`

    const prompt = `Analyze the website at ${url} and determine the business category, niche, and target audience.

${context}

Produce a short machine-readable JSON response with these exact fields:
{
  "industry": "main industry category",
  "subIndustry": "more specific subcategory if applicable",
  "niche": "specific niche or specialization",
  "targetAudience": "primary target audience",
  "businessType": "B2B, B2C, or B2B2C"
}

Only return valid JSON, no additional text.`

    // CRITICAL FIX: Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a business analyst that identifies industry categories and niches from website analysis. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 300
      }),
      signal: controller.signal
    }).finally(() => {
      clearTimeout(timeoutId)
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('No content in DeepSeek response')
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in DeepSeek response')
    }

    const analysis = JSON.parse(jsonMatch[0]) as IndustryAnalysis
    
    console.log(`[DeepSeek] Industry analysis: ${analysis.industry}${analysis.subIndustry ? ` / ${analysis.subIndustry}` : ''}`)
    
    return analysis
  } catch (error) {
    console.warn(`[DeepSeek] Industry analysis failed: ${error instanceof Error ? error.message : String(error)}`)
    return getFallbackIndustry(url)
  }
}

/**
 * Generate competitor URLs using DeepSeek
 */
export async function generateCompetitorUrlsWithDeepSeek(
  industry: IndustryAnalysis,
  maxCompetitors: number = 5
): Promise<CompetitorSuggestion[]> {
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY
  
  if (!deepseekApiKey) {
    console.warn('[DeepSeek] API key not configured, using fallback')
    return getFallbackCompetitors(industry)
  }

  try {
    const prompt = `Based on the niche "${industry.niche || industry.subIndustry || industry.industry}", list the top ${maxCompetitors} real competitors with active URLs.

Industry: ${industry.industry}
${industry.subIndustry ? `Sub-industry: ${industry.subIndustry}` : ''}
${industry.niche ? `Niche: ${industry.niche}` : ''}

Only include legitimate businesses in the same category. Provide real, active URLs.

Return JSON in this exact format:
{
  "competitors": [
    {
      "url": "https://example.com",
      "name": "Company Name",
      "reason": "Brief reason why this is a competitor"
    }
  ]
}

Only return valid JSON, no additional text.`

    // CRITICAL FIX: Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a business intelligence tool that identifies real competitor websites. Always provide actual, active URLs. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 500
      }),
      signal: controller.signal
    }).finally(() => {
      clearTimeout(timeoutId)
    })

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('No content in DeepSeek response')
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in DeepSeek response')
    }

    const result = JSON.parse(jsonMatch[0]) as { competitors: CompetitorSuggestion[] }
    
    console.log(`[DeepSeek] Generated ${result.competitors.length} competitor suggestions`)
    
    return result.competitors || []
  } catch (error) {
    console.warn(`[DeepSeek] Competitor generation failed: ${error instanceof Error ? error.message : String(error)}`)
    return getFallbackCompetitors(industry)
  }
}

/**
 * Validate competitor URLs (check if they're reachable)
 */
export async function validateCompetitorUrls(
  competitors: CompetitorSuggestion[]
): Promise<CompetitorSuggestion[]> {
  const validated: CompetitorSuggestion[] = []
  
  for (const competitor of competitors) {
    try {
      // Try HEAD request first (faster)
      const response = await fetch(competitor.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'SEO-Audit-Bot/1.0' },
        redirect: 'follow'
      })
      
      if (response.ok || response.status === 403 || response.status === 401) {
        // 403/401 might be bot blocking, but site exists - include it
        validated.push(competitor)
        console.log(`[DeepSeek] ✅ Validated: ${competitor.url}`)
      } else if (response.status >= 400 && response.status < 500) {
        // 4xx errors - skip
        console.log(`[DeepSeek] ❌ Skipping ${competitor.url}: HTTP ${response.status}`)
      } else {
        // 5xx or other - might be temporary, include it
        validated.push(competitor)
        console.log(`[DeepSeek] ⚠️ Including ${competitor.url} despite HTTP ${response.status}`)
      }
    } catch (error) {
      // Network error, timeout, or invalid URL - skip
      console.log(`[DeepSeek] ❌ Skipping ${competitor.url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  // Deduplicate by URL
  const seen = new Set<string>()
  const unique = validated.filter(c => {
    const normalized = new URL(c.url).hostname.toLowerCase()
    if (seen.has(normalized)) {
      return false
    }
    seen.add(normalized)
    return true
  })
  
  console.log(`[DeepSeek] Validated ${unique.length}/${competitors.length} competitor URLs`)
  
  return unique
}

/**
 * Main function: Auto-detect competitors when none provided
 */
export async function autoDetectCompetitors(
  url: string,
  siteContent?: { title?: string; description?: string; headings?: string[] },
  maxCompetitors: number = 5
): Promise<CompetitorDetectionResult> {
  console.log('[DeepSeek] Starting automatic competitor detection...')
  
  // Step 1: Analyze industry
  const industry = await analyzeIndustryWithDeepSeek(url, siteContent)
  
  // Step 2: Generate competitor URLs
  const suggestions = await generateCompetitorUrlsWithDeepSeek(industry, maxCompetitors)
  
  // Step 3: Validate URLs
  const validated = await validateCompetitorUrls(suggestions)
  
  return {
    industry,
    competitors: validated,
    detectionMethod: validated.length > 0 ? 'deepseek' : 'fallback'
  }
}

/**
 * Fallback: Get industry from URL/domain analysis
 */
function getFallbackIndustry(url: string): IndustryAnalysis {
  const hostname = new URL(url).hostname.toLowerCase()
  
  // Simple keyword-based detection
  if (hostname.includes('seo') || hostname.includes('audit')) {
    return {
      industry: 'SEO Software',
      subIndustry: 'Website Auditing Tools',
      niche: 'Technical SEO Automation'
    }
  }
  
  // Add more fallback patterns as needed
  return {
    industry: 'Unknown',
    niche: 'General Business'
  }
}

/**
 * Fallback: Get competitors from industry taxonomy
 */
function getFallbackCompetitors(industry: IndustryAnalysis): CompetitorSuggestion[] {
  const industryLower = industry.industry.toLowerCase()
  const nicheLower = (industry.niche || industry.subIndustry || '').toLowerCase()
  
  // SEO Auditing Tools
  if (industryLower.includes('seo') || nicheLower.includes('seo audit')) {
    return [
      { url: 'https://ahrefs.com', name: 'Ahrefs', reason: 'SEO tool suite' },
      { url: 'https://semrush.com', name: 'SEMrush', reason: 'SEO and marketing platform' },
      { url: 'https://screamingfrog.co.uk', name: 'Screaming Frog', reason: 'SEO spider tool' },
      { url: 'https://sitebulb.com', name: 'Sitebulb', reason: 'SEO auditing software' },
      { url: 'https://seobility.net', name: 'Seobility', reason: 'SEO checker tool' }
    ]
  }
  
  // Add more industry-specific fallbacks as needed
  // For now, return empty array if no match
  console.warn(`[DeepSeek] No fallback competitors for industry: ${industry.industry}`)
  return []
}

