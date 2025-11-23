/**
 * Comprehensive Report Quality Assurance
 * 
 * Validates audit results against objective quality metrics and identifies
 * all reporting errors that need to be fixed.
 */

import { AuditResult } from './types'

export interface QAIssue {
  category: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  details: string
  expected: string
  actual: string
  fixable: boolean
  fixCode?: string
}

export interface QAResult {
  score: number // 0-10
  issues: QAIssue[]
  criticalCount: number
  warningCount: number
  passed: boolean // true if score >= 9
}

/**
 * Comprehensive QA validation
 */
export function validateReportQuality(result: AuditResult): QAResult {
  const issues: QAIssue[] = []

  // 1. Issue Aggregation Accuracy
  validateIssueAggregation(result, issues)

  // 2. Crawl Completeness
  validateCrawlCompleteness(result, issues)

  // 3. Readability Formula Correctness
  validateReadabilityFormula(result, issues)

  // 4. Keyword Extraction Quality
  validateKeywordQuality(result, issues)

  // 5. Narrative/Score Consistency
  validateNarrativeConsistency(result, issues)

  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const warningCount = issues.filter(i => i.severity === 'warning').length

  // Calculate score: 10 - (critical * 2) - (warning * 1), minimum 0
  const score = Math.max(0, 10 - (criticalCount * 2) - (warningCount * 1))
  const passed = score >= 9

  return {
    score,
    issues,
    criticalCount,
    warningCount,
    passed
  }
}

/**
 * 1. Issue Aggregation Accuracy
 * Checks if issue counts match actual issue arrays
 */
function validateIssueAggregation(result: AuditResult, issues: QAIssue[]): void {
  const summary = result.summary
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
  const actualTotal = allIssues.length

  const summaryTotal = summary.highSeverityIssues + summary.mediumSeverityIssues + summary.lowSeverityIssues

  // Check if scores indicate issues but arrays are empty
  const hasLowScores = summary.technicalScore < 70 || summary.contentScore < 70 || summary.onPageScore < 70
  const hasIssuesInScores = summaryTotal > 0

  if (hasLowScores && actualTotal === 0 && hasIssuesInScores) {
    issues.push({
      category: 'Issue Aggregation',
      severity: 'critical',
      message: 'Issue arrays are empty but scores indicate problems',
      details: `Technical score: ${summary.technicalScore}, Content score: ${summary.contentScore}, On-page score: ${summary.onPageScore}. Summary reports ${summaryTotal} issues but arrays contain 0.`,
      expected: `${summaryTotal} issues in arrays`,
      actual: '0 issues in arrays',
      fixable: true,
      fixCode: 'Recalculate issues from score deductions or fix issue aggregation logic'
    })
  }

  if (actualHigh !== summary.highSeverityIssues) {
    issues.push({
      category: 'Issue Aggregation',
      severity: 'critical',
      message: `High priority count mismatch: Summary says ${summary.highSeverityIssues}, arrays contain ${actualHigh}`,
      details: 'Severity counts must match actual issue arrays',
      expected: `${summary.highSeverityIssues} high priority issues`,
      actual: `${actualHigh} high priority issues`,
      fixable: true,
      fixCode: 'Recalculate severity counts from actual issue arrays: `summary.highSeverityIssues = allIssues.filter(i => i.severity === "High").length`'
    })
  }

  if (actualMedium !== summary.mediumSeverityIssues) {
    issues.push({
      category: 'Issue Aggregation',
      severity: 'critical',
      message: `Medium priority count mismatch: Summary says ${summary.mediumSeverityIssues}, arrays contain ${actualMedium}`,
      details: 'Severity counts must match actual issue arrays',
      expected: `${summary.mediumSeverityIssues} medium priority issues`,
      actual: `${actualMedium} medium priority issues`,
      fixable: true,
      fixCode: 'Recalculate severity counts from actual issue arrays'
    })
  }

  if (actualLow !== summary.lowSeverityIssues) {
    issues.push({
      category: 'Issue Aggregation',
      severity: 'warning',
      message: `Low priority count mismatch: Summary says ${summary.lowSeverityIssues}, arrays contain ${actualLow}`,
      details: 'Severity counts should match actual issue arrays',
      expected: `${summary.lowSeverityIssues} low priority issues`,
      actual: `${actualLow} low priority issues`,
      fixable: true,
      fixCode: 'Recalculate severity counts from actual issue arrays'
    })
  }
}

/**
 * 2. Crawl Completeness
 * Validates that enough pages were crawled for the tier
 */
function validateCrawlCompleteness(result: AuditResult, issues: QAIssue[]): void {
  const tier = result.raw.options.tier || 'standard'
  const pagesCrawled = result.summary.totalPagesCrawled || result.summary.totalPages
  const maxPages = result.raw.options.maxPages || 20

  const tierExpectations: Record<string, number> = {
    starter: 5,
    standard: 10,
    professional: 15,
    agency: 20
  }

  const expectedMin = tierExpectations[tier] || 10

  if (pagesCrawled < expectedMin && pagesCrawled < maxPages) {
    issues.push({
      category: 'Crawl Completeness',
      severity: 'critical',
      message: `Only ${pagesCrawled} pages crawled, expected at least ${expectedMin} for ${tier} tier`,
      details: `Max pages allowed: ${maxPages}. Crawler may have stopped early, internal link extraction may be broken, or site has limited pages.`,
      expected: `At least ${expectedMin} pages for ${tier} tier`,
      actual: `${pagesCrawled} pages crawled`,
      fixable: false,
      fixCode: 'Check crawler logic, internal link extraction, and ensure queue continues until maxPages or no more links found'
    })
  }
}

/**
 * 3. Readability Formula Correctness
 * Validates rendering percentage calculations
 */
function validateReadabilityFormula(result: AuditResult, issues: QAIssue[]): void {
  result.pages.forEach(page => {
    if (page.llmReadability) {
      const llm = page.llmReadability
      const initial = llm.initialHtmlLength
      const rendered = llm.renderedHtmlLength
      const percentage = llm.renderingPercentage
      const similarity = llm.similarity || 0

      // Check for impossible 0% when HTML sizes are very similar
      if (percentage === 0 && initial > 0 && rendered > 0) {
        const actualSimilarity = (Math.min(initial, rendered) / Math.max(initial, rendered)) * 100
        const diff = Math.abs(initial - rendered)
        
        // If similarity is >95% and difference is >100 chars, 0% is wrong
        if (actualSimilarity > 95 && diff > 100) {
          issues.push({
            category: 'Readability Formula',
            severity: 'critical',
            message: `Rendering percentage shows 0% but HTML is ${actualSimilarity.toFixed(1)}% similar`,
            details: `Initial: ${initial} chars, Rendered: ${rendered} chars, Difference: ${diff}. Formula is inverted or broken.`,
            expected: `~${(100 - actualSimilarity).toFixed(1)}% rendering (or ${actualSimilarity.toFixed(1)}% similarity)`,
            actual: '0% rendering',
            fixable: true,
            fixCode: `When rendered < initial: renderingPercentage = similarity > 95 ? (100 - similarity) : ((initial - rendered) / initial * 100)`
          })
        }
      }

      // Check for NaN or invalid values
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        issues.push({
          category: 'Readability Formula',
          severity: 'critical',
          message: `Invalid rendering percentage: ${percentage}`,
          details: 'Rendering percentage must be between 0 and 100',
          expected: '0-100%',
          actual: `${percentage}%`,
          fixable: true,
          fixCode: 'Clamp percentage to 0-100 range'
        })
      }
    }
  })
}

/**
 * 4. Keyword Extraction Quality
 * Validates keyword quality and filters garbage
 */
function validateKeywordQuality(result: AuditResult, issues: QAIssue[]): void {
  const keywords = result.summary.extractedKeywords || []

  if (keywords.length === 0) return

  const garbagePatterns = [
    /^[a-z]{1,2}$/i, // 1-2 char words
    /enterp|rise-grade|serviceenterp/i, // Known broken patterns
    /^\s+$/, // Only whitespace
    /\n|\r/, // Newlines
  ]

  const duplicates: string[] = []
  const garbage: string[] = []
  const seen = new Set<string>()

  keywords.forEach(keyword => {
    const normalized = keyword.toLowerCase().trim()
    
    // Check for garbage
    if (garbagePatterns.some(pattern => pattern.test(keyword))) {
      garbage.push(keyword)
    }

    // Check for duplicates
    if (seen.has(normalized)) {
      duplicates.push(keyword)
    } else {
      seen.add(normalized)
    }

    // Check for broken hyphen splits
    if (keyword.includes('-')) {
      const parts = keyword.split('-')
      if (parts.some(part => part.length < 3 && part.length > 0)) {
        garbage.push(keyword)
      }
    }
  })

  if (garbage.length > 0) {
    issues.push({
      category: 'Keyword Quality',
      severity: 'warning',
      message: `Found ${garbage.length} garbage/invalid keywords`,
      details: `Invalid keywords: ${garbage.slice(0, 5).join(', ')}${garbage.length > 5 ? '...' : ''}`,
      expected: 'Clean, valid keywords only',
      actual: `${garbage.length} garbage keywords`,
      fixable: true,
      fixCode: 'Filter keywords: remove <3 char words, decode HTML entities, remove duplicates, filter broken hyphen splits'
    })
  }

  if (duplicates.length > 0) {
    issues.push({
      category: 'Keyword Quality',
      severity: 'warning',
      message: `Found ${duplicates.length} duplicate keywords`,
      details: 'Keywords should be deduplicated before display',
      expected: 'Unique keywords only',
      actual: `${duplicates.length} duplicates`,
      fixable: true,
      fixCode: 'Deduplicate keywords using Set or deduplicateKeywords() function'
    })
  }
}

/**
 * 5. Narrative/Score Consistency
 * Validates that summary text matches scores
 */
function validateNarrativeConsistency(result: AuditResult, issues: QAIssue[]): void {
  const summary = result.summary
  const overallScore = summary.overallScore
  const technicalScore = summary.technicalScore
  const contentScore = summary.contentScore

  // Check if narrative would claim "excellent" but scores are low
  const isLowScore = overallScore < 70 || technicalScore < 70 || contentScore < 70
  const hasManyIssues = (summary.highSeverityIssues + summary.mediumSeverityIssues) > 5

  if (isLowScore || hasManyIssues) {
    // This will be checked in PDF generation - flag it here
    issues.push({
      category: 'Narrative Consistency',
      severity: 'warning',
      message: 'Summary narrative may contradict scores',
      details: `Overall: ${overallScore}/100, Technical: ${technicalScore}/100, Content: ${contentScore}/100. Narrative should not claim "excellent" with these scores.`,
      expected: 'Narrative matches score levels (excellent = 90+, good = 70-89, needs improvement = <70)',
      actual: 'Narrative may claim "excellent" despite low scores',
      fixable: true,
      fixCode: 'Update narrative generation to match score ranges: if (overallScore < 70) "needs improvement", else if (overallScore < 90) "good", else "excellent"'
    })
  }
}

/**
 * Generate QA report
 */
export function generateQAReport(qa: QAResult): string {
  let report = `\n📊 Report Quality Assurance Results\n`
  report += `   Score: ${qa.score}/10 ${qa.passed ? '✅ PASSED' : '❌ FAILED'}\n`
  report += `   Critical Issues: ${qa.criticalCount}\n`
  report += `   Warnings: ${qa.warningCount}\n\n`

  if (qa.criticalCount > 0) {
    report += `🚨 Critical Issues:\n`
    qa.issues
      .filter(i => i.severity === 'critical')
      .forEach(issue => {
        report += `   ❌ [${issue.category}] ${issue.message}\n`
        report += `      Expected: ${issue.expected}\n`
        report += `      Actual: ${issue.actual}\n`
        if (issue.fixCode) {
          report += `      Fix: ${issue.fixCode}\n`
        }
      })
    report += `\n`
  }

  if (qa.warningCount > 0) {
    report += `⚠️  Warnings:\n`
    qa.issues
      .filter(i => i.severity === 'warning')
      .forEach(issue => {
        report += `   ⚠️  [${issue.category}] ${issue.message}\n`
        report += `      Expected: ${issue.expected}\n`
        report += `      Actual: ${issue.actual}\n`
      })
    report += `\n`
  }

  return report
}

