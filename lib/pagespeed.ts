/**
 * Google PageSpeed Insights API Integration
 * 
 * Fetches Core Web Vitals and optimization opportunities from Google's PageSpeed Insights API
 */

export interface PageSpeedOpportunity {
  id: string
  title: string
  description: string
  savings: number // in milliseconds
  score: number // 0-1
}

export interface PageSpeedMetrics {
  lcp: number // Largest Contentful Paint
  fcp: number // First Contentful Paint
  cls: number // Cumulative Layout Shift
  inp: number // Interaction to Next Paint (replaces FID)
  ttfb: number // Time to First Byte
  opportunities: PageSpeedOpportunity[]
}

export interface PageSpeedData {
  mobile: PageSpeedMetrics
  desktop: PageSpeedMetrics
}

/**
 * Fetch PageSpeed Insights data for a URL
 */
export async function fetchPageSpeedInsights(url: string): Promise<PageSpeedData | null> {
  const API_KEY = process.env.PAGESPEED_INSIGHTS_API_KEY
  
  if (!API_KEY) {
    console.warn('PageSpeed Insights API key not configured. Skipping PageSpeed analysis.')
    return null
  }

  try {
    // Fetch mobile and desktop data in parallel
    // Use Promise.allSettled to handle partial failures gracefully
    // (If one strategy fails, we still return data from the other)
    const [mobileSettled, desktopSettled] = await Promise.allSettled([
      fetchPageSpeedForStrategy(url, API_KEY, 'mobile'),
      fetchPageSpeedForStrategy(url, API_KEY, 'desktop')
    ])

    const mobileResult = mobileSettled.status === 'fulfilled' ? mobileSettled.value : null
    const desktopResult = desktopSettled.status === 'fulfilled' ? desktopSettled.value : null

    // Return null if both failed (don't return partial data)
    if (!mobileResult && !desktopResult) {
      return null
    }

    // If one or both succeeded, return what we have
    // The audit will still work, just with partial or full PageSpeed data
    return {
      mobile: mobileResult || {
        lcp: 0,
        fcp: 0,
        cls: 0,
        inp: 0,
        ttfb: 0,
        opportunities: []
      },
      desktop: desktopResult || {
        lcp: 0,
        fcp: 0,
        cls: 0,
        inp: 0,
        ttfb: 0,
        opportunities: []
      }
    }
  } catch (error) {
    // This catch block should rarely be hit since individual errors are handled in fetchPageSpeedForStrategy
    console.warn('PageSpeed Insights API error:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Fetch PageSpeed Insights data for a specific strategy (mobile/desktop)
 */
async function fetchPageSpeedForStrategy(
  url: string,
  apiKey: string,
  strategy: 'mobile' | 'desktop'
): Promise<PageSpeedMetrics | null> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=${strategy}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO`

  try {
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(60000) // 60 second timeout for long audits
    })

    if (!response.ok) {
      let errorMessage = `PageSpeed API returned ${response.status}`
      try {
        const errorData = await response.json()
        if (errorData?.error?.message) {
          errorMessage = errorData.error.message
          // Check for common error types
          if (errorMessage.includes('FAILED_DOCUMENT_REQUEST') || errorMessage.includes('ERR_TIMED_OUT')) {
            console.warn(`PageSpeed API: Page ${url} timed out or couldn't be loaded (${strategy}). This is normal for slow websites.`)
          } else if (errorMessage.includes('INVALID_URL')) {
            console.warn(`PageSpeed API: Invalid URL ${url} (${strategy})`)
          } else {
            console.warn(`PageSpeed API error (${strategy}): ${errorMessage}`)
          }
        } else {
          console.warn(`PageSpeed API error (${strategy}): ${response.status}`)
        }
      } catch (e) {
        // Response might not be JSON
        console.warn(`PageSpeed API error (${strategy}): ${response.status} - Unable to parse error response`)
      }
      // Return null gracefully - the audit will continue without PageSpeed data
      return null
    }

    const data = await response.json()

    // Extract Core Web Vitals from Lighthouse results
    const audits = data.lighthouseResult?.audits || {}
    const lighthouseResult = data.lighthouseResult

    // Extract metrics with validation
    // PageSpeed API returns values in milliseconds for timing metrics
    // LCP: Good < 2500ms, Needs Improvement < 4000ms, Poor >= 4000ms
    // FCP: Good < 1800ms, Needs Improvement < 3000ms, Poor >= 3000ms
    // CLS: Good < 0.1, Needs Improvement < 0.25, Poor >= 0.25
    // INP: Good < 200ms, Needs Improvement < 500ms, Poor >= 500ms
    // TTFB: Good < 800ms, Needs Improvement < 1800ms, Poor >= 1800ms
    
    let lcp = audits['largest-contentful-paint']?.numericValue || 0
    let fcp = audits['first-contentful-paint']?.numericValue || 0
    let cls = audits['cumulative-layout-shift']?.numericValue || 0
    let inp = audits['interaction-to-next-paint']?.numericValue || 0
    let ttfb = audits['server-response-time']?.numericValue || 0
    
    // Validate and cap unrealistic values
    // LCP > 30s is almost always a measurement error or test artifact
    if (lcp > 30000) {
      console.warn(`[PageSpeed] Unrealistic LCP value detected (${lcp}ms), capping at 30000ms`)
      lcp = 30000
    }
    
    // FCP > 10s is unrealistic for real-world scenarios
    if (fcp > 10000) {
      console.warn(`[PageSpeed] Unrealistic FCP value detected (${fcp}ms), capping at 10000ms`)
      fcp = 10000
    }
    
    // CLS > 1.0 is extremely rare
    if (cls > 1.0) {
      console.warn(`[PageSpeed] Unrealistic CLS value detected (${cls}), capping at 1.0`)
      cls = 1.0
    }
    
    // INP > 2000ms is unrealistic
    if (inp > 2000) {
      console.warn(`[PageSpeed] Unrealistic INP value detected (${inp}ms), capping at 2000ms`)
      inp = 2000
    }
    
    // TTFB > 5000ms is unrealistic for most sites
    if (ttfb > 5000) {
      console.warn(`[PageSpeed] Unrealistic TTFB value detected (${ttfb}ms), capping at 5000ms`)
      ttfb = 5000
    }

    // Extract optimization opportunities
    const opportunities: PageSpeedOpportunity[] = []
    const opportunityAudits = [
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'offscreen-images',
      'modern-image-formats',
      'uses-optimized-images',
      'uses-text-compression',
      'efficient-animated-content',
      'preload-lcp-image',
      'uses-responsive-images',
      'unminified-css',
      'unminified-javascript',
      'uses-long-cache-ttl',
      'total-byte-weight',
      'redirects'
    ]

    opportunityAudits.forEach(auditId => {
      const audit = audits[auditId]
      if (audit && audit.score !== null && audit.score < 1) {
        // Extract savings if available
        const savings = audit.details?.overallSavingsMs || 
                       audit.details?.overallSavingsBytes || 
                       0

        // Only include opportunities with meaningful impact
        if (savings > 0 || audit.score < 0.75) {
          opportunities.push({
            id: auditId,
            title: audit.title || auditId,
            description: audit.description || '',
            savings: typeof savings === 'number' ? savings : 0,
            score: audit.score || 0
          })
        }
      }
    })

    // Sort by savings (highest first), then by score (lowest first)
    opportunities.sort((a, b) => {
      if (b.savings !== a.savings) {
        return b.savings - a.savings
      }
      return a.score - b.score
    })

    return {
      lcp,
      fcp,
      cls,
      inp,
      ttfb,
      opportunities: opportunities.slice(0, 10) // Top 10 opportunities
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`PageSpeed Insights fetch timeout for ${strategy}: ${url} (exceeded 60s limit). This is normal for slow websites.`)
    } else if (error instanceof Error && error.message.includes('fetch')) {
      console.warn(`PageSpeed Insights fetch failed for ${strategy}: Network error (${url}). The audit will continue without PageSpeed data.`)
    } else {
      console.warn(`PageSpeed Insights fetch failed for ${strategy}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    // Return null gracefully - the audit will continue without PageSpeed data
    return null
  }
}

