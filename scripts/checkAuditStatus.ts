import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const auditId = process.argv[2] || 'cmidwxdw80000grkccyxv2ry1'
  
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { 
      status: true, 
      rawJson: true, 
      updatedAt: true,
      overallScore: true
    }
  })

  if (!audit) {
    console.error('❌ Audit not found')
    process.exit(1)
  }

  const elapsed = Math.floor((Date.now() - audit.updatedAt.getTime()) / 1000 / 60)
  
  console.log(`\n📊 Audit Status`)
  console.log(`Status: ${audit.status}`)
  console.log(`Last update: ${elapsed} minutes ago`)
  console.log(`Score: ${audit.overallScore || 'N/A'}`)

  if (audit.rawJson) {
    const data = JSON.parse(audit.rawJson)
    console.log(`\nPages: ${data.pages?.length || 0}/20`)
    
    if (data.pages && data.pages.length >= 20) {
      console.log('✅ All pages crawled!')
    }
    
    if (audit.status === 'running' && data.pages && data.pages.length >= 20) {
      console.log('⚠️  Status is "running" but all pages are crawled - may be in final processing')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
