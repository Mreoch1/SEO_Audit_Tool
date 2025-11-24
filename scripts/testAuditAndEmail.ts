#!/usr/bin/env node
/**
 * Test script to create an audit and email the report
 * 
 * Usage:
 *   tsx scripts/testAuditAndEmail.ts
 */

import { prisma } from '../lib/db'
import { runAudit } from '../lib/seoAudit'
import { generatePDF } from '../lib/pdf'
import { sendEmail } from '../lib/email'
import { generateShortSummary, generateDetailedSummary } from '../lib/reportSummary'
import { Colors } from '../lib/brandColors'

async function main() {
  const url = 'https://seoauditpro.net'
  const emailTo = 'mreoch82@hotmail.com'

  console.log(`\n🔍 Starting SEO audit for: ${url}`)
  console.log(`📧 Will email report to: ${emailTo}\n`)

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
    try {
      progressInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - auditStartTime) / 1000)
        const minutes = Math.floor(elapsed / 60)
        const seconds = elapsed % 60
        process.stdout.write(`\r   ⏳ Running... (${minutes}m ${seconds}s)`)
      }, 2000)
      
      const auditPromise = runAudit(url, {
        maxPages: 5,
        maxDepth: 3,
        tier: 'starter'
      })

      // Add timeout of 10 minutes (reduced from 15)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Audit timed out after 10 minutes')), 10 * 60 * 1000)
      })

      const auditResult = await Promise.race([auditPromise, timeoutPromise]) as Awaited<ReturnType<typeof runAudit>>
      
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
      throw error
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

    console.log('✅ Audit results saved\n')

    // Get branding settings
    const branding = {
      brandName: settings?.brandName || 'SEO Audit Pro',
      brandSubtitle: settings?.brandSubtitle || undefined,
      primaryColor: settings?.primaryColor || Colors.primary,
      logoUrl: settings?.logoUrl || '/logo.png'
    }

    // Generate PDF
    console.log('📄 Generating PDF report...')
    const pdfBuffer = await generatePDF(auditResult, branding, url)
    console.log('✅ PDF generated\n')

    // Format email content (similar to email route)
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

    const primaryColor = branding.primaryColor || Colors.primary
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
    const subject = `${brandName} - SEO Audit Report for ${cleanUrl}`

    // Send email
    console.log(`📧 Sending email to ${emailTo}...`)
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

    console.log('✅ Email sent successfully!')
    console.log(`\n📊 Audit Summary:`)
    console.log(`   Overall Score: ${overallScore}/100`)
    console.log(`   Technical: ${technicalScore}/100`)
    console.log(`   On-Page: ${onPageScore}/100`)
    console.log(`   Content: ${contentScore}/100`)
    console.log(`   Accessibility: ${accessibilityScore}/100`)
    console.log(`\n✨ Done! Check your email at ${emailTo}\n`)

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

main()

