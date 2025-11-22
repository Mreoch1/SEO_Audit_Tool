/**
 * Performance Metrics Validation
 * 
 * Validates and sanitizes performance metrics from PageSpeed Insights
 * to prevent bogus values like LCP 30s when FCP is 2.5s
 */

export interface ValidatedMetrics {
  lcp?: number
  fcp?: number
  cls?: number
  ttfb?: number
  validated: boolean
  warnings: string[]
}

/**
 * Validate performance metrics for consistency and realism
 */
export function validatePerformanceMetrics(metrics: {
  lcp?: number
  fcp?: number
  cls?: number
  ttfb?: number
}): ValidatedMetrics {
  const warnings: string[] = []
  const result: ValidatedMetrics = {
    validated: true,
    warnings
  }
  
  // Extract values
  let { lcp, fcp, cls, ttfb } = metrics
  
  // TTFB validation (should be < 5s in almost all cases)
  if (ttfb !== undefined) {
    if (ttfb < 0) {
      warnings.push(`Invalid TTFB: ${ttfb}ms (negative) - setting to undefined`)
      ttfb = undefined
    } else if (ttfb > 10000) {
      warnings.push(`Unrealistic TTFB: ${ttfb}ms (>10s) - capping to 5s`)
      ttfb = 5000
    }
  }
  
  // FCP validation (First Contentful Paint should happen within ~10s max)
  if (fcp !== undefined) {
    if (fcp < 0) {
      warnings.push(`Invalid FCP: ${fcp}ms (negative) - setting to undefined`)
      fcp = undefined
    } else if (fcp > 15000) {
      warnings.push(`Unrealistic FCP: ${fcp}ms (>15s) - capping to 10s`)
      fcp = 10000
    }
    
    // FCP should be >= TTFB
    if (ttfb !== undefined && fcp !== undefined && fcp < ttfb) {
      warnings.push(`Invalid FCP < TTFB: ${fcp}ms < ${ttfb}ms - adjusting FCP to TTFB`)
      fcp = ttfb
    }
  }
  
  // LCP validation (Largest Contentful Paint)
  if (lcp !== undefined) {
    if (lcp < 0) {
      warnings.push(`Invalid LCP: ${lcp}ms (negative) - setting to undefined`)
      lcp = undefined
    } else {
      // LCP must be >= FCP (can't paint largest content before first content)
      if (fcp !== undefined && lcp < fcp) {
        warnings.push(`Invalid LCP < FCP: ${lcp}ms < ${fcp}ms - adjusting LCP to FCP`)
        lcp = fcp
      }
      
      // LCP should not be absurdly high relative to FCP
      // If LCP > 30s and FCP < 5s, likely a parsing error or timeout value
      if (lcp > 30000 && fcp !== undefined && fcp < 5000) {
        warnings.push(`Suspicious LCP: ${lcp}ms with FCP ${fcp}ms - likely timeout/error, capping to 10s`)
        lcp = 10000
      }
      
      // Absolute maximum cap (no real page should take 60s+ for LCP)
      if (lcp > 60000) {
        warnings.push(`Unrealistic LCP: ${lcp}ms (>60s) - capping to 15s`)
        lcp = 15000
      }
    }
  }
  
  // CLS validation (Cumulative Layout Shift should be 0-1, rarely >2)
  if (cls !== undefined) {
    if (cls < 0) {
      warnings.push(`Invalid CLS: ${cls} (negative) - setting to 0`)
      cls = 0
    } else if (cls > 5) {
      warnings.push(`Unrealistic CLS: ${cls} (>5) - capping to 2`)
      cls = 2
    }
  }
  
  // Check for missing critical metrics
  if (lcp === undefined && fcp === undefined) {
    warnings.push('No paint metrics (LCP/FCP) available - performance scoring will be limited')
  }
  
  // Logical consistency check: TTFB < FCP < LCP (if all present)
  if (ttfb !== undefined && fcp !== undefined && lcp !== undefined) {
    if (!(ttfb <= fcp && fcp <= lcp)) {
      warnings.push(`Metric order inconsistency detected - expected TTFB <= FCP <= LCP`)
    }
  }
  
  result.lcp = lcp
  result.fcp = fcp
  result.cls = cls
  result.ttfb = ttfb
  
  return result
}

/**
 * Detect if metrics are likely from a failed/timeout measurement
 */
export function metricsLikelyInvalid(metrics: {
  lcp?: number
  fcp?: number
  cls?: number
  ttfb?: number
}): boolean {
  const { lcp, fcp, ttfb } = metrics
  
  // All undefined = failed measurement
  if (lcp === undefined && fcp === undefined && ttfb === undefined) {
    return true
  }
  
  // Sentinel values (exactly 0, 30000, 60000, etc)
  const sentinels = [0, 30000, 60000, 90000]
  if (lcp && sentinels.includes(lcp)) return true
  
  // Extremely long LCP with fast TTFB/FCP (inconsistent)
  if (lcp && lcp > 25000 && ttfb && ttfb < 1000) return true
  if (lcp && lcp > 25000 && fcp && fcp < 3000) return true
  
  return false
}

/**
 * Get human-readable performance rating
 */
export function getPerformanceRating(metric: 'lcp' | 'fcp' | 'cls' | 'ttfb', value: number): {
  rating: 'good' | 'needs-improvement' | 'poor'
  label: string
} {
  switch (metric) {
    case 'lcp':
      if (value <= 2500) return { rating: 'good', label: 'Good' }
      if (value <= 4000) return { rating: 'needs-improvement', label: 'Needs Improvement' }
      return { rating: 'poor', label: 'Poor' }
    
    case 'fcp':
      if (value <= 1800) return { rating: 'good', label: 'Good' }
      if (value <= 3000) return { rating: 'needs-improvement', label: 'Needs Improvement' }
      return { rating: 'poor', label: 'Poor' }
    
    case 'cls':
      if (value <= 0.1) return { rating: 'good', label: 'Good' }
      if (value <= 0.25) return { rating: 'needs-improvement', label: 'Needs Improvement' }
      return { rating: 'poor', label: 'Poor' }
    
    case 'ttfb':
      if (value <= 800) return { rating: 'good', label: 'Good' }
      if (value <= 1800) return { rating: 'needs-improvement', label: 'Needs Improvement' }
      return { rating: 'poor', label: 'Poor' }
  }
}

/**
 * Format metric value for display
 */
export function formatMetricValue(metric: 'lcp' | 'fcp' | 'cls' | 'ttfb', value: number): string {
  switch (metric) {
    case 'lcp':
    case 'fcp':
    case 'ttfb':
      // Convert ms to seconds if >= 1s
      if (value >= 1000) {
        return `${(value / 1000).toFixed(2)}s`
      }
      return `${value}ms`
    
    case 'cls':
      return value.toFixed(3)
  }
}

/**
 * Calculate performance score from validated metrics (0-100)
 */
export function calculatePerformanceScoreFromMetrics(metrics: ValidatedMetrics): number {
  let score = 100
  
  // LCP weight: 40%
  if (metrics.lcp !== undefined) {
    const lcp = metrics.lcp
    if (lcp <= 2500) score -= 0
    else if (lcp <= 4000) score -= 16 // -40% of 40 points
    else score -= 40
  }
  
  // FCP weight: 30%
  if (metrics.fcp !== undefined) {
    const fcp = metrics.fcp
    if (fcp <= 1800) score -= 0
    else if (fcp <= 3000) score -= 12 // -40% of 30 points
    else score -= 30
  }
  
  // CLS weight: 20%
  if (metrics.cls !== undefined) {
    const cls = metrics.cls
    if (cls <= 0.1) score -= 0
    else if (cls <= 0.25) score -= 8 // -40% of 20 points
    else score -= 20
  }
  
  // TTFB weight: 10%
  if (metrics.ttfb !== undefined) {
    const ttfb = metrics.ttfb
    if (ttfb <= 800) score -= 0
    else if (ttfb <= 1800) score -= 4 // -40% of 10 points
    else score -= 10
  }
  
  return Math.max(0, Math.min(100, Math.round(score)))
}

