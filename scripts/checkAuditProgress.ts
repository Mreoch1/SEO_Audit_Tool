import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const auditId = process.argv[2] || 'cmidt483w0000kc4nsqae9uf4'
  
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { 
      status: true, 
      updatedAt: true, 
      overallScore: true, 
      rawJson: true,
      createdAt: true
    }
  })

  if (!audit) {
    console.error('❌ Audit not found')
    process.exit(1)
  }

  const elapsed = Math.floor((Date.now() - audit.createdAt.getTime()) / 1000 / 60)
  const lastUpdate = Math.floor((Date.now() - audit.updatedAt.getTime()) / 1000)

  console.log(`\n📊 Audit Progress Check`)
  console.log(`Status: ${audit.status}`)
  console.log(`Elapsed time: ${elapsed} minutes`)
  console.log(`Last update: ${lastUpdate} seconds ago`)
  console.log(`Score: ${audit.overallScore || 'N/A'}`)

  if (audit.rawJson) {
    const data = JSON.parse(audit.rawJson)
    console.log(`\nPages crawled: ${data.pages?.length || 0}`)
    
    if (data.pages && data.pages.length > 0) {
      const pagesWithPageSpeed = data.pages.filter((p: any) => 
        p.pageSpeedData && (p.pageSpeedData.mobile?.lcp > 0 || p.pageSpeedData.desktop?.lcp > 0)
      )
      console.log(`Pages with PageSpeed: ${pagesWithPageSpeed.length}/${data.pages.length}`)
      
      // Check main page
      const mainPage = data.pages.find((p: any) => 
        p.url === 'https://linear.app' || p.url === 'https://linear.app/'
      )
      if (mainPage) {
        console.log(`\nMain page found: ${mainPage.url}`)
        console.log(`Has PageSpeed: ${!!mainPage.pageSpeedData}`)
        if (mainPage.pageSpeedData) {
          console.log(`Mobile LCP: ${mainPage.pageSpeedData.mobile?.lcp || 'N/A'}`)
          console.log(`Desktop LCP: ${mainPage.pageSpeedData.desktop?.lcp || 'N/A'}`)
        }
      }
      
      // Check duplicate titles
      const duplicateTitleIssues = data.onPageIssues?.filter((i: any) => 
        i.message?.includes('duplicate title') || i.message?.includes('Duplicate title')
      ) || []
      const siteWideUnique = new Set(data.siteWide?.duplicateTitles || []).size
      const issueCount = duplicateTitleIssues.reduce((sum: number, issue: any) => 
        sum + (issue.affectedPages?.length || 0), 0
      )
      console.log(`\nDuplicate titles:`)
      console.log(`  Issues count: ${issueCount}`)
      console.log(`  Site-wide unique: ${siteWideUnique}`)
      console.log(`  Match: ${Math.abs(issueCount - siteWideUnique) <= 2 ? '✅' : '❌'}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

