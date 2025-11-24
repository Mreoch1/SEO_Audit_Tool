import { PrismaClient } from '@prisma/client'
import { sendEmail } from '../lib/email'

const prisma = new PrismaClient()

async function main() {
  const auditId = 'cmidaxcvh00003ulu5sh0c7lm'
  const emailTo = 'mreoch82@hotmail.com'

  console.log(`📧 Sending Linear.app audit email...`)
  console.log(`   To: ${emailTo}\n`)

  const audit = await prisma.audit.findUnique({
    where: { id: auditId }
  })

  if (!audit) {
    console.error('❌ Audit not found')
    process.exit(1)
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  const url = new URL(audit.url)
  const domain = url.hostname.replace('www.', '')

  // Generate TL;DR summary
  const topIssues = []
  if (audit.overallScore < 70) topIssues.push('Overall score below 70')
  if (audit.technicalScore < 80) topIssues.push('Technical SEO issues')
  if (audit.onPageScore < 70) topIssues.push('On-page optimization needed')
  if (audit.contentScore < 70) topIssues.push('Content quality improvements')
  if (audit.accessibilityScore < 50) topIssues.push('Accessibility concerns')

  const tldr = topIssues.length > 0 
    ? topIssues.slice(0, 5).join(', ')
    : 'No critical issues found'

  console.log('📧 Sending email (without PDF - will send PDF separately)...')

  try {
    await sendEmail({
      to: emailTo,
      subject: `Your SEO Audit for ${domain} is Ready 📄`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">${settings?.brandName || 'SEO AUDIT PRO'}</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Your SEO Audit is Ready!</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              We've completed a comprehensive SEO audit of <strong>${audit.url}</strong>.
            </p>
            
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: bold;">
                📋 TL;DR - Top Issues Found:
              </p>
              <p style="margin: 8px 0 0 0; color: #78350f; font-size: 13px;">
                ${tldr}
              </p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
              <h3 style="color: #1f2937; margin-top: 0;">Overall Score: ${audit.overallScore}/100</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                <div>
                  <strong>Technical SEO:</strong> ${audit.technicalScore}/100
                </div>
                <div>
                  <strong>On-Page SEO:</strong> ${audit.onPageScore}/100
                </div>
                <div>
                  <strong>Content Quality:</strong> ${audit.contentScore}/100
                </div>
                <div>
                  <strong>Accessibility:</strong> ${audit.accessibilityScore}/100
                </div>
              </div>
            </div>

            <p style="color: #4b5563; line-height: 1.6;">
              <strong>Summary:</strong><br>
              ${audit.shortSummary}
            </p>

            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;">
                <strong>📄 PDF Report:</strong> The detailed PDF report with full analysis and recommendations will be sent in a follow-up email shortly.
              </p>
            </div>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>💡 Tip:</strong> If you don't see this email in your inbox, please check your spam/junk folder. Hotmail sometimes filters automated emails.
              </p>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              Questions? Reply to this email and we'll be happy to help!
            </p>
          </div>
        </div>
      `
    })

    console.log('✅ Email sent successfully!')
    console.log(`\n✨ Check your inbox at ${emailTo}`)
    console.log('   If not in inbox, check spam/junk folder\n')
  } catch (error) {
    console.error('❌ Error sending email:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
    }
    process.exit(1)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

