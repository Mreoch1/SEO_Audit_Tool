import { PrismaClient } from '@prisma/client'
import { sendEmail } from '../lib/email'

const prisma = new PrismaClient()

async function main() {
  const emailTo = 'mreoch82@hotmail.com'

  console.log('🧪 Testing email with Zoho account as FROM address...\n')

  // Temporarily update settings to use Zoho email as FROM
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  if (!settings) {
    console.error('❌ No settings found')
    process.exit(1)
  }

  // Try using the Zoho SMTP user email as the FROM address
  // This might help with deliverability since it matches the SMTP server domain
  const originalFrom = settings.smtpFrom
  
  console.log('Current FROM:', settings.smtpFrom)
  console.log('SMTP User:', settings.smtpUser)
  console.log('\nTrying to send from SMTP user email...\n')

  // Update FROM to match SMTP user (Zoho email)
  await prisma.appSettings.update({
    where: { id: 'singleton' },
    data: {
      smtpFrom: settings.smtpUser // Use Zoho email as FROM
    }
  })

  try {
    await sendEmail({
      to: emailTo,
      subject: 'Test Email - Zoho FROM Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Test Email</h2>
          <p>This email is being sent FROM the Zoho email address (${settings.smtpUser}) instead of contact@seoauditpro.net.</p>
          <p>This might improve deliverability to Hotmail.</p>
          <p>Time: ${new Date().toISOString()}</p>
        </div>
      `
    })

    console.log('✅ Test email sent!')
    console.log(`   FROM: ${settings.smtpUser}`)
    console.log(`   TO: ${emailTo}`)
    console.log('\n✨ Check your inbox at mreoch82@hotmail.com\n')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    // Restore original FROM address
    await prisma.appSettings.update({
      where: { id: 'singleton' },
      data: {
        smtpFrom: originalFrom
      }
    })
    console.log('Restored original FROM address')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

