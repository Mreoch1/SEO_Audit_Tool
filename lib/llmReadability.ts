/**
 * LLM Readability Analysis
 * 
 * Measures rendering percentage to detect dynamically rendered content
 * that may be missed by LLMs and search engines.
 */

import { Issue } from './types'

export interface LLMReadabilityData {
  renderingPercentage: number
  initialHtmlLength: number
  renderedHtmlLength: number
  hasHighRendering: boolean
}

/**
 * Calculate rendering percentage
 * 
 * Compares initial HTML (before JS) vs rendered HTML (after JS)
 * High rendering percentage (>100%) indicates significant JS-rendered content
 */
export function calculateRenderingPercentage(
  initialHtml: string,
  renderedHtml: string
): LLMReadabilityData {
  const initialLength = initialHtml.length
  const renderedLength = renderedHtml.length
  
  if (initialLength === 0) {
    return {
      renderingPercentage: 0,
      initialHtmlLength: 0,
      renderedHtmlLength: renderedLength,
      hasHighRendering: false
    }
  }
  
  const percentage = ((renderedLength - initialLength) / initialLength) * 100
  const renderingPercentage = Math.max(0, percentage)
  
  // Cap display at 10,000% to avoid confusing extreme values
  // Still flag as high rendering if >100%
  const displayPercentage = Math.min(renderingPercentage, 10000)
  
  // Flag as high rendering if >100% (content doubled or more)
  const hasHighRendering = renderingPercentage > 100
  
  return {
    renderingPercentage: Math.round(displayPercentage * 10) / 10, // Round to 1 decimal, capped at 10,000%
    initialHtmlLength: initialLength,
    renderedHtmlLength: renderedLength,
    hasHighRendering
  }
}

/**
 * Generate LLM Readability issues
 */
export function generateLLMReadabilityIssues(
  url: string,
  data: LLMReadabilityData
): Issue[] {
  const issues: Issue[] = []
  
  if (data.hasHighRendering) {
    const severity = data.renderingPercentage > 150 ? 'High' : 'Medium'
    const displayPercent = data.renderingPercentage >= 10000 ? '10,000%+' : `${data.renderingPercentage}%`
    
    issues.push({
      category: 'Technical',
      severity,
      message: 'High rendering percentage (LLM Readability)',
      details: `Rendering percentage: ${displayPercent}. Your page has a high level of rendering (changes to the HTML). Dynamically rendering a lot of page content risks some important information being missed by LLMs that generally do not read this content. Consider server-side rendering for critical content.`,
      affectedPages: [url]
    })
  } else if (data.renderingPercentage > 50) {
    issues.push({
      category: 'Technical',
      severity: 'Low',
      message: 'Moderate rendering percentage',
      details: `Rendering percentage: ${data.renderingPercentage}%. Some content is dynamically rendered. Consider server-side rendering for critical content to ensure LLMs can access it.`,
      affectedPages: [url]
    })
  }
  
  return issues
}

/**
 * Analyze content visibility for LLMs
 * 
 * Checks if critical content is in initial HTML vs rendered HTML
 */
export function analyzeContentVisibility(
  initialHtml: string,
  renderedHtml: string
): {
  criticalContentInInitial: boolean
  recommendations: string[]
} {
  const recommendations: string[] = []
  
  // Check if main content is in initial HTML
  const initialHasMainContent = 
    initialHtml.includes('<main') ||
    initialHtml.includes('id="main"') ||
    initialHtml.includes('class="main"') ||
    initialHtml.includes('<article')
  
  const renderedHasMainContent = 
    renderedHtml.includes('<main') ||
    renderedHtml.includes('id="main"') ||
    renderedHtml.includes('class="main"') ||
    renderedHtml.includes('<article')
  
  if (!initialHasMainContent && renderedHasMainContent) {
    recommendations.push('Main content is rendered via JavaScript. Consider server-side rendering for better LLM accessibility.')
  }
  
  // Check for H1 in initial vs rendered
  const initialH1Count = (initialHtml.match(/<h1[^>]*>/gi) || []).length
  const renderedH1Count = (renderedHtml.match(/<h1[^>]*>/gi) || []).length
  
  if (initialH1Count === 0 && renderedH1Count > 0) {
    recommendations.push('H1 tag is rendered via JavaScript. Move H1 to initial HTML for better SEO.')
  }
  
  return {
    criticalContentInInitial: initialHasMainContent && initialH1Count > 0,
    recommendations
  }
}

