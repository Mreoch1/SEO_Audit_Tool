#!/usr/bin/env node
/**
 * CLI script to run an SEO audit and email the report
 * 
 * Usage:
 *   npx tsx scripts/runAuditAndEmail.ts --url="https://example.com" --email="user@example.com" [options]
 * 
 * Options:
 *   --url          Target URL to audit (required)
 *   --email        Email address to send report to (required)
 *   --tier         Audit tier: starter, standard, professional, agency (default: standard)
 *   --maxPages     Maximum pages to crawl (overrides tier default)
 *   --maxDepth     Maximum crawl depth (overrides tier default)
 *   --noAddOns     Disable all add-ons
 */

import { prisma } from '../lib/db'
import { runAudit, AuditOptions } from '../lib/seoAudit'
import { generatePDF } from '../lib/pdf'
import { sendEmail } from '../lib/email'
import { generateShortSummary, generateDetailedSummary } from '../lib/reportSummary'
import { validateReportConsistency, generateValidationReport, ValidationIssue } from '../lib/reportValidation'
import { validateReportQuality, generateQAReport, QAIssue } from '../lib/reportQA'
import { AuditResult } from '../lib/types'

interface CliArgs {
  url?: string
  email?: string
  tier?: 'starter' | 'standard' | 'professional' | 'agency'
  maxPages?: number
  maxDepth?: number
  noAddOns?: boolean
}

function parseArgs(): CliArgs {
  const args: CliArgs = {}
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    
    if (arg.startsWith('--url=')) {
      args.url = arg.split('=')[1]
    } else if (arg.startsWith('--email=')) {
      args.email = arg.split('=')[1]
    } else if (arg.startsWith('--tier=')) {
      args.tier = arg.split('=')[1] as any
    } else if (arg.startsWith('--maxPages=')) {
      args.maxPages = parseInt(arg.split('=')[1], 10)
    } else if (arg.startsWith('--maxDepth=')) {
      args.maxDepth = parseInt(arg.split('=')[1], 10)
    } else if (arg === '--noAddOns') {
      args.noAddOns = true
    }
  }
  
  return args
}

async function main() {
  const args = parseArgs()
  
  if (!args.url) {
    console.error('❌ Error: --url is required')
    console.log('\nUsage: npx tsx scripts/runAuditAndEmail.ts --url="https://example.com" --email="user@example.com" [options]')
    process.exit(1)
  }
  
  if (!args.email) {
    console.error('❌ Error: --email is required')
    console.log('\nUsage: npx tsx scripts/runAuditAndEmail.ts --url="https://example.com" --email="user@example.com" [options]')
    process.exit(1)
  }
  
  const url = args.url
  const emailTo = args.email
  const tier = args.tier || 'standard'
  
  // Enable add-ons based on tier (unless --noAddOns is specified)
  // Standard+ tiers include competitor analysis by default
  const addOns = args.noAddOns ? {} : (tier === 'standard' || tier === 'professional' || tier === 'agency') ? {
    competitorAnalysis: true // Competitor analysis is included in Standard+ tiers
  } : undefined
  
  console.log(`\n🔍 Starting SEO audit for: ${url}`)
  console.log(`📧 Will email report to: ${emailTo}`)
  console.log(`📊 Tier: ${tier}`)
  if (args.maxPages) console.log(`📄 Max pages: ${args.maxPages}`)
  if (args.maxDepth) console.log(`🔗 Max depth: ${args.maxDepth}`)
  console.log('')

  try {
    // Check if user exists
    const users = await prisma.user.findMany()
    if (users.length === 0) {
      console.error('❌ No users found in database. Please create a user first.')
      console.log('   Run: npm run create-user')
      process.exit(1)
    }

    // Check SMTP settings
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' }
    })

    if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPassword) {
      console.error('❌ SMTP settings not configured. Please configure in Settings page.')
      console.log('   Required: smtpHost, smtpUser, smtpPassword')
      process.exit(1)
    }

    console.log('✅ Database and SMTP settings verified\n')

    // Create audit record
    console.log('📝 Creating audit record...')
    const audit = await prisma.audit.create({
      data: {
        url,
        status: 'running',
        overallScore: 0,
        technicalScore: 0,
        onPageScore: 0,
        contentScore: 0,
        accessibilityScore: 0,
        shortSummary: 'Audit in progress...',
        detailedSummary: 'The audit is currently running. This may take several minutes for large sites.',
        rawJson: null
      }
    })

    console.log(`✅ Audit created with ID: ${audit.id}\n`)

    // Run audit with timeout and progress updates
    console.log('🔍 Running audit (this may take a few minutes)...')
    console.log('   This will crawl and analyze the website...\n')
    const auditStartTime = Date.now()
    
    // Show progress indicator
    let progressInterval: NodeJS.Timeout | null = null
    let auditResult: Awaited<ReturnType<typeof runAudit>>
    
    try {
      progressInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - auditStartTime) / 1000)
        const minutes = Math.floor(elapsed / 60)
        const seconds = elapsed % 60
        process.stdout.write(`\r   ⏳ Running... (${minutes}m ${seconds}s)`)
      }, 2000)
      
      const auditOptions: AuditOptions = {
        tier,
        addOns,
        maxPages: args.maxPages,
        maxDepth: args.maxDepth
      }
      
      const auditPromise = runAudit(url, auditOptions)

      // Add timeout of 15 minutes
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Audit timed out after 15 minutes')), 15 * 60 * 1000)
      })

      auditResult = await Promise.race([auditPromise, timeoutPromise]) as Awaited<ReturnType<typeof runAudit>>
      
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
      process.stdout.write('\r' + ' '.repeat(50) + '\r') // Clear progress line

      const auditDuration = Math.round((Date.now() - auditStartTime) / 1000)
      const minutes = Math.floor(auditDuration / 60)
      const seconds = auditDuration % 60
      console.log(`✅ Audit completed in ${minutes}m ${seconds}s`)
      console.log(`   Pages scanned: ${auditResult.pages.length}\n`)
    } catch (error) {
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      process.stdout.write('\r' + ' '.repeat(50) + '\r') // Clear progress line
      console.error('\n❌ Audit error:', error instanceof Error ? error.message : error)
      
      // Update audit status to failed
      await prisma.audit.update({
        where: { id: audit.id },
        data: { status: 'failed' }
      })
      
      throw error
    }

    // STEP 5: Comprehensive QA validation and fixes
    console.log('\n🔍 Running comprehensive QA validation...')
    let qaResult = validateReportQuality(auditResult)
    let qaAttempts = 0
    const maxQAAttempts = 5

    // Attempt to fix fixable issues until score >= 9 or max attempts
    while (qaResult.score < 9 && qaAttempts < maxQAAttempts && qaResult.criticalCount > 0) {
      qaAttempts++
      console.log(`\n📊 QA Score: ${qaResult.score}/10 (Target: 9/10)`)
      console.log(generateQAReport(qaResult))

      // Apply automatic fixes
      const fixableIssues = qaResult.issues.filter(i => i.fixable && i.severity === 'critical')
      if (fixableIssues.length > 0) {
        console.log(`\n🔧 Attempting to fix ${fixableIssues.length} critical issue(s)...`)
        auditResult = applyQAFixes(auditResult, fixableIssues)
        
        // Re-validate
        qaResult = validateReportQuality(auditResult)
      } else {
        // No fixable issues, break
        break
      }
    }

    // Log final QA results
    console.log(`\n📊 Final QA Score: ${qaResult.score}/10`)
    if (qaResult.score >= 9) {
      console.log('✅ Report quality passed (score >= 9)')
    } else {
      console.log(generateQAReport(qaResult))
      if (qaResult.criticalCount > 0) {
        console.log('⚠️  Continuing with report generation despite QA issues...')
      }
    }

    // Generate summaries
    const shortSummary = generateShortSummary(auditResult)
    const detailedSummary = generateDetailedSummary(auditResult)

    // Update audit record
    console.log('💾 Saving audit results...')
    await prisma.audit.update({
      where: { id: audit.id },
      data: {
        status: 'completed',
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
            ...(auditResult.technicalIssues || []),
            ...(auditResult.onPageIssues || []),
            ...(auditResult.contentIssues || []),
            ...(auditResult.accessibilityIssues || []),
            ...(auditResult.performanceIssues || [])
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

    console.log('✅ Audit results saved\n')

    // Get branding settings and convert logo to data URI if needed
    const fs = require('fs')
    const path = require('path')
    let logoDataUri: string | undefined = undefined
    const logoPath = settings?.logoUrl || '/logo.png'
    
    try {
      // If it's a relative path, try to read from public folder
      if (logoPath.startsWith('/')) {
        const publicLogoPath = path.join(process.cwd(), 'public', logoPath.replace(/^\//, ''))
        if (fs.existsSync(publicLogoPath)) {
          const logoBuffer = fs.readFileSync(publicLogoPath)
          const mimeType = logoPath.endsWith('.png') ? 'image/png' : 
                          logoPath.endsWith('.jpg') || logoPath.endsWith('.jpeg') ? 'image/jpeg' :
                          logoPath.endsWith('.gif') ? 'image/gif' : 
                          logoPath.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
          logoDataUri = `data:${mimeType};base64,${logoBuffer.toString('base64')}`
        }
      } else if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
        // If it's already an absolute URL, use it directly
        logoDataUri = logoPath
      }
    } catch (error) {
      console.warn('Failed to load logo:', error)
      // Continue without logo
    }

    const branding = {
      brandName: settings?.brandName || 'SEO Audit Pro',
      brandSubtitle: settings?.brandSubtitle || undefined,
      primaryColor: settings?.primaryColor || '#3b82f6',
      logoUrl: logoDataUri
    }

    // Generate PDF with timeout
    console.log('📄 Generating PDF report...')
    const pdfStartTime = Date.now()
    const pdfBuffer = await Promise.race([
      generatePDF(auditResult, branding, url),
      new Promise<Buffer>((_, reject) => 
        setTimeout(() => reject(new Error('PDF generation timed out after 5 minutes')), 5 * 60 * 1000)
      )
    ])
    const pdfDuration = Math.round((Date.now() - pdfStartTime) / 1000)
    console.log(`✅ PDF generated in ${pdfDuration}s (${(pdfBuffer.length / 1024).toFixed(1)} KB)\n`)

    // Format email content
    const formattedSummary = shortSummary
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => `<p style="margin: 0 0 12px 0; color: #374151; line-height: 1.6;">${line.trim()}</p>`)
      .join('')

    const getScoreColor = (score: number) => {
      if (score >= 80) return '#10b981'
      if (score >= 60) return '#f59e0b'
      return '#ef4444'
    }

    const overallScore = auditResult.summary.overallScore
    const technicalScore = auditResult.summary.technicalScore
    const onPageScore = auditResult.summary.onPageScore
    const contentScore = auditResult.summary.contentScore
    const accessibilityScore = auditResult.summary.accessibilityScore

    const primaryColor = branding.primaryColor || '#3b82f6'
    const brandName = branding.brandName || 'SEOAuditPro'
    const escapedUrl = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>SEO Audit Report - ${escapedUrl}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%); padding: 40px 40px 30px 40px; text-align: center;">
                            ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${brandName}" style="max-width: 200px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;">` : ''}
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                                ${brandName}
                            </h1>
                            ${branding.brandSubtitle ? `<p style="margin: 8px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">${branding.brandSubtitle}</p>` : ''}
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 24px 0; color: #111827; font-size: 24px; font-weight: 600;">
                                SEO Audit Report
                            </h2>
                            
                            <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Your comprehensive SEO audit for <strong style="color: #111827;"><a href="${escapedUrl}" style="color: ${primaryColor}; text-decoration: none; font-weight: 600;">${escapedUrl}</a></strong> has been completed.
                            </p>
                            
                            <!-- Score Cards -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 32px 0;">
                                <tr>
                                    <td style="padding: 0 8px 16px 0;">
                                        <div style="background-color: #f9fafb; border-left: 4px solid ${getScoreColor(overallScore)}; padding: 16px; border-radius: 4px;">
                                            <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Overall Score</div>
                                            <div style="color: ${getScoreColor(overallScore)}; font-size: 32px; font-weight: 700;">${overallScore}</div>
                                        </div>
                                    </td>
                                    <td style="padding: 0 8px 16px 8px;">
                                        <div style="background-color: #f9fafb; border-left: 4px solid ${getScoreColor(technicalScore)}; padding: 16px; border-radius: 4px;">
                                            <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Technical</div>
                                            <div style="color: ${getScoreColor(technicalScore)}; font-size: 32px; font-weight: 700;">${technicalScore}</div>
                                        </div>
                                    </td>
                                    <td style="padding: 0 8px 16px 8px;">
                                        <div style="background-color: #f9fafb; border-left: 4px solid ${getScoreColor(onPageScore)}; padding: 16px; border-radius: 4px;">
                                            <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">On-Page</div>
                                            <div style="color: ${getScoreColor(onPageScore)}; font-size: 32px; font-weight: 700;">${onPageScore}</div>
                                        </div>
                                    </td>
                                    <td style="padding: 0 0 16px 8px;">
                                        <div style="background-color: #f9fafb; border-left: 4px solid ${getScoreColor(contentScore)}; padding: 16px; border-radius: 4px;">
                                            <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Content</div>
                                            <div style="color: ${getScoreColor(contentScore)}; font-size: 32px; font-weight: 700;">${contentScore}</div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Summary Section -->
                            <div style="background-color: #f9fafb; border-radius: 6px; padding: 24px; margin: 0 0 32px 0;">
                                <h3 style="margin: 0 0 16px 0; color: #111827; font-size: 18px; font-weight: 600;">Audit Summary</h3>
                                ${formattedSummary}
                            </div>
                            
                            <!-- Info Box -->
                            <div style="background-color: #eff6ff; border-left: 4px solid ${primaryColor}; padding: 20px; border-radius: 6px; margin: 0 0 24px 0;">
                                <p style="margin: 0 0 12px 0; color: #1e40af; font-size: 16px; font-weight: 600;">
                                    📎 Your PDF Report is Attached
                                </p>
                                <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 1.6;">
                                    A detailed PDF report is attached to this email with comprehensive analysis, actionable recommendations, and page-level findings. Check your email attachments to download and view the full report.
                                </p>
                                <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                                    <strong>Tip:</strong> If you don't see the attachment, check your email client's attachment panel or spam folder.
                                </p>
                            </div>
                            
                            <!-- Optional: Link to view audited website -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 0 0 24px 0;">
                                        <a href="${escapedUrl}" style="display: inline-block; background-color: #f3f4f6; color: #374151; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 14px; border: 1px solid #e5e7eb;">
                                            View Audited Website →
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 32px 40px; border-top: 1px solid #e5e7eb; text-align: center;">
                            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">
                                <strong style="color: #111827;">${brandName}</strong> - Professional SEO Auditing
                            </p>
                            <p style="margin: 0 0 12px 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                                This is an automated email from your SEO audit system.<br>
                                If you have questions, please reply to this email.
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                                <a href="mailto:${settings?.smtpFrom || settings?.smtpUser || 'noreply@example.com'}?subject=Unsubscribe%20Request" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a> | 
                                <a href="mailto:${settings?.smtpFrom || settings?.smtpUser || 'noreply@example.com'}" style="color: #6b7280; text-decoration: underline;">Contact Support</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `

    const emailText = `
${brandName} - SEO Audit Report

Your comprehensive SEO audit for ${url} has been completed.

SCORES:
- Overall Score: ${overallScore}/100
- Technical SEO: ${technicalScore}/100
- On-Page SEO: ${onPageScore}/100
- Content Quality: ${contentScore}/100
- Accessibility: ${accessibilityScore}/100

SUMMARY:
${shortSummary.replace(/\n/g, '\n\n')}

A detailed PDF report is attached to this email with comprehensive analysis, actionable recommendations, and page-level findings.

---
${brandName}
Professional SEO Auditing Services

This is an automated email from your SEO audit system. If you have questions, please reply to this email.
    `.trim()

    const cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const subject = `SEO Audit Complete — No Internal Errors (${url})`

    // Send email automatically (no user interaction required)
    // Continue execution regardless of email success or failure
    let emailSent = false
    let emailError: Error | null = null
    
    console.log(`📧 Sending email to ${emailTo}...`)
    try {
      await sendEmail({
        to: emailTo,
        subject: subject,
        text: emailText,
        html: emailHtml,
        attachments: [{
          filename: `seo-audit-report-${cleanUrl.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer
        }]
      })
      emailSent = true
      console.log('✅ Email sent successfully!')
    } catch (err) {
      // Log error but continue execution - do not prompt or wait for user
      emailError = err instanceof Error ? err : new Error(String(err))
      console.error('❌ Email send failed:', emailError.message)
      console.log('   Continuing execution - audit completed successfully.')
      console.log('   You can manually send the email later using the audit ID.')
    }
    
    // Always log audit summary regardless of email success/failure
    console.log(`\n📊 Audit Summary:`)
    console.log(`   Audit ID: ${audit.id}`)
    console.log(`   Overall Score: ${overallScore}/100`)
    console.log(`   Technical: ${technicalScore}/100`)
    console.log(`   On-Page: ${onPageScore}/100`)
    console.log(`   Content: ${contentScore}/100`)
    console.log(`   Accessibility: ${accessibilityScore}/100`)
    console.log(`\n✨ Audit complete. Report saved with ID: ${audit.id}`)
    if (emailSent) {
      console.log(`   Email sent to: ${emailTo}\n`)
    } else if (emailError) {
      console.log(`   Email failed to send to: ${emailTo} (Error: ${emailError.message})\n`)
    } else {
      console.log(`\n`)
    }

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error)
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Apply automatic fixes to audit result based on QA issues
 */
function applyQAFixes(result: AuditResult, issues: QAIssue[]): AuditResult {
  let fixedResult = { ...result }

  issues.forEach(issue => {
    switch (issue.category) {
      case 'Issue Aggregation':
        // Recalculate severity counts from actual issue arrays
        const allIssues = [
          ...(fixedResult.technicalIssues || []),
          ...(fixedResult.onPageIssues || []),
          ...(fixedResult.contentIssues || []),
          ...(fixedResult.accessibilityIssues || []),
          ...(fixedResult.performanceIssues || [])
        ]
        fixedResult.summary.highSeverityIssues = allIssues.filter(i => i.severity === 'High').length
        fixedResult.summary.mediumSeverityIssues = allIssues.filter(i => i.severity === 'Medium').length
        fixedResult.summary.lowSeverityIssues = allIssues.filter(i => i.severity === 'Low').length
        break

      case 'Readability Formula':
        // Fix rendering percentage calculation
        fixedResult.pages = fixedResult.pages.map(page => {
          if (page.llmReadability) {
            const initial = page.llmReadability.initialHtmlLength
            const rendered = page.llmReadability.renderedHtmlLength
            if (initial > 0 && rendered > 0) {
              let percentage: number
              let similarity: number
              
              if (rendered >= initial) {
                percentage = ((rendered - initial) / initial) * 100
                similarity = (initial / rendered) * 100
              } else {
                similarity = (rendered / initial) * 100
                percentage = similarity > 95 ? (100 - similarity) : ((initial - rendered) / initial * 100)
              }
              
              return {
                ...page,
                llmReadability: {
                  ...page.llmReadability,
                  renderingPercentage: Math.max(0, Math.min(100, percentage)),
                  similarity: Math.round(similarity * 10) / 10
                }
              }
            }
          }
          return page
        })
        break

      case 'Keyword Quality':
        // Clean keywords
        if (fixedResult.summary.extractedKeywords) {
          fixedResult.summary.extractedKeywords = cleanKeywords(fixedResult.summary.extractedKeywords)
        }
        break
    }
  })

  return fixedResult
}

/**
 * Apply automatic fixes to audit result based on validation issues (legacy)
 */
function applyAutomaticFixes(result: AuditResult, issues: ValidationIssue[]): AuditResult {
  let fixedResult = { ...result }

  issues.forEach(issue => {
    switch (issue.category) {
      case 'Keyword Extraction':
        // Fix garbage keywords
        if (fixedResult.summary.extractedKeywords) {
          fixedResult.summary.extractedKeywords = cleanKeywords(fixedResult.summary.extractedKeywords)
        }
        break

      case 'Priority Counts':
        // Recalculate severity counts from actual issue arrays
        const allIssues = [
          ...(fixedResult.technicalIssues || []),
          ...(fixedResult.onPageIssues || []),
          ...(fixedResult.contentIssues || []),
          ...(fixedResult.accessibilityIssues || []),
          ...(fixedResult.performanceIssues || [])
        ]
        fixedResult.summary.highSeverityIssues = allIssues.filter(i => i.severity === 'High').length
        fixedResult.summary.mediumSeverityIssues = allIssues.filter(i => i.severity === 'Medium').length
        fixedResult.summary.lowSeverityIssues = allIssues.filter(i => i.severity === 'Low').length
        break

      case 'Readability Calculation':
        // Fix rendering percentage calculation
        fixedResult.pages = fixedResult.pages.map(page => {
          if (page.llmReadability && page.llmReadability.renderingPercentage === 0) {
            const initial = page.llmReadability.initialHtmlLength
            const rendered = page.llmReadability.renderedHtmlLength
            if (initial > 0 && rendered > 0) {
              // Calculate similarity percentage correctly
              const similarity = (Math.min(initial, rendered) / Math.max(initial, rendered)) * 100
              const diff = Math.abs(initial - rendered)
              // Rendering percentage = how much was added/rendered
              const renderingPct = diff > 0 ? Math.min(100, (diff / initial) * 100) : 0
              
              return {
                ...page,
                llmReadability: {
                  ...page.llmReadability,
                  renderingPercentage: renderingPct > 0 ? renderingPct : similarity
                }
              }
            }
          }
          return page
        })
        break

      case 'Score Validation':
        // Clamp scores to 0-100
        fixedResult.summary.overallScore = Math.max(0, Math.min(100, fixedResult.summary.overallScore))
        fixedResult.summary.technicalScore = Math.max(0, Math.min(100, fixedResult.summary.technicalScore))
        fixedResult.summary.onPageScore = Math.max(0, Math.min(100, fixedResult.summary.onPageScore))
        fixedResult.summary.contentScore = Math.max(0, Math.min(100, fixedResult.summary.contentScore))
        fixedResult.summary.accessibilityScore = Math.max(0, Math.min(100, fixedResult.summary.accessibilityScore))
        break
    }
  })

  return fixedResult
}

/**
 * Clean and filter keywords
 */
function cleanKeywords(keywords: string[]): string[] {
  const cleaned: string[] = []
  const seen = new Set<string>()

  keywords.forEach(keyword => {
    const trimmed = keyword.trim()
    
    // Skip invalid keywords
    if (trimmed.length < 3) return
    if (/^[a-z]{1,2}$/i.test(trimmed)) return // 1-2 char words
    if (/[^\w\s-]/.test(trimmed)) return // Special chars
    if (/\n|\r/.test(trimmed)) return // Newlines
    if (/enterp|rise-grade|serviceenterp/i.test(trimmed)) return // Known broken patterns
    
    // Check for broken hyphen splits
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-')
      if (parts.some(part => part.length < 3 && part.length > 0)) {
        return // Skip broken splits
      }
    }

    // Normalize and deduplicate
    const normalized = trimmed.toLowerCase()
    if (!seen.has(normalized)) {
      seen.add(normalized)
      cleaned.push(trimmed)
    }
  })

  return cleaned
}

main()

