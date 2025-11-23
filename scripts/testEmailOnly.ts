#!/usr/bin/env node
/**
 * Quick test to verify email sending works
 */

import { prisma } from '../lib/db'
import { sendEmail } from '../lib/email'

async function main() {
  const emailTo = 'mreoch82@hotmail.com'

  console.log(`\n📧 Testing email to: ${emailTo}\n`)

  try {
    // Check SMTP settings
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' }
    })

    if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPassword) {
      console.error('❌ SMTP settings not configured')
      process.exit(1)
    }

    console.log('✅ SMTP settings found')
    console.log(`   Host: ${settings.smtpHost}`)
    console.log(`   User: ${settings.smtpUser}\n`)

    // Send test email
    console.log('📤 Sending test email...')
    await sendEmail({
      to: emailTo,
      subject: 'SEO Audit Pro - Test Email',
      text: 'This is a test email from SEO Audit Pro. If you receive this, email configuration is working correctly.',
      html: '<p>This is a test email from SEO Audit Pro. If you receive this, email configuration is working correctly.</p>'
    })

    console.log('✅ Test email sent successfully!')
    console.log(`\n✨ Check your inbox at ${emailTo}\n`)

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error)
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


