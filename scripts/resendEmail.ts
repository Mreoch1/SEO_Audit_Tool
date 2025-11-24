import { PrismaClient } from '@prisma/client'
import { generatePDF } from '../lib/pdf'
import { sendEmail } from '../lib/email'
import { Colors } from '../lib/brandColors'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const auditId = process.argv[2]
  const emailTo = process.argv[3] || 'mreoch82@hotmail.com'

  if (!auditId) {
    console.error('Usage: npx tsx scripts/resendEmail.ts <auditId> [emailTo]')
    process.exit(1)
  }

  console.log(`📧 Resending email for audit: ${auditId}`)
  console.log(`   To: ${emailTo}\n`)

  const audit = await prisma.audit.findUnique({
    where: { id: auditId }
  })

  if (!audit) {
    console.error('❌ Audit not found')
    process.exit(1)
  }

  if (!audit.rawJson) {
    console.error('❌ Audit has no result data')
    process.exit(1)
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  if (!settings) {
    console.error('❌ App settings not found')
    process.exit(1)
  }

  console.log('📄 Generating PDF...')
  const auditResult = JSON.parse(audit.rawJson as string)
  const branding = {
    brandName: settings.brandName || 'SEO Audit Pro',
    brandSubtitle: settings.brandSubtitle,
    primaryColor: settings.primaryColor || Colors.primary,
    logoUrl: settings.logoUrl
  }
  const pdfBuffer = await generatePDF(auditResult, branding, audit.url)

  // Get domain name for filename
  const url = new URL(audit.url)
  const domain = url.hostname.replace('www.', '')
  const filename = `${domain}-SEO-Audit.pdf`

  console.log('📧 Sending email...')
  await sendEmail({
    to: emailTo,
    subject: `Your SEO Audit for ${domain} is Ready 📄`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">SEO AUDIT PRO</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1f2937; margin-top: 0;">Your SEO Audit is Ready!</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            We've completed a comprehensive SEO audit of <strong>${audit.url}</strong>.
          </p>
          <p style="color: #4b5563; line-height: 1.6;">
            Your detailed PDF report is attached below. This report includes:
          </p>
          <ul style="color: #4b5563; line-height: 1.8;">
            <li>Overall SEO score and category breakdowns</li>
            <li>Priority action plan with fixable issues</li>
            <li>Technical SEO analysis</li>
            <li>On-page optimization recommendations</li>
            <li>Content quality insights</li>
            <li>Accessibility improvements</li>
          </ul>
          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
              <strong>💡 Tip:</strong> If you don't see this email in your inbox, please check your spam/junk folder.
            </p>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Questions? Reply to this email and we'll be happy to help!
          </p>
        </div>
      </div>
    `,
    attachments: [{
      filename,
      content: pdfBuffer
    }]
  })

  console.log('✅ Email sent successfully!')
  console.log(`\n✨ Check your inbox at ${emailTo}\n`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

