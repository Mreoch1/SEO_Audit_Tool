/**
 * LLM Readability Analysis
 * 
 * Measures rendering percentage to detect dynamically rendered content
 * that may be missed by LLMs and search engines.
 */

import { Issue } from './types'

export interface LLMReadabilityData {
  renderingPercentage: number
  similarity: number // NEW: Similarity percentage (0-100)
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
  // NEW: Content analysis for LLM accessibility
  contentAnalysis?: {
    textContentInInitial: number // Character count of visible text in initial HTML
    textContentInRendered: number // Character count of visible text in rendered HTML
    criticalElementsMissing: string[] // Elements that appear only in rendered HTML
    recommendations: string[]
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
  
  // CRITICAL FIX: Rewritten rendering percentage and similarity calculation
  // Rendering percentage = percentage of content ADDED via JavaScript (relative to initial)
  // Similarity = percentage of initial HTML that remains in rendered HTML (content overlap)
  
  let renderingPercentage: number
  let similarity: number
  
  if (renderedLength >= initialLength) {
    // Content was ADDED via JavaScript (most common case)
    // Rendering percentage = how much was added relative to initial
    renderingPercentage = ((renderedLength - initialLength) / initialLength) * 100
    // Similarity = how much of initial HTML is still present in rendered
    // Use a simple ratio: initial/rendered (if rendered is 2x initial, similarity is 50%)
    similarity = (initialLength / renderedLength) * 100
  } else {
    // Rendered is SMALLER than initial (rare - usually means content was removed or minified)
    // This shouldn't happen for normal JS-rendered sites, but handle gracefully
    // Rendering percentage = 0% (no content was added via JS, actually reduced)
    // CRITICAL FIX: Always set to 0 when rendered < initial (don't calculate negative percentage)
    renderingPercentage = 0
    // Similarity = how much of rendered matches initial (percentage of initial that's still present)
    similarity = (renderedLength / initialLength) * 100
  }
  
  // CRITICAL FIX: Ensure rendering percentage is non-negative (should already be, but double-check)
  // Rendering percentage should never be negative - if rendered < initial, it's 0%
  renderingPercentage = Math.max(0, renderingPercentage)
  
  // Cap display at 10,000% to avoid confusing extreme values for very JS-heavy sites
  // Still flag as high rendering if >100%
  const displayPercentage = Math.min(renderingPercentage, 10000)
  
  // Flag as high rendering if >100% (content doubled or more via JavaScript)
  // Also flag if similarity is low (<50%) - means most content is JS-rendered
  const hasHighRendering = renderingPercentage > 100 || similarity < 50
  
  // NEW: Agency tier - Enhanced diagnostics
  const hydrationIssues = analyzeHydrationIssues(initialHtml, renderedHtml)
  const shadowDOMAnalysis = analyzeShadowDOM(renderedHtml)
  const scriptBundleAnalysis = analyzeScriptBundles(initialHtml)
  const preRenderedVsPostRendered = comparePreVsPostRendered(initialHtml, renderedHtml)
  
  // Enhanced content analysis
  const contentAnalysis = analyzeContentForLLMs(initialHtml, renderedHtml)
  
  return {
    renderingPercentage: Math.round(displayPercentage * 10) / 10, // Round to 1 decimal, capped at 10,000%
    similarity: Math.round(similarity * 10) / 10, // Round to 1 decimal
    initialHtmlLength: initialLength,
    renderedHtmlLength: renderedLength,
    hasHighRendering,
    hydrationIssues,
    shadowDOMAnalysis,
    scriptBundleAnalysis,
    preRenderedVsPostRendered,
    contentAnalysis
  }
}

/**
 * Generate LLM Readability issues with enhanced diagnostics
 */
export function generateLLMReadabilityIssues(
  url: string,
  data: LLMReadabilityData
): Issue[] {
  const issues: Issue[] = []
  
  // High rendering percentage issue
  if (data.hasHighRendering) {
    const severity = data.renderingPercentage > 150 ? 'High' : 'Medium'
    const displayPercent = data.renderingPercentage >= 10000 ? '10,000%+' : `${data.renderingPercentage}%`
    
    let details = `Rendering percentage: ${displayPercent}. Your page has a high level of JavaScript rendering (significant HTML changes after page load). `
    
    // Add specific content issues
    if (data.hydrationIssues?.criticalContentMissing && data.hydrationIssues.criticalContentMissing.length > 0) {
      details += `Critical content missing from initial HTML: ${data.hydrationIssues.criticalContentMissing.join(', ')}. `
    }
    
    details += `Dynamically rendered content may be missed by LLMs and search engines. Consider server-side rendering (SSR) or static site generation (SSG) for critical content.`
    
    issues.push({
      category: 'Technical',
      severity,
      message: 'High rendering percentage (LLM Readability)',
      details,
      affectedPages: [url]
    })
  } else if (data.renderingPercentage > 50) {
    let details = `Rendering percentage: ${data.renderingPercentage}%. Some content is dynamically rendered. `
    
    if (data.hydrationIssues?.criticalContentMissing && data.hydrationIssues.criticalContentMissing.length > 0) {
      details += `Note: ${data.hydrationIssues.criticalContentMissing.join(', ')} ${data.hydrationIssues.criticalContentMissing.length === 1 ? 'is' : 'are'} rendered via JavaScript. `
    }
    
    details += `Consider server-side rendering for critical content to ensure LLMs can access it.`
    
    issues.push({
      category: 'Technical',
      severity: 'Low',
      message: 'Moderate rendering percentage',
      details,
      affectedPages: [url]
    })
  }
  
  // Missing critical content issue
  if (data.hydrationIssues?.missingContentWithJSDisabled && data.hydrationIssues.criticalContentMissing.length > 0) {
    const missingItems = data.hydrationIssues.criticalContentMissing.join(', ')
    issues.push({
      category: 'Technical',
      severity: data.renderingPercentage > 50 ? 'High' : 'Medium',
      message: `Critical content rendered via JavaScript: ${missingItems}`,
      details: `${missingItems} ${data.hydrationIssues.criticalContentMissing.length === 1 ? 'is' : 'are'} not present in the initial HTML and only appear after JavaScript execution. This content may not be accessible to LLMs, search engine crawlers, or users with JavaScript disabled. Move this content to the initial HTML or use server-side rendering.`,
      affectedPages: [url]
    })
  }
  
  // Shadow DOM issue
  if (data.shadowDOMAnalysis?.hasShadowDOM) {
    issues.push({
      category: 'Technical',
      severity: 'Medium',
      message: `Shadow DOM detected (${data.shadowDOMAnalysis.shadowRootCount} root(s))`,
      details: `Shadow DOM content may not be accessible to search engines and LLMs. Consider using regular DOM elements for SEO-critical content. ${data.shadowDOMAnalysis.recommendations.join(' ')}`,
      affectedPages: [url]
    })
  }
  
  // Render-blocking scripts issue
  if (data.scriptBundleAnalysis && data.scriptBundleAnalysis.renderBlockingScripts > 0) {
    issues.push({
      category: 'Performance',
      severity: 'Medium',
      message: `${data.scriptBundleAnalysis.renderBlockingScripts} render-blocking script(s) detected`,
      details: `Render-blocking scripts delay content visibility and can impact LLM accessibility. Add 'async' or 'defer' attributes to non-critical scripts, or move them to the end of the document. ${data.scriptBundleAnalysis.recommendations.join(' ')}`,
      affectedPages: [url]
    })
  }
  
  // Large script bundles issue
  if (data.scriptBundleAnalysis && data.scriptBundleAnalysis.largeBundles.length > 0) {
    const totalSize = data.scriptBundleAnalysis.largeBundles.reduce((sum, b) => sum + b.size, 0)
    const sizeMB = (totalSize / 1024 / 1024).toFixed(1)
    issues.push({
      category: 'Performance',
      severity: 'Low',
      message: `${data.scriptBundleAnalysis.largeBundles.length} large script bundle(s) (${sizeMB} MB total)`,
      details: `Large script bundles can slow page rendering and impact LLM accessibility. Consider code splitting, lazy loading, and removing unused code. ${data.scriptBundleAnalysis.recommendations.join(' ')}`,
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

/**
 * Analyze content for LLM accessibility
 * Extracts visible text content and identifies critical elements
 */
function analyzeContentForLLMs(
  initialHtml: string,
  renderedHtml: string
): LLMReadabilityData['contentAnalysis'] {
  const recommendations: string[] = []
  const criticalElementsMissing: string[] = []
  
  // Extract visible text content (remove scripts, styles, comments)
  const extractTextContent = (html: string): number => {
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return cleaned.length
  }
  
  const textContentInInitial = extractTextContent(initialHtml)
  const textContentInRendered = extractTextContent(renderedHtml)
  
  // Check for critical elements
  const checkElement = (tag: string, name: string) => {
    const initialHas = (initialHtml.match(new RegExp(`<${tag}[^>]*>`, 'gi')) || []).length > 0
    const renderedHas = (renderedHtml.match(new RegExp(`<${tag}[^>]*>`, 'gi')) || []).length > 0
    
    if (!initialHas && renderedHas) {
      criticalElementsMissing.push(name)
    }
  }
  
  checkElement('h1', 'H1 heading')
  checkElement('main', 'Main content')
  checkElement('article', 'Article content')
  checkElement('nav', 'Navigation')
  
  // Generate recommendations
  if (criticalElementsMissing.length > 0) {
    recommendations.push(`Move ${criticalElementsMissing.join(', ')} to initial HTML for better LLM accessibility.`)
  }
  
  const textIncrease = textContentInRendered - textContentInInitial
  const textIncreasePercent = textContentInInitial > 0 
    ? ((textIncrease / textContentInInitial) * 100).toFixed(1)
    : '0'
  
  if (textIncrease > 1000) {
    recommendations.push(`Significant text content (${textIncreasePercent}% increase, ${textIncrease.toLocaleString()} characters) is added via JavaScript. Consider server-side rendering for this content.`)
  }
  
  if (textContentInInitial < 500 && textContentInRendered > 1000) {
    recommendations.push(`Initial HTML contains very little text content (${textContentInInitial} characters). Most content is rendered via JavaScript, which may impact LLM accessibility.`)
  }
  
  return {
    textContentInInitial,
    textContentInRendered,
    criticalElementsMissing,
    recommendations
  }
}

