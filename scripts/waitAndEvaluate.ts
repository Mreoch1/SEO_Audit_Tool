import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

async function main() {
  const auditId = process.argv[2] || 'cmidkp4rw0000oms00d4dcgds'
  
  console.log(`\n⏳ Waiting for audit ${auditId} to complete...\n`)
  
  let lastStatus = ''
  while (true) {
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { status: true, updatedAt: true, createdAt: true }
    })
    
    if (!audit) {
      console.error('❌ Audit not found')
      break
    }
    
    if (audit.status !== lastStatus) {
      const elapsed = Math.floor((Date.now() - audit.createdAt.getTime()) / 1000 / 60)
      console.log(`📊 Status: ${audit.status} (running for ${elapsed} minutes)`)
      lastStatus = audit.status
    }
    
    if (audit.status === 'completed') {
      console.log('\n✅ Audit completed! Running evaluation...\n')
      await prisma.$disconnect()
      
      // Run evaluation
      try {
        execSync(`npx tsx scripts/comprehensiveAuditEvaluation.ts ${auditId}`, { stdio: 'inherit' })
      } catch (error) {
        console.error('Evaluation failed:', error)
      }
      break
    }
    
    if (audit.status === 'failed') {
      console.log('\n❌ Audit failed')
      break
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000)) // Check every 10 seconds
  }
  
  await prisma.$disconnect()
}

main().catch(console.error)

