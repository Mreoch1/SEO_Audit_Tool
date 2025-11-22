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
  // NEW: Agency tier - Enhanced JS rendering diagnostics
  hydrationIssues?: {
    hasHydrationMismatch: boolean
    missingContentWithJSDisabled: boolean
    criticalContentMissing: string[] // e.g., ['H1', 'main content', 'navigation']
  }
  shadowDOMAnalysis?: {
    hasShadowDOM: boolean
    shadowRootCount: number
    recommendations: string[]
  }
  scriptBundleAnalysis?: {
    totalScriptSize: number
    largeBundles: Array<{ src?: string; size: number; inline: boolean }>
    renderBlockingScripts: number
    recommendations: string[]
  }
  preRenderedVsPostRendered?: {
    h1InInitial: boolean
    h1InRendered: boolean
    mainContentInInitial: boolean
    mainContentInRendered: boolean
    navigationInInitial: boolean
    navigationInRendered: boolean
  }
}

/**
 * Calculate rendering percentage (Enhanced for Agency tier)
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
      hasHighRendering: false,
      hydrationIssues: {
        hasHydrationMismatch: false,
        missingContentWithJSDisabled: true,
        criticalContentMissing: ['All content']
      }
    }
  }
  
  const percentage = ((renderedLength - initialLength) / initialLength) * 100
  const renderingPercentage = Math.max(0, percentage)
  
  // Cap display at 10,000% to avoid confusing extreme values
  // Still flag as high rendering if >100%
  const displayPercentage = Math.min(renderingPercentage, 10000)
  
  // Flag as high rendering if >100% (content doubled or more)
  const hasHighRendering = renderingPercentage > 100
  
  // NEW: Agency tier - Enhanced diagnostics
  const hydrationIssues = analyzeHydrationIssues(initialHtml, renderedHtml)
  const shadowDOMAnalysis = analyzeShadowDOM(renderedHtml)
  const scriptBundleAnalysis = analyzeScriptBundles(initialHtml)
  const preRenderedVsPostRendered = comparePreVsPostRendered(initialHtml, renderedHtml)
  
  return {
    renderingPercentage: Math.round(displayPercentage * 10) / 10, // Round to 1 decimal, capped at 10,000%
    initialHtmlLength: initialLength,
    renderedHtmlLength: renderedLength,
    hasHighRendering,
    hydrationIssues,
    shadowDOMAnalysis,
    scriptBundleAnalysis,
    preRenderedVsPostRendered
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

/**
 * Analyze hydration issues (Agency tier)
 * Detects content that appears only after JavaScript execution
 */
function analyzeHydrationIssues(
  initialHtml: string,
  renderedHtml: string
): LLMReadabilityData['hydrationIssues'] {
  const criticalContentMissing: string[] = []
  let missingContentWithJSDisabled = false
  
  // Check for H1
  const initialH1 = (initialHtml.match(/<h1[^>]*>/gi) || []).length
  const renderedH1 = (renderedHtml.match(/<h1[^>]*>/gi) || []).length
  
  if (initialH1 === 0 && renderedH1 > 0) {
    criticalContentMissing.push('H1 tag')
    missingContentWithJSDisabled = true
  }
  
  // Check for main content
  const initialHasMain = initialHtml.includes('<main') || 
    initialHtml.includes('id="main"') || 
    initialHtml.includes('class="main"') ||
    initialHtml.includes('<article')
  
  const renderedHasMain = renderedHtml.includes('<main') || 
    renderedHtml.includes('id="main"') || 
    renderedHtml.includes('class="main"') ||
    renderedHtml.includes('<article')
  
  if (!initialHasMain && renderedHasMain) {
    criticalContentMissing.push('Main content')
    missingContentWithJSDisabled = true
  }
  
  // Check for navigation
  const initialHasNav = initialHtml.includes('<nav') || 
    initialHtml.includes('id="nav"') || 
    initialHtml.includes('class="nav"')
  
  const renderedHasNav = renderedHtml.includes('<nav') || 
    renderedHtml.includes('id="nav"') || 
    renderedHtml.includes('class="nav"')
  
  if (!initialHasNav && renderedHasNav) {
    criticalContentMissing.push('Navigation')
    missingContentWithJSDisabled = true
  }
  
  // Check for hydration mismatches (React/Next.js specific)
  const hasHydrationMismatch = /hydration.*mismatch|hydration.*error|did not match/i.test(renderedHtml) ||
    renderedHtml.includes('data-reactroot') && !initialHtml.includes('data-reactroot')
  
  return {
    hasHydrationMismatch,
    missingContentWithJSDisabled,
    criticalContentMissing
  }
}

/**
 * Analyze Shadow DOM usage (Agency tier)
 */
function analyzeShadowDOM(renderedHtml: string): LLMReadabilityData['shadowDOMAnalysis'] {
  const hasShadowDOM = /shadowroot|attachshadow|createShadowRoot/i.test(renderedHtml)
  const shadowRootMatches = renderedHtml.match(/shadowroot|attachshadow|createShadowRoot/gi) || []
  const shadowRootCount = shadowRootMatches.length
  
  const recommendations: string[] = []
  
  if (hasShadowDOM) {
    recommendations.push(`Found ${shadowRootCount} Shadow DOM root(s). Shadow DOM content may not be accessible to search engines and LLMs. Consider using regular DOM elements for SEO-critical content.`)
  }
  
  return {
    hasShadowDOM,
    shadowRootCount,
    recommendations
  }
}

/**
 * Analyze script bundles (Agency tier)
 * Identifies large scripts that may slow rendering
 */
function analyzeScriptBundles(html: string): LLMReadabilityData['scriptBundleAnalysis'] {
  const scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || []
  const largeBundles: Array<{ src?: string; size: number; inline: boolean }> = []
  let renderBlockingScripts = 0
  const recommendations: string[] = []
  
  scriptMatches.forEach(script => {
    const isInline = !script.includes('src=')
    const srcMatch = script.match(/src=["']([^"']+)["']/i)
    const src = srcMatch ? srcMatch[1] : undefined
    
    // Estimate size (for inline scripts, use actual length)
    // For external scripts, we can't know the size without fetching, so we'll flag based on patterns
    let size = 0
    if (isInline) {
      size = script.length
    } else {
      // External script - flag if it's a common large bundle pattern
      if (src && (
        src.includes('bundle') || 
        src.includes('vendor') || 
        src.includes('chunk') ||
        src.includes('app.')
      )) {
        size = 100000 // Estimate - would need to fetch to know actual size
      }
    }
    
    // Check if render-blocking (no async/defer)
    const isRenderBlocking = !script.includes('async') && !script.includes('defer') && !isInline
    if (isRenderBlocking) {
      renderBlockingScripts++
    }
    
    // Flag large bundles (>50KB inline or external bundles)
    if (size > 50000) {
      largeBundles.push({ src, size, inline: isInline })
    }
  })
  
  const totalScriptSize = scriptMatches.reduce((sum, script) => {
    if (!script.includes('src=')) {
      return sum + script.length
    }
    return sum + 50000 // Estimate for external scripts
  }, 0)
  
  if (largeBundles.length > 0) {
    recommendations.push(`Found ${largeBundles.length} large script bundle(s). Consider code splitting and lazy loading to improve performance.`)
  }
  
  if (renderBlockingScripts > 0) {
    recommendations.push(`Found ${renderBlockingScripts} render-blocking script(s). Add 'async' or 'defer' attributes to non-critical scripts.`)
  }
  
  return {
    totalScriptSize,
    largeBundles,
    renderBlockingScripts,
    recommendations
  }
}

/**
 * Compare pre-rendered vs post-rendered content (Agency tier)
 */
function comparePreVsPostRendered(
  initialHtml: string,
  renderedHtml: string
): LLMReadabilityData['preRenderedVsPostRendered'] {
  return {
    h1InInitial: (initialHtml.match(/<h1[^>]*>/gi) || []).length > 0,
    h1InRendered: (renderedHtml.match(/<h1[^>]*>/gi) || []).length > 0,
    mainContentInInitial: initialHtml.includes('<main') || 
      initialHtml.includes('id="main"') || 
      initialHtml.includes('class="main"') ||
      initialHtml.includes('<article'),
    mainContentInRendered: renderedHtml.includes('<main') || 
      renderedHtml.includes('id="main"') || 
      renderedHtml.includes('class="main"') ||
      renderedHtml.includes('<article'),
    navigationInInitial: initialHtml.includes('<nav') || 
      initialHtml.includes('id="nav"') || 
      initialHtml.includes('class="nav"'),
    navigationInRendered: renderedHtml.includes('<nav') || 
      renderedHtml.includes('id="nav"') || 
      renderedHtml.includes('class="nav"')
  }
}

