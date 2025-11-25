import { PrismaClient } from '@prisma/client'
import { sendEmail } from '../lib/email'

const prisma = new PrismaClient()

async function main() {
  const emailTo = process.argv[2] || 'mreoch82@hotmail.com'

  console.log('🧪 Testing SMTP Configuration...\n')

  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  if (!settings) {
    console.error('❌ App settings not found')
    process.exit(1)
  }

  console.log('SMTP Settings:')
  console.log(`  Host: ${settings.smtpHost}`)
  console.log(`  Port: ${settings.smtpPort}`)
  console.log(`  User: ${settings.smtpUser}`)
  console.log(`  From: ${settings.smtpFrom}\n`)

  console.log(`📧 Sending test email to ${emailTo}...`)

  try {
    await sendEmail({
      to: emailTo,
      subject: 'Test Email from SEO Audit Pro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">SEO AUDIT PRO</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Test Email</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              This is a test email to verify SMTP configuration is working correctly.
            </p>
            <p style="color: #4b5563; line-height: 1.6;">
              If you received this email, your SMTP settings are configured properly!
            </p>
          </div>
        </div>
      `
    })

    console.log('✅ Test email sent successfully!')
    console.log(`\n✨ Check your inbox at ${emailTo}\n`)
  } catch (error) {
    console.error('❌ Failed to send test email:', error)
    if (error instanceof Error) {
      console.error('   Error message:', error.message)
    }
    process.exit(1)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

