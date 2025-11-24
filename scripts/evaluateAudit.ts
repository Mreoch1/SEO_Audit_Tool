import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const auditId = process.argv[2] || 'cmidhz3ho0000wb879dsj4av4'
  
  const audit = await prisma.audit.findUnique({
    where: { id: auditId }
  })

  if (!audit || !audit.rawJson) {
    console.error('❌ Audit not found or has no data')
    process.exit(1)
  }

  const result = JSON.parse(audit.rawJson)
  
  // Save to file for analysis
  const outputPath = path.join(process.cwd(), `linear-audit-${auditId}.json`)
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
  
  console.log(`\n📊 Audit Report Analysis`)
  console.log(`   Audit ID: ${auditId}`)
  console.log(`   URL: ${audit.url}`)
  console.log(`   Overall Score: ${audit.overallScore}/100`)
  console.log(`   Technical: ${audit.technicalScore}/100`)
  console.log(`   On-Page: ${audit.onPageScore}/100`)
  console.log(`   Content: ${audit.contentScore}/100`)
  console.log(`   Accessibility: ${audit.accessibilityScore}/100`)
  console.log(`\n   Pages analyzed: ${result.pages?.length || 0}`)
  console.log(`   Technical issues: ${result.technicalIssues?.length || 0}`)
  console.log(`   On-page issues: ${result.onPageIssues?.length || 0}`)
  console.log(`   Content issues: ${result.contentIssues?.length || 0}`)
  console.log(`   Accessibility issues: ${result.accessibilityIssues?.length || 0}`)
  console.log(`\n   Report saved to: ${outputPath}\n`)
  
  // Quick consistency checks
  console.log('🔍 Quick Consistency Checks:')
  
  // Check page count consistency
  const pagesInTable = result.pages?.length || 0
  const pagesInSummary = result.summary?.totalPages || 0
  if (pagesInTable !== pagesInSummary) {
    console.log(`   ⚠️  Page count mismatch: table=${pagesInTable}, summary=${pagesInSummary}`)
  } else {
    console.log(`   ✅ Page counts match: ${pagesInTable}`)
  }
  
  // Check duplicate titles
  const duplicateTitleIssues = result.onPageIssues?.filter((i: any) => 
    i.message?.includes('duplicate title') || i.message?.includes('Duplicate title')
  ) || []
  const duplicateTitlePages = duplicateTitleIssues.reduce((sum: number, issue: any) => 
    sum + (issue.affectedPages?.length || 0), 0
  )
  console.log(`   📄 Duplicate titles: ${duplicateTitleIssues.length} unique titles, ${duplicateTitlePages} total pages`)
  
  // Check schema detection
  const schemaIssues = result.technicalIssues?.filter((i: any) => 
    i.message?.includes('schema') || i.message?.includes('Schema')
  ) || []
  console.log(`   🔍 Schema issues: ${schemaIssues.length}`)
  
  // Check PageSpeed data
  const pagesWithPageSpeed = result.pages?.filter((p: any) => p.pageSpeedData) || []
  console.log(`   ⚡ Pages with PageSpeed data: ${pagesWithPageSpeed.length}/${pagesInTable}`)
  
  // Check competitor analysis
  if (result.competitorAnalysis) {
    const gaps = result.competitorAnalysis.keywordGaps?.length || 0
    const shared = result.competitorAnalysis.sharedKeywords?.length || 0
    console.log(`   🏆 Competitor analysis: ${gaps} gaps, ${shared} shared keywords`)
  } else {
    console.log(`   ⚠️  No competitor analysis data`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

