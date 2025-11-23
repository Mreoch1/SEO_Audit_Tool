#!/usr/bin/env node
/**
 * Test script to email a completed audit report
 */

import { prisma } from '../lib/db'
import { generatePDF } from '../lib/pdf'
import { sendEmail } from '../lib/email'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const emailTo = 'mreoch82@hotmail.com'

  console.log(`\n📧 Testing email report sending...\n`)

  try {
    // Find the latest completed audit for seoauditpro.net
    const audit = await prisma.audit.findFirst({
      where: {
        url: 'https://seoauditpro.net',
        status: 'completed'
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!audit || !audit.rawJson) {
      console.error('❌ No completed audit found with data')
      process.exit(1)
    }

    console.log(`✅ Found completed audit: ${audit.id}`)
    console.log(`   Score: ${audit.overallScore}/100\n`)

    // Get settings
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'singleton' }
    })

    // Get logo as base64 for email embedding
    let logoDataUri: string | null = null
    const logoPath = settings?.logoUrl || '/logo.png'
    
    try {
      // If it's a relative path, try to read from public folder
      if (logoPath.startsWith('/')) {
        const publicLogoPath = path.join(process.cwd(), 'public', logoPath.replace(/^\//, ''))
        if (fs.existsSync(publicLogoPath)) {
          const logoBuffer = fs.readFileSync(publicLogoPath)
          const mimeType = logoPath.endsWith('.png') ? 'image/png' : 
                          logoPath.endsWith('.jpg') || logoPath.endsWith('.jpeg') ? 'image/jpeg' :
                          logoPath.endsWith('.gif') ? 'image/gif' : 'image/png'
          logoDataUri = `data:${mimeType};base64,${logoBuffer.toString('base64')}`
        }
      } else if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
        // If it's already an absolute URL, use it directly
        logoDataUri = logoPath
      }
    } catch (error) {
      console.warn('Failed to load logo for email:', error)
      // Continue without logo
    }

    const branding = {
      brandName: settings?.brandName || 'SEO Audit Pro',
      brandSubtitle: settings?.brandSubtitle || undefined,
      primaryColor: settings?.primaryColor || '#3b82f6',
      logoUrl: logoDataUri || null
    }

    // Parse audit result
    const auditResult = JSON.parse(audit.rawJson)

    // Generate PDF
    console.log('📄 Generating PDF...')
    const pdfBuffer = await generatePDF(auditResult, branding, audit.url)
    console.log('✅ PDF generated\n')

    // Format email (same as email route)
    const formattedSummary = audit.shortSummary
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => `<p style="margin: 0 0 12px 0; color: #374151; line-height: 1.6;">${line.trim()}</p>`)
      .join('')

    const getScoreColor = (score: number) => {
      if (score >= 80) return '#10b981'
      if (score >= 60) return '#f59e0b'
      return '#ef4444'
    }

    const overallScore = audit.overallScore || 0
    const technicalScore = audit.technicalScore || 0
    const onPageScore = audit.onPageScore || 0
    const contentScore = audit.contentScore || 0
    const accessibilityScore = audit.accessibilityScore || 0

    const primaryColor = branding.primaryColor || '#3b82f6'
    const brandName = branding.brandName || 'SEOAuditPro'
    const escapedUrl = audit.url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

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
                            ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${brandName}" style="max-width: 200px; height: auto; margin-bottom: 0; display: block; margin-left: auto; margin-right: auto;" />` : ''}
                            ${branding.brandSubtitle ? `<p style="margin: 16px 0 0 0; color: #ffffff; font-size: 16px; opacity: 0.9;">${branding.brandSubtitle}</p>` : ''}
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
                            ${branding.logoUrl ? `<p style="margin: 0 0 8px 0; text-align: center;"><img src="${branding.logoUrl}" alt="${brandName}" style="max-width: 150px; height: auto;" /></p>` : ''}
                            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-align: center;">
                                Professional SEO Auditing
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

Your comprehensive SEO audit for ${audit.url} has been completed.

SCORES:
- Overall Score: ${overallScore}/100
- Technical SEO: ${technicalScore}/100
- On-Page SEO: ${onPageScore}/100
- Content Quality: ${contentScore}/100
- Accessibility: ${accessibilityScore}/100

SUMMARY:
${audit.shortSummary.replace(/\n/g, '\n\n')}

A detailed PDF report is attached to this email with comprehensive analysis, actionable recommendations, and page-level findings.

---
${brandName}
Professional SEO Auditing Services

This is an automated email from your SEO audit system. If you have questions, please reply to this email.
    `.trim()

    const cleanUrl = audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
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

