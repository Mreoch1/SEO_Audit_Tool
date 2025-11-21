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
    const [mobileResult, desktopResult] = await Promise.all([
      fetchPageSpeedForStrategy(url, API_KEY, 'mobile'),
      fetchPageSpeedForStrategy(url, API_KEY, 'desktop')
    ])

    if (!mobileResult || !desktopResult) {
      return null
    }

    return {
      mobile: mobileResult,
      desktop: desktopResult
    }
  } catch (error) {
    console.error('PageSpeed Insights API error:', error)
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
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`PageSpeed API error (${strategy}):`, response.status, errorText)
      return null
    }

    const data = await response.json()

    // Extract Core Web Vitals from Lighthouse results
    const audits = data.lighthouseResult?.audits || {}
    const lighthouseResult = data.lighthouseResult

    // Extract metrics
    const lcp = audits['largest-contentful-paint']?.numericValue || 0
    const fcp = audits['first-contentful-paint']?.numericValue || 0
    const cls = audits['cumulative-layout-shift']?.numericValue || 0
    const inp = audits['interaction-to-next-paint']?.numericValue || 0
    const ttfb = audits['server-response-time']?.numericValue || 0

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
      console.error(`PageSpeed Insights fetch timeout for ${strategy}:`, url)
    } else {
      console.error(`PageSpeed Insights fetch failed for ${strategy}:`, error)
    }
    return null
  }
}

