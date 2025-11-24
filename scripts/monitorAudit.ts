import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const auditId = process.argv[2] || 'cmidkp4rw0000oms00d4dcgds'
  
  while (true) {
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { status: true, updatedAt: true, createdAt: true }
    })
    
    if (!audit) {
      console.log('Audit not found')
      break
    }
    
    const elapsed = Math.floor((Date.now() - audit.createdAt.getTime()) / 1000 / 60)
    const lastUpdate = Math.floor((Date.now() - audit.updatedAt.getTime()) / 1000)
    
    console.log(`\rStatus: ${audit.status} | Running: ${elapsed}m | Last update: ${lastUpdate}s ago`, { end: '' })
    
    if (audit.status === 'completed' || audit.status === 'failed') {
      console.log('\n')
      break
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  
  await prisma.$disconnect()
}

main().catch(console.error)

