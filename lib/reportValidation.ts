/**
 * Report Quality Assurance Validation
 * 
 * Automatically detects and reports inconsistencies, bugs, and errors
 * in audit results before generating the final report.
 */

import { AuditResult } from './types'

export interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info'
  category: string
  message: string
  details?: string
  fixable: boolean
  suggestedFix?: string
}

export interface ValidationResult {
  isValid: boolean
  issues: ValidationIssue[]
  criticalIssues: number
  warnings: number
}

/**
 * Validate audit result for consistency and correctness
 */
export function validateReportConsistency(result: AuditResult): ValidationResult {
  const issues: ValidationIssue[] = []

  // 1. Validate keyword extraction
  validateKeywords(result, issues)

  // 2. Validate priority/severity counts
  validatePriorityCounts(result, issues)

  // 3. Validate page count vs tier expectations
  validatePageCount(result, issues)

  // 4. Validate LLM readability percentages
  validateReadabilityPercentages(result, issues)

  // 5. Validate Core Web Vitals data
  validateCoreWebVitals(result, issues)

  // 6. Validate section consistency
  validateSectionConsistency(result, issues)

  // 7. Validate score consistency
  validateScoreConsistency(result, issues)

  const criticalIssues = issues.filter(i => i.severity === 'critical').length
  const warnings = issues.filter(i => i.severity === 'warning').length

  return {
    isValid: criticalIssues === 0,
    issues,
    criticalIssues,
    warnings
  }
}

/**
 * Validate keyword extraction quality
 */
function validateKeywords(result: AuditResult, issues: ValidationIssue[]): void {
  const keywords = result.summary.extractedKeywords || []

  // Check for garbage tokens
  const garbagePatterns = [
    /^[a-z]{1,2}$/i, // 1-2 character words
    /[^\w\s-]/, // Special characters (except hyphens)
    /\n|\r/, // Newlines
    /^\s+$/, // Only whitespace
    /^[a-z]+[A-Z]/, // CamelCase fragments
    /enterp|rise-grade|serviceenterp/i // Known broken patterns
  ]

  const garbageKeywords: string[] = []
  const duplicateKeywords: string[] = []
  const seenKeywords = new Set<string>()

  keywords.forEach(keyword => {
    const normalized = keyword.toLowerCase().trim()
    
    // Check for garbage patterns
    if (garbagePatterns.some(pattern => pattern.test(keyword))) {
      garbageKeywords.push(keyword)
    }

    // Check for duplicates
    if (seenKeywords.has(normalized)) {
      duplicateKeywords.push(keyword)
    } else {
      seenKeywords.add(normalized)
    }

    // Check for hyphen-split words (likely broken)
    if (keyword.includes('-') && keyword.length < 15) {
      // Short hyphenated words might be broken splits
      const parts = keyword.split('-')
      if (parts.some(part => part.length < 3)) {
        garbageKeywords.push(keyword)
      }
    }
  })

  if (garbageKeywords.length > 0) {
    issues.push({
      severity: 'critical',
      category: 'Keyword Extraction',
      message: `Found ${garbageKeywords.length} garbage/invalid keywords`,
      details: `Invalid keywords: ${garbageKeywords.slice(0, 10).join(', ')}${garbageKeywords.length > 10 ? '...' : ''}`,
      fixable: true,
      suggestedFix: 'Fix keyword tokenizer to properly decode HTML entities, remove stopwords, and filter invalid tokens'
    })
  }

  if (duplicateKeywords.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'Keyword Extraction',
      message: `Found ${duplicateKeywords.length} duplicate keywords`,
      fixable: true,
      suggestedFix: 'Deduplicate keywords before adding to report'
    })
  }
}

/**
 * Validate priority/severity count consistency
 */
function validatePriorityCounts(result: AuditResult, issues: ValidationIssue[]): void {
  const summary = result.summary
  const expectedHigh = summary.highSeverityIssues
  const expectedMedium = summary.mediumSeverityIssues
  const expectedLow = summary.lowSeverityIssues

  // Count actual issues by severity
  const allIssues = [
    ...(result.technicalIssues || []),
    ...(result.onPageIssues || []),
    ...(result.contentIssues || []),
    ...(result.accessibilityIssues || []),
    ...(result.performanceIssues || [])
  ]

  const actualHigh = allIssues.filter(i => i.severity === 'High').length
  const actualMedium = allIssues.filter(i => i.severity === 'Medium').length
  const actualLow = allIssues.filter(i => i.severity === 'Low').length

  // Check for mismatches
  if (actualHigh !== expectedHigh) {
    issues.push({
      severity: 'critical',
      category: 'Priority Counts',
      message: `High priority count mismatch: Summary says ${expectedHigh}, but arrays contain ${actualHigh}`,
      fixable: true,
      suggestedFix: 'Recalculate severity counts from actual issue arrays, or fix issue categorization'
    })
  }

  if (actualMedium !== expectedMedium) {
    issues.push({
      severity: 'critical',
      category: 'Priority Counts',
      message: `Medium priority count mismatch: Summary says ${expectedMedium}, but arrays contain ${actualMedium}`,
      fixable: true,
      suggestedFix: 'Recalculate severity counts from actual issue arrays, or fix issue categorization'
    })
  }

  if (actualLow !== expectedLow) {
    issues.push({
      severity: 'warning',
      category: 'Priority Counts',
      message: `Low priority count mismatch: Summary says ${expectedLow}, but arrays contain ${actualLow}`,
      fixable: true,
      suggestedFix: 'Recalculate severity counts from actual issue arrays'
    })
  }

  // Check Priority Action Plan logic
  const totalPriority = expectedHigh + expectedMedium
  if (totalPriority > 0) {
    // If there are priority issues, the Priority Action Plan should show them
    // This is validated in PDF generation, but we can flag it here too
  }
}

/**
 * Validate page count vs tier expectations
 */
function validatePageCount(result: AuditResult, issues: ValidationIssue[]): void {
  const tier = result.raw.options.tier
  const pagesCrawled = result.summary.totalPagesCrawled || result.summary.totalPages
  const maxPages = result.raw.options.maxPages || 20

  // Expected minimum pages based on tier
  const tierExpectations: Record<string, number> = {
    starter: 5,
    standard: 10, // Should crawl more than 2 pages
    professional: 15,
    agency: 20
  }

  const expectedMin = tierExpectations[tier || 'standard'] || 5

  // Check if crawl seems incomplete
  if (pagesCrawled < expectedMin && pagesCrawled < maxPages) {
    issues.push({
      severity: 'warning',
      category: 'Crawl Depth',
      message: `Only ${pagesCrawled} pages crawled, expected at least ${expectedMin} for ${tier} tier`,
      details: `Max pages allowed: ${maxPages}. This may indicate: missing internal links, crawler stopped early, or renderer failures.`,
      fixable: false, // Can't fix after the fact, but can flag for investigation
      suggestedFix: 'Check crawler logic, internal link extraction, and renderer health'
    })
  }

  // Check if no pages were crawled
  if (pagesCrawled === 0) {
    issues.push({
      severity: 'critical',
      category: 'Crawl Depth',
      message: 'No pages were crawled - audit is invalid',
      fixable: false,
      suggestedFix: 'Check crawler initialization and URL validation'
    })
  }
}

/**
 * Validate LLM readability percentages
 */
function validateReadabilityPercentages(result: AuditResult, issues: ValidationIssue[]): void {
  result.pages.forEach(page => {
    if (page.llmReadability) {
      const percentage = page.llmReadability.renderingPercentage

      // Check for impossible values
      if (percentage < 0 || percentage > 105) {
        issues.push({
          severity: 'critical',
          category: 'Readability Calculation',
          message: `Invalid rendering percentage for ${page.url}: ${percentage}%`,
          details: 'Rendering percentage must be between 0 and 100',
          fixable: true,
          suggestedFix: 'Fix rendering percentage calculation formula'
        })
      }

      // Check for 0% when HTML sizes differ (indicates calculation bug)
      if (percentage === 0 && page.llmReadability.initialHtmlLength && page.llmReadability.renderedHtmlLength) {
        const initialSize = page.llmReadability.initialHtmlLength
        const renderedSize = page.llmReadability.renderedHtmlLength
        const diff = Math.abs(initialSize - renderedSize)
        const similarity = ((Math.min(initialSize, renderedSize) / Math.max(initialSize, renderedSize)) * 100)

        // If sizes are very similar (>95%), 0% is wrong
        if (similarity > 95 && diff > 100) {
          issues.push({
            severity: 'critical',
            category: 'Readability Calculation',
            message: `Rendering percentage shows 0% for ${page.url}, but HTML sizes are ${similarity.toFixed(1)}% similar`,
            details: `Initial: ${initialSize} chars, Rendered: ${renderedSize} chars, Difference: ${diff}`,
            fixable: true,
            suggestedFix: 'Fix rendering percentage calculation - likely division error or inverted formula'
          })
        }
      }

      // Check for NaN
      if (isNaN(percentage)) {
        issues.push({
          severity: 'critical',
          category: 'Readability Calculation',
          message: `Rendering percentage is NaN for ${page.url}`,
          fixable: true,
          suggestedFix: 'Check for division by zero or invalid calculations in rendering percentage formula'
        })
      }
    }
  })
}

/**
 * Validate Core Web Vitals data presence
 */
function validateCoreWebVitals(result: AuditResult, issues: ValidationIssue[]): void {
  const pagesWithNoCWV = result.pages.filter(page => {
    return !page.pageSpeedData && !page.performanceMetrics
  })

  if (pagesWithNoCWV.length === result.pages.length) {
    // All pages missing CWV - this is expected if PSI API key not configured
    // But we should flag it as informational
    issues.push({
      severity: 'info',
      category: 'Core Web Vitals',
      message: 'No Core Web Vitals data available for any pages',
      details: 'This may be due to missing PageSpeed Insights API key or API failures',
      fixable: false,
      suggestedFix: 'Configure PageSpeed Insights API key in settings, or improve fallback messaging'
    })
  }
}

/**
 * Validate section consistency
 */
function validateSectionConsistency(result: AuditResult, issues: ValidationIssue[]): void {
  // Check that issue counts match across sections
  const technicalCount = (result.technicalIssues || []).length
  const onPageCount = (result.onPageIssues || []).length
  const contentCount = (result.contentIssues || []).length
  const accessibilityCount = (result.accessibilityIssues || []).length
  const performanceCount = (result.performanceIssues || []).length

  const totalFromSections = technicalCount + onPageCount + contentCount + accessibilityCount + performanceCount
  const totalFromSummary = result.summary.highSeverityIssues + 
                          result.summary.mediumSeverityIssues + 
                          result.summary.lowSeverityIssues

  // Allow some variance due to deduplication, but flag large differences
  const difference = Math.abs(totalFromSections - totalFromSummary)
  if (difference > 5) {
    issues.push({
      severity: 'warning',
      category: 'Section Consistency',
      message: `Issue count mismatch: Sections total ${totalFromSections}, Summary total ${totalFromSummary}`,
      details: `Difference: ${difference}. This may indicate deduplication issues or counting errors.`,
      fixable: true,
      suggestedFix: 'Review issue deduplication logic and ensure summary counts match section totals'
    })
  }
}

/**
 * Validate score consistency
 */
function validateScoreConsistency(result: AuditResult, issues: ValidationIssue[]): void {
  const scores = result.summary

  // Check for impossible scores
  const scoreFields = [
    { name: 'Overall', value: scores.overallScore },
    { name: 'Technical', value: scores.technicalScore },
    { name: 'On-Page', value: scores.onPageScore },
    { name: 'Content', value: scores.contentScore },
    { name: 'Accessibility', value: scores.accessibilityScore }
  ]

  scoreFields.forEach(field => {
    if (field.value < 0 || field.value > 100) {
      issues.push({
        severity: 'critical',
        category: 'Score Validation',
        message: `Invalid ${field.name} score: ${field.value}`,
        details: 'Scores must be between 0 and 100',
        fixable: true,
        suggestedFix: 'Clamp scores to 0-100 range in scoring calculation'
      })
    }

    if (isNaN(field.value)) {
      issues.push({
        severity: 'critical',
        category: 'Score Validation',
        message: `${field.name} score is NaN`,
        fixable: true,
        suggestedFix: 'Check for division by zero or invalid calculations in scoring formula'
      })
    }
  })

  // Check accessibility score logic
  // If there are no missing alt tags and viewport is present, accessibility should be high
  const pagesWithoutViewport = result.pages.filter(p => !p.hasViewport).length
  const totalImages = result.pages.reduce((sum, p) => sum + (p.imageCount || 0), 0)
  const missingAlt = result.pages.reduce((sum, p) => sum + (p.missingAltCount || 0), 0)
  
  if (missingAlt === 0 && pagesWithoutViewport === 0 && scores.accessibilityScore < 80) {
    issues.push({
      severity: 'warning',
      category: 'Score Consistency',
      message: `Accessibility score is ${scores.accessibilityScore} but no missing alt tags and all pages have viewport`,
      details: 'Accessibility score may be too low given the positive indicators',
      fixable: false,
      suggestedFix: 'Review accessibility scoring weights - may need adjustment'
    })
  }
}

/**
 * Generate validation report summary
 */
export function generateValidationReport(validation: ValidationResult): string {
  if (validation.isValid && validation.issues.length === 0) {
    return '✅ Report validation passed - no issues detected'
  }

  let report = `\n📋 Report Validation Results:\n`
  report += `   Critical Issues: ${validation.criticalIssues}\n`
  report += `   Warnings: ${validation.warnings}\n`
  report += `   Info: ${validation.issues.filter(i => i.severity === 'info').length}\n\n`

  if (validation.criticalIssues > 0) {
    report += `🚨 Critical Issues:\n`
    validation.issues
      .filter(i => i.severity === 'critical')
      .forEach(issue => {
        report += `   ❌ [${issue.category}] ${issue.message}\n`
        if (issue.details) {
          report += `      ${issue.details}\n`
        }
        if (issue.suggestedFix) {
          report += `      Fix: ${issue.suggestedFix}\n`
        }
      })
    report += `\n`
  }

  if (validation.warnings > 0) {
    report += `⚠️  Warnings:\n`
    validation.issues
      .filter(i => i.severity === 'warning')
      .forEach(issue => {
        report += `   ⚠️  [${issue.category}] ${issue.message}\n`
        if (issue.details) {
          report += `      ${issue.details}\n`
        }
      })
    report += `\n`
  }

  return report
}

