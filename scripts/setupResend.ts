import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const apiKey = process.argv[2]

  if (!apiKey) {
    console.error('Usage: npx tsx scripts/setupResend.ts <resend-api-key>')
    console.error('\nTo get your Resend API key:')
    console.error('1. Go to https://resend.com/api-keys')
    console.error('2. Create a new API key or copy an existing one')
    console.error('3. Run: npx tsx scripts/setupResend.ts re_xxxxxxxxxxxxx\n')
    process.exit(1)
  }

  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: {
      resendApiKey: apiKey,
      emailProvider: 'resend'
    },
    create: {
      id: 'singleton',
      brandName: 'SEO Audit Pro',
      resendApiKey: apiKey,
      emailProvider: 'resend'
    }
  })

  console.log('✅ Resend API key configured successfully!')
  console.log('   Email provider set to: Resend')
  console.log('\n📧 All emails will now be sent via Resend API for better deliverability.\n')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

