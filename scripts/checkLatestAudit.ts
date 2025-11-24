import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const audit = await prisma.audit.findFirst({
    where: {
      url: {
        contains: 'linear'
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      url: true,
      status: true,
      createdAt: true,
      shortSummary: true,
      overallScore: true,
      technicalScore: true,
      onPageScore: true,
      contentScore: true
    }
  })

  if (!audit) {
    console.log('❌ No audit found for linear.app')
    return
  }

  const elapsed = Math.floor((Date.now() - audit.createdAt.getTime()) / 1000 / 60)
  const elapsedSeconds = Math.floor((Date.now() - audit.createdAt.getTime()) / 1000)

  console.log('\n📊 Latest Linear.app Audit Status\n')
  console.log(`   URL: ${audit.url}`)
  console.log(`   ID: ${audit.id}`)
  console.log(`   Status: ${audit.status}`)
  console.log(`   Overall Score: ${audit.overallScore || 'N/A'}`)
  console.log(`   Technical: ${audit.technicalScore || 'N/A'}`)
  console.log(`   On-Page: ${audit.onPageScore || 'N/A'}`)
  console.log(`   Content: ${audit.contentScore || 'N/A'}`)
  console.log(`   Running for: ${elapsed} minutes (${elapsedSeconds} seconds)`)
  console.log(`   Summary: ${audit.shortSummary || 'No summary yet'}`)
  console.log(`   Created: ${audit.createdAt.toLocaleString()}\n`)

  if (audit.status === 'running') {
    console.log('⏳ Audit is still in progress...')
    console.log('   Expected completion: ~7-8 minutes for Standard tier')
    console.log('   The audit is crawling pages, analyzing content, and generating the report.')
  } else if (audit.status === 'completed') {
    console.log('✅ Audit completed!')
    console.log('   Check your email (mreoch82@hotmail.com) for the PDF report.')
  } else if (audit.status === 'failed') {
    console.log('❌ Audit failed')
    console.log('   Check the logs for error details.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

