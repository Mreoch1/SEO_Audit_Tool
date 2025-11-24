import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const audits = await prisma.audit.findMany({
    where: { url: 'https://linear.app' },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      id: true,
      status: true,
      createdAt: true,
      overallScore: true,
      rawJson: true
    }
  })

  if (audits.length > 0) {
    const audit = audits[0]
    console.log('Latest Linear.app audit:')
    console.log('  ID:', audit.id)
    console.log('  Status:', audit.status)
    console.log('  Created:', audit.createdAt)
    console.log('  Score:', audit.overallScore)
    console.log('  Has data:', !!audit.rawJson)
    if (audit.rawJson) {
      const data = JSON.parse(audit.rawJson)
      console.log('  Pages:', data.pages?.length || 0)
      console.log('  Issues:', (data.technicalIssues?.length || 0) + (data.onPageIssues?.length || 0) + (data.contentIssues?.length || 0))
    }
  } else {
    console.log('No existing audits found for linear.app')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

