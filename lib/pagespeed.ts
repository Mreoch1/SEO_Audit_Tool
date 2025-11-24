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
export async function fetchPageSpeedInsights(url: string, retries: number = 2): Promise<PageSpeedData | null> {
  const API_KEY = process.env.PAGESPEED_INSIGHTS_API_KEY
  
  if (!API_KEY) {
    console.warn('[PageSpeed] ❌ API key not configured. Set PAGESPEED_INSIGHTS_API_KEY environment variable.')
    console.warn('[PageSpeed] Get your API key at: https://developers.google.com/speed/docs/insights/v5/get-started')
    return null
  }
  
  if (API_KEY.length < 20) {
    console.warn('[PageSpeed] ⚠️ API key appears invalid (too short). Check PAGESPEED_INSIGHTS_API_KEY.')
    return null
  }
  
  console.log(`[PageSpeed] 🔍 Fetching PageSpeed data for: ${url}${retries > 0 ? ` (${retries} retries available)` : ''}`)

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

    // CRITICAL FIX: Return partial data if at least one strategy succeeded
    // This ensures we have PageSpeed data even if one strategy fails
    if (mobileResult || desktopResult) {
      console.log(`[PageSpeed] ✅ Retrieved data: mobile=${!!mobileResult}, desktop=${!!desktopResult}`)
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
    }

    // Both failed - retry if we have retries left
    if (!mobileResult && !desktopResult && retries > 0) {
      const isTimeout = (mobileSettled.status === 'rejected' && mobileSettled.reason?.name === 'AbortError') ||
                        (desktopSettled.status === 'rejected' && desktopSettled.reason?.name === 'AbortError')
      
      if (isTimeout) {
        console.warn(`[PageSpeed] ⚠️ Timeout detected, retrying (${retries} attempts left)...`)
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2s before retry
        return fetchPageSpeedInsights(url, retries - 1)
      }
    }
    
    // Both failed - log the reasons
    if (mobileSettled.status === 'rejected') {
      console.warn(`[PageSpeed] ❌ Mobile strategy failed:`, mobileSettled.reason)
    }
    if (desktopSettled.status === 'rejected') {
      console.warn(`[PageSpeed] ❌ Desktop strategy failed:`, desktopSettled.reason)
    }
    if (!mobileResult && !desktopResult) {
      console.warn(`[PageSpeed] ⚠️ Both strategies failed for ${url}`)
    }
    return null
  } catch (error) {
    // This catch block should rarely be hit since individual errors are handled in fetchPageSpeedForStrategy
    console.warn('[PageSpeed] ❌ Unexpected error:', error instanceof Error ? error.message : error)
    
    // Retry on unexpected errors if we have retries left
    if (retries > 0) {
      console.warn(`[PageSpeed] ⚠️ Retrying after error (${retries} attempts left)...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
      return fetchPageSpeedInsights(url, retries - 1)
    }
    
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
    // CRITICAL FIX: Increase timeout to 90 seconds for complex sites like Linear.app
    // Some sites take longer to analyze, especially with heavy JavaScript
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(90000) // 90 second timeout for complex sites
    })

    if (!response.ok) {
      let errorMessage = `PageSpeed API returned ${response.status}`
      let errorCode = ''
      let quotaExceeded = false
      
      try {
        const errorData = await response.json()
        if (errorData?.error) {
          errorMessage = errorData.error.message || errorMessage
          errorCode = errorData.error.code || ''
          
          // Check for quota/rate limit errors
          if (errorCode === 429 || errorMessage.includes('quota') || errorMessage.includes('rate limit') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
            quotaExceeded = true
            console.error(`[PageSpeed] ❌ QUOTA EXCEEDED (${strategy}): ${errorMessage}`)
            console.error(`[PageSpeed] 💡 Solution: Wait 24 hours or upgrade your Google Cloud quota`)
            console.error(`[PageSpeed] 💡 Check quota at: https://console.cloud.google.com/apis/api/pagespeedonline.googleapis.com/quotas`)
          } else if (errorCode === 403 || errorMessage.includes('API key') || errorMessage.includes('permission')) {
            console.error(`[PageSpeed] ❌ API KEY ERROR (${strategy}): ${errorMessage}`)
            console.error(`[PageSpeed] 💡 Solution: Verify API key is correct and has PageSpeed Insights API enabled`)
            console.error(`[PageSpeed] 💡 Enable API at: https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com`)
          } else if (errorMessage.includes('FAILED_DOCUMENT_REQUEST') || errorMessage.includes('ERR_TIMED_OUT')) {
            console.warn(`[PageSpeed] ⚠️ TIMEOUT (${strategy}): Page ${url} timed out or couldn't be loaded. This is normal for slow websites.`)
          } else if (errorMessage.includes('INVALID_URL')) {
            console.warn(`[PageSpeed] ⚠️ INVALID URL (${strategy}): ${url}`)
          } else {
            console.error(`[PageSpeed] ❌ ERROR (${strategy}): ${errorMessage} (Code: ${errorCode})`)
          }
        } else {
          // HTTP error without JSON error body
          if (response.status === 429) {
            quotaExceeded = true
            console.error(`[PageSpeed] ❌ QUOTA EXCEEDED (${strategy}): HTTP 429 - Rate limit exceeded`)
          } else if (response.status === 403) {
            console.error(`[PageSpeed] ❌ PERMISSION DENIED (${strategy}): HTTP 403 - Check API key permissions`)
          } else {
            console.error(`[PageSpeed] ❌ HTTP ERROR (${strategy}): ${response.status} ${response.statusText}`)
          }
        }
      } catch (e) {
        // Response might not be JSON
        console.error(`[PageSpeed] ❌ PARSE ERROR (${strategy}): ${response.status} - Unable to parse error response`)
        if (response.status === 429) {
          console.error(`[PageSpeed] 💡 Likely quota exceeded. Check Google Cloud Console.`)
        }
      }
      
      // Return null gracefully - the audit will continue without PageSpeed data
      return null
    }

    const data = await response.json()

    // CRITICAL FIX: Validate response structure
    if (!data.lighthouseResult) {
      console.error(`[PageSpeed] ❌ Invalid response structure (${strategy}): Missing lighthouseResult`)
      console.error(`[PageSpeed] Response keys: ${Object.keys(data).join(', ')}`)
      return null
    }

    // Extract Core Web Vitals from Lighthouse results
    const audits = data.lighthouseResult?.audits || {}
    const lighthouseResult = data.lighthouseResult
    
    console.log(`[PageSpeed] ✅ Successfully fetched data (${strategy}) for ${url}`)

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
      console.error(`[PageSpeed] ❌ TIMEOUT (${strategy}): ${url} exceeded 90s limit. This is normal for slow websites.`)
    } else if (error instanceof Error && error.message.includes('fetch')) {
      console.error(`[PageSpeed] ❌ NETWORK ERROR (${strategy}): ${url}`)
      console.error(`[PageSpeed] Error: ${error.message}`)
      console.error(`[PageSpeed] 💡 Check internet connection and firewall settings`)
    } else {
      console.error(`[PageSpeed] ❌ UNEXPECTED ERROR (${strategy}): ${url}`)
      console.error(`[PageSpeed] Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      if (error instanceof Error && error.stack) {
        console.error(`[PageSpeed] Stack: ${error.stack}`)
      }
    }
    // Return null gracefully - the audit will continue without PageSpeed data
    return null
  }
}

