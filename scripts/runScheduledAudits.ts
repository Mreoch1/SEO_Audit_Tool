#!/usr/bin/env node
/**
 * Scheduled Audits Runner
 * 
 * This script should be run periodically (e.g., every 15 minutes) via cron:
 *   Every 15 minutes: cd /path/to/seo-audit-app && npm run runScheduledAudits
 * 
 * It checks all active scheduled audits and runs them if their cron expression
 * indicates they should run now.
 */

import { prisma } from '../lib/db'
import { shouldRunNow } from '../lib/cron'
import { runAudit } from '../lib/seoAudit'
import { generateShortSummary } from '../lib/reportSummary'
import { generatePDF } from '../lib/pdf'
import { sendEmail } from '../lib/email'

async function main() {
  console.log(`\n🕐 Checking scheduled audits at ${new Date().toISOString()}\n`)

  try {
    // Get all active scheduled audits
    const scheduledAudits = await prisma.scheduledAudit.findMany({
      where: { active: true }
    })

    if (scheduledAudits.length === 0) {
      console.log('No active scheduled audits found.\n')
      return
    }

    console.log(`Found ${scheduledAudits.length} active scheduled audit(s)\n`)

    for (const scheduled of scheduledAudits) {
      const shouldRun = shouldRunNow(scheduled.cronExpression, scheduled.lastRunAt)

      if (!shouldRun) {
        console.log(`⏭️  Skipping ${scheduled.url} (not due yet)`)
        continue
      }

      console.log(`🚀 Running audit for: ${scheduled.url}`)

      try {
        // Run audit
        const auditResult = await runAudit(scheduled.url, {
          maxPages: 50,
          maxDepth: 3
        })

        // Generate summaries
        const shortSummary = generateShortSummary(auditResult)
        const { generateDetailedSummary } = await import('../lib/reportSummary')
        const detailedSummary = generateDetailedSummary(auditResult)

        // Save to database
        const audit = await prisma.audit.create({
          data: {
            url: scheduled.url,
            overallScore: auditResult.summary.overallScore,
            technicalScore: auditResult.summary.technicalScore,
            onPageScore: auditResult.summary.onPageScore,
            contentScore: auditResult.summary.contentScore,
            accessibilityScore: auditResult.summary.accessibilityScore,
            shortSummary,
            detailedSummary,
            rawJson: JSON.stringify(auditResult),
            issues: {
              create: [
                ...auditResult.technicalIssues,
                ...auditResult.onPageIssues,
                ...auditResult.contentIssues,
                ...auditResult.accessibilityIssues,
                ...auditResult.performanceIssues
              ].map(issue => ({
                category: issue.category,
                severity: issue.severity,
                message: issue.message,
                details: issue.details || '',
                affectedPagesJson: JSON.stringify(issue.affectedPages || [])
              }))
            }
          }
        })

        console.log(`   ✅ Audit completed (Score: ${auditResult.summary.overallScore}/100)`)

        // Update last run time
        await prisma.scheduledAudit.update({
          where: { id: scheduled.id },
          data: { lastRunAt: new Date() }
        })

        // Send email if configured
        if (scheduled.emailTo) {
          console.log(`   📧 Sending email to: ${scheduled.emailTo}`)

          try {
            const settings = await prisma.appSettings.findUnique({
              where: { id: 'singleton' }
            })

            const branding = {
              brandName: settings?.brandName || 'SEO Audit Pro',
              brandSubtitle: settings?.brandSubtitle || undefined,
              primaryColor: settings?.primaryColor || '#2563eb',
              logoUrl: settings?.logoUrl || '/logo.png'
            }

            const pdfBuffer = await generatePDF(auditResult, branding, scheduled.url)

            await sendEmail({
              to: scheduled.emailTo,
              subject: `SEO Audit Report - ${scheduled.url}`,
              text: `Please find attached the SEO audit report for ${scheduled.url}.\n\n${shortSummary}`,
              html: `
                <h2>SEO Audit Report</h2>
                <p>Please find attached the SEO audit report for <strong>${scheduled.url}</strong>.</p>
                <p>${shortSummary.replace(/\n/g, '<br>')}</p>
              `,
              attachments: [{
                filename: `seo-audit-${audit.id}.pdf`,
                content: pdfBuffer
              }]
            })

            console.log(`   ✅ Email sent successfully`)
          } catch (emailError) {
            console.error(`   ❌ Failed to send email:`, emailError instanceof Error ? emailError.message : emailError)
          }
        }

        console.log(`   💾 Audit ID: ${audit.id}\n`)
      } catch (error) {
        console.error(`   ❌ Error running audit:`, error instanceof Error ? error.message : error)
        console.log('')
      }
    }

    console.log('✨ Scheduled audits check complete!\n')
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

