import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const auditId = process.argv[2] || 'cmidr6waz00002vt2hts2f6bp'
  
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { rawJson: true, url: true }
  })

  if (!audit || !audit.rawJson) {
    console.error('❌ Audit not found')
    process.exit(1)
  }

  const result = JSON.parse(audit.rawJson)
  console.log(`\n📊 PageSpeed Analysis for: ${audit.url}\n`)
  console.log(`Total pages: ${result.pages?.length || 0}\n`)

  // Check first 5 pages
  console.log('First 5 pages:')
  result.pages?.slice(0, 5).forEach((p: any, i: number) => {
    console.log(`\n${i + 1}. ${p.url}`)
    console.log(`   Title: ${p.title || 'N/A'}`)
    console.log(`   Has pageSpeedData: ${!!p.pageSpeedData}`)
    if (p.pageSpeedData) {
      console.log(`   Mobile LCP: ${p.pageSpeedData.mobile?.lcp || 'N/A'}`)
      console.log(`   Desktop LCP: ${p.pageSpeedData.desktop?.lcp || 'N/A'}`)
      console.log(`   Structure: ${JSON.stringify(Object.keys(p.pageSpeedData))}`)
    }
  })

  // Check if main page was identified
  const startUrl = audit.url.replace(/\/$/, '').toLowerCase()
  const mainPage = result.pages?.find((p: any) => {
    const pageUrl = p.url.replace(/\/$/, '').toLowerCase()
    return pageUrl === startUrl || pageUrl === startUrl + '/'
  })

  console.log(`\n🔍 Main Page Check:`)
  if (mainPage) {
    console.log(`   ✅ Main page found: ${mainPage.url}`)
    console.log(`   Has PageSpeed: ${!!mainPage.pageSpeedData}`)
    if (mainPage.pageSpeedData) {
      console.log(`   Mobile LCP: ${mainPage.pageSpeedData.mobile?.lcp}`)
      console.log(`   Desktop LCP: ${mainPage.pageSpeedData.desktop?.lcp}`)
    } else {
      console.log(`   ❌ No PageSpeed data - API may have failed or main page not identified during crawl`)
    }
  } else {
    console.log(`   ❌ Main page not found in pages array`)
    console.log(`   Looking for: ${startUrl}`)
    console.log(`   First page URL: ${result.pages?.[0]?.url}`)
  }

  // Count pages with PageSpeed
  const pagesWithPageSpeed = result.pages?.filter((p: any) => {
    if (!p.pageSpeedData) return false
    const psd = p.pageSpeedData
    return (psd.mobile?.lcp > 0) || (psd.desktop?.lcp > 0)
  }) || []

  console.log(`\n📈 Summary:`)
  console.log(`   Pages with PageSpeed data: ${pagesWithPageSpeed.length}/${result.pages?.length || 0}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

