import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Zoho SMTP Configuration
  const smtpHost = 'smtppro.zoho.com'
  const smtpPort = 465
  const smtpPassword = '9Jgp!##7vcPEMaB'
  
  // Zoho email address
  const smtpUser = 'contact@seoauditpro.net'
  const smtpFrom = 'contact@seoauditpro.net'

  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpFrom,
    },
    create: {
      id: 'singleton',
      brandName: 'SEO Audit Pro',
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpFrom,
    },
  })

  console.log('✅ Zoho SMTP settings updated successfully!')
  console.log(`   Host: ${smtpHost}`)
  console.log(`   Port: ${smtpPort}`)
  console.log(`   User: ${smtpUser}`)
  console.log(`   From: ${smtpFrom}`)
}

main()
  .catch((e) => {
    console.error('❌ Error updating SMTP settings', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

