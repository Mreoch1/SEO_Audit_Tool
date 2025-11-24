import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

interface EvaluationResult {
  score: number
  issues: Array<{
    category: string
    severity: 'High' | 'Medium' | 'Low'
    symptom: string
    rootCause: string
    fix: string
  }>
  clientReview: string
}

async function main() {
  const auditId = process.argv[2] || 'cmidhz3ho0000wb879dsj4av4'
  
  const audit = await prisma.audit.findUnique({
    where: { id: auditId }
  })

  if (!audit || !audit.rawJson) {
    console.error('❌ Audit not found')
    process.exit(1)
  }

  const result = JSON.parse(audit.rawJson)
  const evaluation: EvaluationResult = {
    score: 0,
    issues: [],
    clientReview: ''
  }

  console.log('\n🔍 COMPREHENSIVE AUDIT EVALUATION\n')
  console.log(`Audit ID: ${auditId}`)
  console.log(`URL: ${audit.url}\n`)

  // 1. ACCURACY CHECKS
  console.log('1️⃣  ACCURACY EVALUATION')
  console.log('─'.repeat(50))

  // Schema detection check
  const schemaIssues = result.technicalIssues?.filter((i: any) => 
    i.message?.includes('schema') || i.message?.includes('Schema')
  ) || []
  const schemaPages = schemaIssues.reduce((set: Set<string>, issue: any) => {
    (issue.affectedPages || []).forEach((url: string) => set.add(url))
    return set
  }, new Set<string>())
  
  // Check if pages actually have schema (sample check)
  const samplePages = result.pages?.slice(0, 3) || []
  const pagesWithSchema = samplePages.filter((p: any) => p.hasSchemaMarkup).length
  
  if (schemaIssues.length > 0 && pagesWithSchema > 0) {
    evaluation.issues.push({
      category: 'Schema Detection',
      severity: 'High',
      symptom: `Reports "Missing schema markup" on ${schemaPages.size} pages, but ${pagesWithSchema} sample pages show hasSchemaMarkup=true`,
      rootCause: 'Schema detection not capturing JS-rendered JSON-LD from rendered DOM',
      fix: 'Verify schemaScripts extraction and parsing in analyzeSchema function'
    })
    console.log(`   ❌ Schema: False positive detected (${schemaPages.size} pages flagged, but some have schema)`)
  } else if (schemaIssues.length > 0) {
    console.log(`   ⚠️  Schema: ${schemaPages.size} pages flagged (needs verification)`)
  } else {
    console.log(`   ✅ Schema: No issues reported`)
  }

  // PageSpeed data check
  const pagesWithPageSpeed = result.pages?.filter((p: any) => p.pageSpeedData) || []
  if (pagesWithPageSpeed.length === 0 && result.pages?.length > 0) {
    evaluation.issues.push({
      category: 'Core Web Vitals',
      severity: 'High',
      symptom: 'No PageSpeed data for any pages (0/20)',
      rootCause: 'PageSpeed Insights API failing or not configured',
      fix: 'Check API key, quota, error handling, and ensure API is called for main page'
    })
    console.log(`   ❌ PageSpeed: No data (0/${result.pages.length} pages)`)
  } else {
    console.log(`   ✅ PageSpeed: ${pagesWithPageSpeed.length}/${result.pages.length} pages have data`)
  }

  // Competitor analysis check
  if (result.competitorAnalysis) {
    const gaps = result.competitorAnalysis.keywordGaps?.length || 0
    const shared = result.competitorAnalysis.sharedKeywords?.length || 0
    const competitorKeywords = result.competitorAnalysis.competitorKeywords?.length || 0
    
    if (gaps === 0 && shared === 0 && competitorKeywords === 0) {
      evaluation.issues.push({
        category: 'Competitor Analysis',
        severity: 'High',
        symptom: 'Competitor analysis shows 0 gaps, 0 shared keywords, 0 competitor keywords',
        rootCause: 'Competitor crawling failing or keyword extraction broken',
        fix: 'Add logging, verify competitor URLs are crawled, check keyword extraction logic'
      })
      console.log(`   ❌ Competitor: Empty results (0 gaps, 0 shared, 0 competitor keywords)`)
    } else {
      console.log(`   ✅ Competitor: ${gaps} gaps, ${shared} shared, ${competitorKeywords} competitor keywords`)
    }
  } else {
    evaluation.issues.push({
      category: 'Competitor Analysis',
      severity: 'Medium',
      symptom: 'No competitor analysis data in report',
      rootCause: 'Competitor analysis not run or failed silently',
      fix: 'Check competitor analysis execution and error handling'
    })
    console.log(`   ⚠️  Competitor: No data`)
  }

  // 2. LOGIC & CONSISTENCY CHECKS
  console.log('\n2️⃣  LOGIC & CONSISTENCY')
  console.log('─'.repeat(50))

  // Duplicate title counts
  const duplicateTitleIssues = result.onPageIssues?.filter((i: any) => 
    i.message?.includes('duplicate title') || i.message?.includes('Duplicate title') || i.message?.includes('Template-based duplicate title')
  ) || []
  const duplicateTitlePages = duplicateTitleIssues.reduce((sum: number, issue: any) => 
    sum + (issue.affectedPages?.length || 0), 0
  )
  // CRITICAL FIX: siteWide.duplicateTitles contains all URLs with duplicates (may have duplicates if same URL appears in multiple duplicate groups)
  // Count unique URLs instead of total length
  const siteWideDuplicateUrls = new Set(result.siteWide?.duplicateTitles || [])
  const siteWideUniqueCount = siteWideDuplicateUrls.size
  
  // Allow small difference (1-2 pages) due to potential edge cases
  if (Math.abs(duplicateTitlePages - siteWideUniqueCount) > 2) {
    evaluation.issues.push({
      category: 'Duplicate Detection',
      severity: 'Medium',
      symptom: `Duplicate title counts don't match: issues=${duplicateTitlePages}, siteWide unique=${siteWideUniqueCount}`,
      rootCause: 'Different counting logic in different sections',
      fix: 'Use single source of truth for duplicate counts'
    })
    console.log(`   ❌ Duplicate titles: Count mismatch (issues: ${duplicateTitlePages}, siteWide unique: ${siteWideUniqueCount})`)
  } else {
    console.log(`   ✅ Duplicate titles: Counts match (${duplicateTitlePages} pages)`)
  }

  // Word count consistency
  const thinContentIssues = result.contentIssues?.filter((i: any) => 
    i.message?.includes('Thin content') || i.message?.includes('thin content')
  ) || []
  const thinContentPages = thinContentIssues.reduce((sum: number, issue: any) => 
    sum + (issue.affectedPages?.length || 0), 0
  )
  
  // Check if word counts in page table match thin content detection
  const pagesWithLowWordCount = result.pages?.filter((p: any) => 
    (p.wordCount || 0) < 300
  ) || []
  
  if (pagesWithLowWordCount.length !== thinContentPages) {
    evaluation.issues.push({
      category: 'Content Analysis',
      severity: 'Medium',
      symptom: `Thin content count mismatch: issues=${thinContentPages}, pages<300 words=${pagesWithLowWordCount.length}`,
      rootCause: 'Different word count extraction methods or thresholds',
      fix: 'Standardize word count extraction and thin content threshold'
    })
    console.log(`   ⚠️  Thin content: Count mismatch (issues: ${thinContentPages}, pages<300: ${pagesWithLowWordCount.length})`)
  } else {
    console.log(`   ✅ Thin content: Counts match (${thinContentPages} pages)`)
  }

  // Title extraction accuracy
  const uniqueTitles = new Set(result.pages?.map((p: any) => p.title).filter(Boolean) || [])
  const totalPages = result.pages?.length || 0
  
  if (uniqueTitles.size < totalPages * 0.3) {
    evaluation.issues.push({
      category: 'Title Extraction',
      severity: 'High',
      symptom: `Only ${uniqueTitles.size} unique titles for ${totalPages} pages (likely template reuse or extraction error)`,
      rootCause: 'Title extraction from initial HTML instead of rendered DOM',
      fix: 'Extract titles from rendered DOM using Puppeteer'
    })
    console.log(`   ❌ Title extraction: Only ${uniqueTitles.size} unique titles for ${totalPages} pages`)
  } else {
    console.log(`   ✅ Title extraction: ${uniqueTitles.size} unique titles for ${totalPages} pages`)
  }

  // 3. SCORING CONSISTENCY
  console.log('\n3️⃣  SCORING CONSISTENCY')
  console.log('─'.repeat(50))

  // Accessibility score check
  const accessibilityIssues = result.accessibilityIssues?.length || 0
  const accessibilityScore = audit.accessibilityScore || 0
  
  if (accessibilityIssues <= 2 && accessibilityScore < 50) {
    evaluation.issues.push({
      category: 'Accessibility Scoring',
      severity: 'Medium',
      symptom: `Accessibility score ${accessibilityScore}/100 but only ${accessibilityIssues} issues reported`,
      rootCause: 'Scoring formula too harsh or double-penalizing',
      fix: 'Rebalance accessibility scoring to match issue count and severity'
    })
    console.log(`   ⚠️  Accessibility: Score ${accessibilityScore}/100 with only ${accessibilityIssues} issues`)
  } else {
    console.log(`   ✅ Accessibility: Score ${accessibilityScore}/100 with ${accessibilityIssues} issues`)
  }

  // 4. CLIENT-FACING QUALITY
  console.log('\n4️⃣  CLIENT-FACING QUALITY')
  console.log('─'.repeat(50))

  const hasPageSpeed = pagesWithPageSpeed.length > 0
  const hasCompetitorData = result.competitorAnalysis && 
    (result.competitorAnalysis.keywordGaps?.length > 0 || result.competitorAnalysis.sharedKeywords?.length > 0)
  const hasSchemaData = !schemaIssues.some((i: any) => i.affectedPages?.length > 10)
  
  console.log(`   PageSpeed data: ${hasPageSpeed ? '✅' : '❌'}`)
  console.log(`   Competitor analysis: ${hasCompetitorData ? '✅' : '❌'}`)
  console.log(`   Schema detection: ${hasSchemaData ? '✅' : '❌'}`)

  // Calculate quality score
  let score = 10
  
  // Deduct for critical issues
  evaluation.issues.forEach(issue => {
    if (issue.severity === 'High') score -= 2
    else if (issue.severity === 'Medium') score -= 1
    else score -= 0.5
  })
  
  // Deduct for missing features
  if (!hasPageSpeed) score -= 1.5
  if (!hasCompetitorData) score -= 1.5
  if (!hasSchemaData) score -= 1
  
  evaluation.score = Math.max(0, Math.min(10, Math.round(score * 10) / 10))

  // Generate client review
  evaluation.clientReview = `\n📋 CLIENT-FACING REVIEW\n${'═'.repeat(60)}\n\n`
  evaluation.clientReview += `Overall Assessment: ${evaluation.score >= 8 ? 'Good' : evaluation.score >= 6 ? 'Needs Improvement' : 'Poor'}\n\n`
  
  if (hasPageSpeed && hasCompetitorData && hasSchemaData) {
    evaluation.clientReview += `✅ Strengths:\n`
    evaluation.clientReview += `   - Core Web Vitals data is available\n`
    evaluation.clientReview += `   - Competitor analysis provides actionable insights\n`
    evaluation.clientReview += `   - Schema detection is accurate\n\n`
  } else {
    evaluation.clientReview += `⚠️  Concerns:\n`
    if (!hasPageSpeed) evaluation.clientReview += `   - Core Web Vitals data is missing (critical for performance analysis)\n`
    if (!hasCompetitorData) evaluation.clientReview += `   - Competitor analysis appears incomplete or broken\n`
    if (!hasSchemaData) evaluation.clientReview += `   - Schema detection may have false positives\n\n`
  }

  // Output results
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`\n📊 AUDIT ENGINE QUALITY SCORE: ${evaluation.score}/10\n`)
  console.log(evaluation.clientReview)
  
  console.log(`\n🔧 FIX LIST (${evaluation.issues.length} issues)\n`)
  evaluation.issues.forEach((issue, idx) => {
    console.log(`${idx + 1}. [${issue.severity}] ${issue.category}`)
    console.log(`   Symptom: ${issue.symptom}`)
    console.log(`   Root Cause: ${issue.rootCause}`)
    console.log(`   Fix: ${issue.fix}\n`)
  })

  // Save evaluation
  const evalPath = `linear-audit-evaluation-${auditId}.json`
  fs.writeFileSync(evalPath, JSON.stringify(evaluation, null, 2))
  console.log(`\n💾 Evaluation saved to: ${evalPath}\n`)

  return evaluation
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

