import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const auditId = process.argv[2] || 'cmiduppn2000011dlhzg0phye'
  
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { rawJson: true }
  })

  if (!audit || !audit.rawJson) {
    console.error('❌ Audit not found')
    process.exit(1)
  }

  const data = JSON.parse(audit.rawJson)
  const pages = data.pages || []
  
  // Build title map
  const titleMap = new Map<string, Array<{ url: string; wordCount: number; h1Count: number; h2Count: number }>>()
  
  pages.forEach((page: any) => {
    if (page.title) {
      const normalized = page.title.toLowerCase().trim().replace(/\s+/g, ' ')
      if (!titleMap.has(normalized)) {
        titleMap.set(normalized, [])
      }
      titleMap.get(normalized)!.push({
        url: page.url,
        wordCount: page.wordCount || 0,
        h1Count: page.h1Count || 0,
        h2Count: page.h2Count || 0
      })
    }
  })

  console.log('\n📊 Duplicate Title Analysis\n')
  
  let duplicateCount = 0
  titleMap.forEach((entries, title) => {
    if (entries.length > 1) {
      duplicateCount++
      console.log(`\n${duplicateCount}. Title: "${title}"`)
      console.log(`   Pages: ${entries.length}`)
      
      // Check template detection criteria
      const wordCounts = entries.map(e => e.wordCount)
      const avgWordCount = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
      const wordCountVariance = wordCounts.every(wc => Math.abs(wc - avgWordCount) < 50)
      
      const h1Counts = entries.map(e => e.h1Count)
      const sameH1Count = h1Counts.every(count => count === h1Counts[0])
      
      const h2Counts = entries.map(e => e.h2Count)
      const sameH2Count = h2Counts.every(count => count === h2Counts[0])
      
      const duplicatePercentage = (entries.length / pages.length) * 100
      const isTemplateBased = duplicatePercentage >= 50 && wordCountVariance && sameH1Count && sameH2Count && entries.length >= 3
      
      console.log(`   Template detection:`)
      console.log(`     - Duplicate %: ${duplicatePercentage.toFixed(1)}% (need >=50%)`)
      console.log(`     - Word count variance: ${wordCountVariance} (need true)`)
      console.log(`     - Same H1 count: ${sameH1Count} (need true)`)
      console.log(`     - Same H2 count: ${sameH2Count} (need true)`)
      console.log(`     - Page count >= 3: ${entries.length >= 3}`)
      console.log(`     - Is template-based: ${isTemplateBased}`)
      console.log(`     - Expected severity: ${isTemplateBased ? 'Low' : 'Medium'}`)
      
      entries.forEach((e, i) => {
        console.log(`     ${i + 1}. ${e.url} (words: ${e.wordCount}, h1: ${e.h1Count}, h2: ${e.h2Count})`)
      })
    }
  })

  console.log(`\n📈 Summary:`)
  console.log(`   Total duplicate title groups: ${duplicateCount}`)
  console.log(`   Site-wide duplicateTitles: ${data.siteWide?.duplicateTitles?.length || 0}`)
  console.log(`   Unique duplicateTitles: ${new Set(data.siteWide?.duplicateTitles || []).size}`)
  console.log(`   Duplicate title issues: ${data.onPageIssues?.filter((i: any) => i.message?.includes('duplicate title') || i.message?.includes('Duplicate title')).length || 0}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

