import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const auditId = process.argv[2] || 'cmidaxcvh00003ulu5sh'
  
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      shortSummary: true,
      url: true
    }
  })

  if (!audit) {
    console.log('❌ Audit not found')
    return
  }

  const elapsed = Math.floor((Date.now() - audit.createdAt.getTime()) / 1000 / 60)
  const elapsedSeconds = Math.floor((Date.now() - audit.createdAt.getTime()) / 1000)

  console.log('\n📊 Audit Status Update\n')
  console.log(`   URL: ${audit.url}`)
  console.log(`   ID: ${audit.id}`)
  console.log(`   Status: ${audit.status}`)
  console.log(`   Running for: ${elapsed} minutes (${elapsedSeconds} seconds)`)
  console.log(`   Summary: ${audit.shortSummary || 'No summary yet'}\n`)

  if (audit.status === 'running') {
    console.log('⏳ Audit is still in progress...')
    console.log('   Expected completion: ~7-8 minutes for Standard tier')
  } else if (audit.status === 'completed') {
    console.log('✅ Audit completed!')
  } else if (audit.status === 'failed') {
    console.log('❌ Audit failed')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

