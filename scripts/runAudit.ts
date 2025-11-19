#!/usr/bin/env node
/**
 * CLI Tool for Running SEO Audits
 * 
 * Usage:
 *   npm run audit -- --url=https://example.com
 *   npm run audit -- --url=https://example.com --maxPages=100 --maxDepth=4
 *   npm run audit -- --url=https://example.com --emailTo=client@example.com
 *   npm run audit -- --url=https://example.com --output=./reports/audit.pdf
 */

import { runAudit } from '../lib/seoAudit'
import { generateShortSummary, generateDetailedSummary } from '../lib/reportSummary'
import { generatePDF } from '../lib/pdf'
import { prisma } from '../lib/db'
import { sendEmail } from '../lib/email'
import fs from 'fs'
import path from 'path'

interface CliOptions {
  url?: string
  maxPages?: string
  maxDepth?: string
  emailTo?: string
  output?: string
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  const options: CliOptions = {}

  args.forEach(arg => {
    if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1]
    } else if (arg.startsWith('--maxPages=')) {
      options.maxPages = arg.split('=')[1]
    } else if (arg.startsWith('--maxDepth=')) {
      options.maxDepth = arg.split('=')[1]
    } else if (arg.startsWith('--emailTo=')) {
      options.emailTo = arg.split('=')[1]
    } else if (arg.startsWith('--output=')) {
      options.output = arg.split('=')[1]
    }
  })

  return options
}

async function main() {
  const options = parseArgs()

  if (!options.url) {
    console.error('Error: --url is required')
    console.log('\nUsage:')
    console.log('  npm run audit -- --url=https://example.com')
    console.log('  npm run audit -- --url=https://example.com --maxPages=100 --maxDepth=4')
    console.log('  npm run audit -- --url=https://example.com --emailTo=client@example.com')
    console.log('  npm run audit -- --url=https://example.com --output=./reports/audit.pdf')
    process.exit(1)
  }

  const maxPages = options.maxPages ? parseInt(options.maxPages) : 50
  const maxDepth = options.maxDepth ? parseInt(options.maxDepth) : 3

  console.log(`\n🔍 Starting SEO audit for: ${options.url}`)
  console.log(`   Max Pages: ${maxPages}, Max Depth: ${maxDepth}\n`)

  try {
    // Run audit
    const auditResult = await runAudit(options.url, { maxPages, maxDepth })

    // Generate summaries
    const shortSummary = generateShortSummary(auditResult)
    const detailedSummary = generateDetailedSummary(auditResult)

    // Save to database
    const audit = await prisma.audit.create({
      data: {
        url: options.url,
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

    console.log('✅ Audit completed!')
    console.log(`\n📊 Scores:`)
    console.log(`   Overall: ${auditResult.summary.overallScore}/100`)
    console.log(`   Technical: ${auditResult.summary.technicalScore}/100`)
    console.log(`   On-Page: ${auditResult.summary.onPageScore}/100`)
    console.log(`   Content: ${auditResult.summary.contentScore}/100`)
    console.log(`   Accessibility: ${auditResult.summary.accessibilityScore}/100`)
    console.log(`\n📄 Issues:`)
    console.log(`   High: ${auditResult.summary.highSeverityIssues}`)
    console.log(`   Medium: ${auditResult.summary.mediumSeverityIssues}`)
    console.log(`   Low: ${auditResult.summary.lowSeverityIssues}`)
    console.log(`\n📑 Pages Scanned: ${auditResult.summary.totalPages}`)
    console.log(`\n💾 Audit ID: ${audit.id}`)

    // Get branding settings
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' }
    })

    const branding = {
      brandName: settings?.brandName || 'SEO Audit Pro',
      brandSubtitle: settings?.brandSubtitle || undefined,
      primaryColor: settings?.primaryColor || '#3b82f6',
      logoUrl: settings?.logoUrl || undefined
    }

    // Generate PDF if output path or email is specified
    if (options.output || options.emailTo) {
      console.log('\n📄 Generating PDF report...')
      const pdfBuffer = await generatePDF(auditResult, branding, options.url)

      // Save to file if output path specified
      if (options.output) {
        const outputPath = path.resolve(options.output)
        const dir = path.dirname(outputPath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(outputPath, pdfBuffer)
        console.log(`✅ PDF saved to: ${outputPath}`)
      }

      // Email PDF if email specified
      if (options.emailTo) {
        console.log(`\n📧 Sending email to: ${options.emailTo}...`)
        try {
          await sendEmail({
            to: options.emailTo,
            subject: `SEO Audit Report - ${options.url}`,
            text: `Please find attached the SEO audit report for ${options.url}.\n\n${shortSummary}`,
            html: `
              <h2>SEO Audit Report</h2>
              <p>Please find attached the SEO audit report for <strong>${options.url}</strong>.</p>
              <p>${shortSummary.replace(/\n/g, '<br>')}</p>
            `,
            attachments: [{
              filename: `seo-audit-${audit.id}.pdf`,
              content: pdfBuffer
            }]
          })
          console.log('✅ Email sent successfully!')
        } catch (error) {
          console.error('❌ Failed to send email:', error instanceof Error ? error.message : error)
        }
      }
    }

    console.log('\n✨ Done!\n')
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

