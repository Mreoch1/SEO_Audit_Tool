/**
 * PDF Report Generation
 * 
 * Generates white-label PDF reports from audit results using Puppeteer
 */

import puppeteer from 'puppeteer'
import { AuditResult, Issue } from './types'
import { generateDetailedSummary } from './reportSummary'

export interface BrandingData {
  brandName: string
  brandSubtitle?: string
  primaryColor: string
  logoUrl?: string
}

/**
 * Generate PDF buffer from audit result
 */
export async function generatePDF(
  auditResult: AuditResult,
  branding: BrandingData,
  url: string
): Promise<Buffer> {
  const html = generateReportHTML(auditResult, branding, url)
  
  let lastError: Error | null = null
  const maxRetries = 3
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let browser: any = null
    try {
      if (attempt > 0) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`[PDF] Retry attempt ${attempt + 1}/${maxRetries}, waiting ${backoffDelay}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
      }
      
      // Try to use system Chrome if available
      const systemChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      let executablePath: string | undefined = process.env.PUPPETEER_EXECUTABLE_PATH
      if (!executablePath) {
        try {
          const fs = require('fs')
          if (fs.existsSync(systemChromePath)) {
            executablePath = systemChromePath
          }
        } catch {
          // Ignore
        }
      }
      
      browser = await puppeteer.launch({
        headless: "new",
        executablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--no-crash-upload',
          '--disable-breakpad',
          '--disable-features=VizDisplayCompositor',
          '--disable-web-security'
        ],
        timeout: 60000,
        protocolTimeout: 120000
      })
      
      const page = await browser.newPage()
      
      // Set timeouts for page operations
      page.setDefaultTimeout(30000)
      page.setDefaultNavigationTimeout(30000)
      
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 })
      
      // Wait a bit for styles to load
      await page.waitForTimeout(2000)
      
      const pdf = await Promise.race([
        page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          },
          timeout: 60000
        }),
        new Promise<Buffer>((_, reject) => 
          setTimeout(() => reject(new Error('PDF generation timed out')), 120000)
        )
      ])
      
      await page.close().catch(() => {})
      await browser.close()
      return Buffer.from(pdf)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (browser) {
        try {
          await browser.close()
        } catch {
          // Ignore cleanup errors
        }
      }
      
      if (attempt < maxRetries - 1) {
        console.log(`[PDF] Attempt ${attempt + 1} failed: ${lastError.message}, retrying...`)
        continue
      }
    }
  }
  
  throw new Error(`Failed to generate PDF after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Generate HTML report template
 */
function generateReportHTML(
  result: AuditResult,
  branding: BrandingData,
  url: string
): string {
  const { summary } = result
  const detailedSummary = generateDetailedSummary(result)
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #333;
      line-height: 1.6;
    }
    .cover-page {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
      padding: 40px;
    }
    .logo {
      max-width: 300px;
      margin-bottom: 40px;
      display: block;
      margin-left: auto;
      margin-right: auto;
    }
    .brand-name {
      font-size: 36px;
      font-weight: bold;
      color: ${branding.primaryColor};
      margin-bottom: 10px;
    }
    .brand-subtitle {
      font-size: 18px;
      color: #666;
      margin-bottom: 40px;
    }
    .report-title {
      font-size: 28px;
      margin: 40px 0 20px;
      color: #222;
    }
    .report-url {
      font-size: 16px;
      color: #666;
      margin-bottom: 30px;
      word-break: break-all;
    }
    .report-date {
      font-size: 14px;
      color: #999;
      margin-bottom: 40px;
    }
    .score-circle {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 8px solid ${branding.primaryColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: bold;
      color: ${branding.primaryColor};
      margin: 20px auto;
    }
    .page {
      padding: 40px;
      page-break-after: always;
    }
    .page:last-child {
      page-break-after: auto;
    }
    h1 {
      font-size: 28px;
      color: ${branding.primaryColor};
      margin-bottom: 20px;
      border-bottom: 3px solid ${branding.primaryColor};
      padding-bottom: 10px;
    }
    h2 {
      font-size: 22px;
      color: #444;
      margin: 30px 0 15px;
    }
    h3 {
      font-size: 18px;
      color: #555;
      margin: 20px 0 10px;
    }
    p {
      margin-bottom: 15px;
      text-align: justify;
    }
    .summary-text {
      white-space: pre-line;
      line-height: 1.8;
    }
    .scores-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin: 30px 0;
    }
    .score-card {
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .score-card h3 {
      font-size: 16px;
      margin-bottom: 10px;
      color: #666;
    }
    .score-value {
      font-size: 32px;
      font-weight: bold;
      color: ${branding.primaryColor};
    }
    .issues-section {
      margin: 30px 0;
    }
    .issue-item {
      border-left: 4px solid ${getSeverityColor('Medium')};
      padding: 15px;
      margin-bottom: 15px;
      background: #f9f9f9;
    }
    .issue-item.high {
      border-left-color: ${getSeverityColor('High')};
    }
    .issue-item.medium {
      border-left-color: ${getSeverityColor('Medium')};
    }
    .issue-item.low {
      border-left-color: ${getSeverityColor('Low')};
    }
    .issue-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .issue-details {
      color: #666;
      font-size: 14px;
      margin-top: 5px;
    }
    .issue-pages {
      color: #999;
      font-size: 12px;
      margin-top: 5px;
    }
    .fix-instructions {
      margin-top: 15px;
      padding: 15px;
      background: #f0f9ff;
      border-left: 3px solid ${branding.primaryColor};
      border-radius: 4px;
    }
    .fix-instructions-title {
      font-weight: bold;
      color: ${branding.primaryColor};
      margin-bottom: 10px;
      font-size: 14px;
    }
    .fix-instructions-content {
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-line;
      color: #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: ${branding.primaryColor};
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .page-number {
      position: fixed;
      bottom: 20px;
      right: 20px;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover-page">
    ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.brandName}" class="logo">` : `<div class="brand-name">${branding.brandName}</div>`}
    ${branding.brandSubtitle ? `<div class="brand-subtitle">${branding.brandSubtitle}</div>` : ''}
    <div class="report-title">SEO Site Audit Report</div>
    <div class="report-url">${url}</div>
    <div class="report-date">${date}</div>
    ${result.raw.options.tier ? `<div style="margin: 20px 0; padding: 10px; background: #f0f9ff; border-radius: 8px; display: inline-block;">
      <strong>Service Tier:</strong> ${result.raw.options.tier.charAt(0).toUpperCase() + result.raw.options.tier.slice(1)}
    </div>` : ''}
    <div class="score-circle">${summary.overallScore}</div>
    <div style="max-width: 600px; margin-top: 30px; text-align: left;">
      <p style="text-align: center; font-size: 14px; color: #666;">
        ${detailedSummary.split('\n\n')[0].substring(0, 300)}...
      </p>
    </div>
  </div>
  
  <!-- Simple One-Page Summary (Client-Friendly) -->
  <div class="page">
    <h1>📋 Quick Reference: What to Fix First</h1>
    <p style="margin-bottom: 20px; font-size: 16px; color: #666;">Here's the order to fix things for maximum SEO impact:</p>
    ${generateSimpleFixOrder(result)}
  </div>
  
  <!-- Service Details -->
  ${result.raw.options.tier || (result.raw.options.addOns && Object.keys(result.raw.options.addOns).length > 0) ? `
  <div class="page">
    <h1>Service Details</h1>
    ${result.raw.options.tier ? `
    <div style="margin-bottom: 20px;">
      <h2>Service Tier</h2>
      <p><strong>${result.raw.options.tier.charAt(0).toUpperCase() + result.raw.options.tier.slice(1)}</strong> - ${getTierDescription(result.raw.options.tier)}</p>
      ${result.raw.options.addOns?.blankReport ? (() => {
        const tier = result.raw.options.tier
        if (tier === 'agency') {
          return `<p style="color: #10b981; font-weight: bold; margin-top: 10px;">✓ Blank Report (Unbranded) - Included</p>`
        } else {
          return `<p style="color: #f59e0b; font-weight: bold; margin-top: 10px;">+ Blank Report (Unbranded) - +$10.00</p>`
        }
      })() : ''}
    </div>
    ` : ''}
    ${result.raw.options.addOns && Object.keys(result.raw.options.addOns).length > 0 ? `
    <div>
      <h2>Included Add-Ons</h2>
      <ul style="padding-left: 20px;">
        ${getAddOnsList(result.raw.options.addOns, result.raw.options.tier)}
      </ul>
    </div>
    ` : ''}
  </div>
  ` : ''}
  
  <!-- Executive Summary -->
  <div class="page">
    <h1>Executive Summary</h1>
    <div class="summary-text">${detailedSummary.replace(/\n/g, '<br>')}</div>
  </div>
  
  <!-- Quick Wins / TL;DR (Client-Friendly Summary) -->
  <div class="page">
    <h1>🎯 Quick Wins: Fix These 5 Things First</h1>
    <p style="margin-bottom: 20px; font-size: 16px; color: #666;">If you only have time to fix a few things, start here. These will have the biggest impact on your SEO:</p>
    ${generateQuickWinsSummary(result)}
  </div>
  
  <!-- Priority Action Plan -->
  <div class="page">
    <h1>Priority Action Plan</h1>
    <p style="margin-bottom: 20px;">Address issues in this order for maximum SEO impact:</p>
    ${generatePriorityActionPlan(result)}
  </div>
  
  <!-- Scores Overview -->
  <div class="page">
    <h1>SEO Scores Overview</h1>
    <p style="margin-bottom: 20px; color: #666;">Visual breakdown of your SEO performance across all categories:</p>
    ${generateScoreDials(summary)}
    ${generateScoreComparisonChart(summary)}
    <div class="scores-grid" style="margin-top: 30px;">
      <div class="score-card">
        <h3>Overall Score</h3>
        <div class="score-value">${summary.overallScore}</div>
      </div>
      <div class="score-card">
        <h3>Technical SEO</h3>
        <div class="score-value">${summary.technicalScore}</div>
      </div>
      <div class="score-card">
        <h3>On-Page SEO</h3>
        <div class="score-value">${summary.onPageScore}</div>
      </div>
      <div class="score-card">
        <h3>Content Quality</h3>
        <div class="score-value">${summary.contentScore}</div>
      </div>
      <div class="score-card">
        <h3>Accessibility</h3>
        <div class="score-value">${summary.accessibilityScore}</div>
      </div>
      <div class="score-card">
        <h3>Total Pages</h3>
        <div class="score-value">${summary.totalPages}</div>
      </div>
    </div>
    ${generateIssueDistributionChart(summary)}
    <p style="margin-top: 30px;">
      <strong>Issue Breakdown:</strong> ${summary.highSeverityIssues} High Priority, 
      ${summary.mediumSeverityIssues} Medium Priority, 
      ${summary.lowSeverityIssues} Low Priority
    </p>
  </div>
  
  <!-- Enhanced Technical SEO Summary (Standard+ tiers) -->
  ${result.enhancedTechnical || result.mobileResponsiveness || result.serverTechnology ? `
  <div class="page">
    <h1>Enhanced Technical SEO Analysis</h1>
    <p style="margin-bottom: 20px;">Comprehensive technical analysis including security headers, server configuration, mobile optimization, and technology stack:</p>
    <div class="issues-section">
      ${result.enhancedTechnical ? `
      <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #3b82f6; margin-bottom: 15px;">Security & Server Configuration</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 40%;">HTTPS:</td>
              <td style="padding: 8px; ${result.enhancedTechnical.https ? 'color: #10b981;' : 'color: #dc2626;'}">${result.enhancedTechnical.https ? '✅ Enabled' : '❌ Not Enabled'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">HSTS Header:</td>
              <td style="padding: 8px; ${result.enhancedTechnical.hsts ? 'color: #10b981;' : 'color: #f59e0b;'}">${result.enhancedTechnical.hsts ? '✅ Present' : '⚠️ Missing'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">CSP Header:</td>
              <td style="padding: 8px; ${result.enhancedTechnical.csp ? 'color: #10b981;' : 'color: #f59e0b;'}">${result.enhancedTechnical.csp ? '✅ Present' : '⚠️ Missing'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">X-Frame-Options:</td>
              <td style="padding: 8px; ${result.enhancedTechnical.xFrameOptions ? 'color: #10b981;' : 'color: #f59e0b;'}">${result.enhancedTechnical.xFrameOptions ? '✅ Present' : '⚠️ Missing'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">X-Content-Type-Options:</td>
              <td style="padding: 8px; ${result.enhancedTechnical.xContentTypeOptions ? 'color: #10b981;' : 'color: #f59e0b;'}">${result.enhancedTechnical.xContentTypeOptions ? '✅ Present' : '⚠️ Missing'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Referrer-Policy:</td>
              <td style="padding: 8px; ${result.enhancedTechnical.referrerPolicy ? 'color: #10b981;' : 'color: #f59e0b;'}">${result.enhancedTechnical.referrerPolicy ? '✅ Present' : '⚠️ Missing'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">HTTP Version:</td>
              <td style="padding: 8px; ${result.enhancedTechnical.httpVersion === 'http/3' || result.enhancedTechnical.httpVersion === 'http/2' ? 'color: #10b981;' : 'color: #f59e0b;'}">${result.enhancedTechnical.httpVersion.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Compression:</td>
              <td style="padding: 8px;">
                ${result.enhancedTechnical.compression.brotli ? '<span style="color: #10b981;">✅ Brotli</span>' : ''}
                ${result.enhancedTechnical.compression.gzip ? '<span style="color: #10b981;">✅ GZIP</span>' : ''}
                ${!result.enhancedTechnical.compression.gzip && !result.enhancedTechnical.compression.brotli ? '<span style="color: #dc2626;">❌ None</span>' : ''}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Cache-Control:</td>
              <td style="padding: 8px; ${result.enhancedTechnical.caching.hasCacheControl ? 'color: #10b981;' : 'color: #f59e0b;'}">${result.enhancedTechnical.caching.hasCacheControl ? '✅ Present' : '⚠️ Missing'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">ETag:</td>
              <td style="padding: 8px; ${result.enhancedTechnical.caching.hasETag ? 'color: #10b981;' : 'color: #f59e0b;'}">${result.enhancedTechnical.caching.hasETag ? '✅ Present' : '⚠️ Missing'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${result.mobileResponsiveness ? `
      <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #3b82f6; margin-bottom: 15px;">Mobile Responsiveness</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 40%;">Viewport Meta Tag:</td>
              <td style="padding: 8px; ${result.mobileResponsiveness.hasViewport ? 'color: #10b981;' : 'color: #dc2626;'}">${result.mobileResponsiveness.hasViewport ? '✅ Present' : '❌ Missing'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Responsive Design:</td>
              <td style="padding: 8px; ${result.mobileResponsiveness.responsiveDesign ? 'color: #10b981;' : 'color: #f59e0b;'}">${result.mobileResponsiveness.responsiveDesign ? '✅ Detected' : '⚠️ Not Detected'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Mobile-Friendly:</td>
              <td style="padding: 8px; ${result.mobileResponsiveness.mobileFriendly ? 'color: #10b981;' : 'color: #f59e0b;'}">${result.mobileResponsiveness.mobileFriendly ? '✅ Yes' : '⚠️ Needs Improvement'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${result.serverTechnology ? `
      <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #3b82f6; margin-bottom: 15px;">Technology Stack</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 40%;">CMS:</td>
              <td style="padding: 8px;">${result.serverTechnology.cms !== 'Unknown' ? result.serverTechnology.cms : 'Custom/Unknown'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Framework:</td>
              <td style="padding: 8px;">${result.serverTechnology.framework !== 'Unknown' ? result.serverTechnology.framework : 'Custom/Unknown'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">CDN:</td>
              <td style="padding: 8px;">${result.serverTechnology.cdn !== 'Unknown' ? result.serverTechnology.cdn : 'Not Detected'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Server:</td>
              <td style="padding: 8px;">${result.serverTechnology.server !== 'Unknown' ? result.serverTechnology.server : 'Not Detected'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}
    </div>
  </div>
  ` : ''}
  
  <!-- Technical Issues -->
  ${(result.technicalIssues || []).length > 0 ? `
  <div class="page">
    <h1>Technical SEO Issues</h1>
    <div class="issues-section">
      ${(result.technicalIssues || []).slice(0, 20).map(issue => `
        <div class="issue-item ${issue.severity.toLowerCase()}">
          <div class="issue-title">[${issue.severity}] ${issue.message}</div>
          ${issue.details ? `<div class="issue-details">${issue.details}</div>` : ''}
          ${issue.affectedPages && issue.affectedPages.length > 0 
            ? `<div class="issue-pages">Affected: ${issue.affectedPages.length} page${issue.affectedPages.length !== 1 ? 's' : ''}</div>` 
            : ''}
          <div class="fix-instructions">
            <div class="fix-instructions-title">How to Fix:</div>
            <div class="fix-instructions-content">${escapeHtml(getFixInstructions(issue))}</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}
  
  <!-- On-Page Issues -->
  ${(result.onPageIssues || []).length > 0 ? `
  <div class="page">
    <h1>On-Page SEO Issues</h1>
    <div class="issues-section">
      ${(result.onPageIssues || []).slice(0, 20).map(issue => `
        <div class="issue-item ${issue.severity.toLowerCase()}">
          <div class="issue-title">[${issue.severity}] ${issue.message}</div>
          ${issue.details ? `<div class="issue-details">${issue.details}</div>` : ''}
          ${issue.affectedPages && issue.affectedPages.length > 0 
            ? `<div class="issue-pages">Affected: ${issue.affectedPages.length} page${issue.affectedPages.length !== 1 ? 's' : ''}</div>` 
            : ''}
          <div class="fix-instructions">
            <div class="fix-instructions-title">How to Fix:</div>
            <div class="fix-instructions-content">${escapeHtml(getFixInstructions(issue))}</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}
  
  <!-- Content Issues -->
  ${(result.contentIssues || []).length > 0 ? `
  <div class="page">
    <h1>Content Quality Issues</h1>
    <div class="issues-section">
      ${(result.contentIssues || []).slice(0, 20).map(issue => `
        <div class="issue-item ${issue.severity.toLowerCase()}">
          <div class="issue-title">[${issue.severity}] ${issue.message}</div>
          ${issue.details ? `<div class="issue-details">${issue.details}</div>` : ''}
          ${issue.affectedPages && issue.affectedPages.length > 0 
            ? `<div class="issue-pages">Affected: ${issue.affectedPages.length} page${issue.affectedPages.length !== 1 ? 's' : ''}</div>` 
            : ''}
          <div class="fix-instructions">
            <div class="fix-instructions-title">How to Fix:</div>
            <div class="fix-instructions-content">${escapeHtml(getFixInstructions(issue))}</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}
  
  <!-- Accessibility Issues -->
  ${(result.accessibilityIssues || []).length > 0 ? `
  <div class="page">
    <h1>Accessibility Issues</h1>
    <div class="issues-section">
      ${(result.accessibilityIssues || []).slice(0, 20).map(issue => `
        <div class="issue-item ${issue.severity.toLowerCase()}">
          <div class="issue-title">[${issue.severity}] ${issue.message}</div>
          ${issue.details ? `<div class="issue-details">${issue.details}</div>` : ''}
          ${issue.affectedPages && issue.affectedPages.length > 0 
            ? `<div class="issue-pages">Affected: ${issue.affectedPages.length} page${issue.affectedPages.length !== 1 ? 's' : ''}</div>` 
            : ''}
          <div class="fix-instructions">
            <div class="fix-instructions-title">How to Fix:</div>
            <div class="fix-instructions-content">${escapeHtml(getFixInstructions(issue))}</div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}
  
  <!-- Image Alt Tags Analysis (if add-on selected) -->
  ${result.imageAltAnalysis && result.imageAltAnalysis.length > 0 ? `
  <div class="page">
    <h1>Image Alt Tags Analysis</h1>
    <p style="margin-bottom: 20px;">Detailed analysis of image alt attributes with specific recommendations for optimization:</p>
    <div class="issues-section">
      ${result.imageAltAnalysis.slice(0, 30).map((item, idx) => `
        <div class="issue-item ${item.issue === 'missing' ? 'high' : item.issue === 'generic' ? 'medium' : 'low'}">
          <div class="issue-title">[${idx + 1}] ${item.url}</div>
          ${item.imageUrl ? `<div class="issue-details">Image: ${item.imageUrl.substring(0, 80)}${item.imageUrl.length > 80 ? '...' : ''}</div>` : ''}
          ${item.currentAlt ? `<div class="issue-details">Current Alt: "${escapeHtml(item.currentAlt)}"</div>` : '<div class="issue-details">Status: Missing alt attribute</div>'}
          ${item.recommendation ? `<div class="fix-instructions">
            <div class="fix-instructions-title">Recommendation:</div>
            <div class="fix-instructions-content">${escapeHtml(item.recommendation)}</div>
          </div>` : ''}
        </div>
      `).join('')}
    </div>
    ${result.imageAltAnalysis.length > 30 ? `<p style="margin-top: 15px; color: #666;">Note: Showing top 30 of ${result.imageAltAnalysis.length} images analyzed. Full analysis available in web interface.</p>` : ''}
  </div>
  ` : ''}
  
  <!-- Performance Metrics (Core Web Vitals) -->
  ${result.pages.some(p => p.pageSpeedData || p.performanceMetrics) ? `
  <div class="page">
    <h1>Performance Metrics (Core Web Vitals)</h1>
    <p style="margin-bottom: 20px;"><strong>CRITICAL FIX:</strong> Core Web Vitals shown below are from Google PageSpeed Insights API (when available). Crawler load time is shown separately.</p>
    ${generateCoreWebVitalsGraph(result.pages)}
    <div class="issues-section">
      ${result.pages.filter(p => p.pageSpeedData || p.performanceMetrics).slice(0, 10).map(page => {
        // CRITICAL FIX: ONLY use PageSpeed API scores for Core Web Vitals, NOT Playwright metrics
        const pageSpeed = page.pageSpeedData
        // Handle both full PageSpeedData structure and simplified structure
        const mobile = (pageSpeed as any)?.mobile
        const desktop = (pageSpeed as any)?.desktop
        const metrics = page.performanceMetrics
        
        // CRITICAL FIX: Use ONLY PageSpeed API metrics for Core Web Vitals
        // Do NOT fall back to performanceMetrics (Playwright) for Core Web Vitals
        const lcp = mobile?.lcp || (pageSpeed as any)?.lcp || undefined
        const fcp = mobile?.fcp || (pageSpeed as any)?.fcp || undefined
        const cls = mobile?.cls !== undefined ? mobile.cls : ((pageSpeed as any)?.cls !== undefined ? (pageSpeed as any).cls : undefined)
        const inp = mobile?.inp || undefined // INP only from PageSpeed
        const ttfb = mobile?.ttfb || (pageSpeed as any)?.ttfb || undefined
        
        // Crawler load time (separate metric, not Core Web Vitals)
        const crawlerLoadTime = page.loadTime
        const tbt = metrics?.tbt // TBT only from metrics (not a Core Web Vital)
        
        return `
        <div class="issue-item">
          <div class="issue-title" style="margin-bottom: 5px;">
            <strong>${page.url}</strong>
            ${pageSpeed ? '<span style="font-size: 11px; color: #059669; margin-left: 10px;">(Google PageSpeed Insights API)</span>' : '<span style="font-size: 11px; color: #f59e0b; margin-left: 10px;">(No PageSpeed data - Core Web Vitals unavailable)</span>'}
          </div>
          ${pageSpeed ? `
          <div style="margin-bottom: 15px; padding: 10px; background: #f0f9ff; border-left: 3px solid #3b82f6; font-size: 12px;">
            <strong>Core Web Vitals (from PageSpeed API):</strong>
          </div>
          ` : `
          <div style="margin-bottom: 15px; padding: 10px; background: #fef3c7; border-left: 3px solid #f59e0b; font-size: 12px;">
            <strong>Note:</strong> Core Web Vitals not available from PageSpeed API. Showing crawler load time only.
          </div>
          `}
          ${crawlerLoadTime ? `
          <div style="margin-bottom: 10px; padding: 8px; background: #f9fafb; font-size: 12px;">
            <strong>Crawler Load Time:</strong> ${Math.round(crawlerLoadTime)}ms (separate from Core Web Vitals)
          </div>
          ` : ''}
          <table style="margin-top: 15px; width: 100%; max-width: 600px;">
            <tbody>
              ${lcp && (cls !== undefined || inp || fcp || ttfb) ? `
              <tr>
                <td style="padding: 8px; font-weight: bold;">LCP: ${Math.round(lcp)} ms</td>
                <td style="padding: 8px; ${lcp > 4000 ? 'color: #dc2626;' : lcp > 2500 ? 'color: #f59e0b;' : 'color: #10b981;'}">${lcp > 4000 ? 'Poor' : lcp > 2500 ? 'Needs Improvement' : 'Good'}</td>
              </tr>
              ` : lcp ? `<tr><td style="padding: 8px; font-weight: bold;">LCP: ${Math.round(lcp)} ms</td><td style="padding: 8px; ${lcp > 4000 ? 'color: #dc2626;' : lcp > 2500 ? 'color: #f59e0b;' : 'color: #10b981;'}">${lcp > 4000 ? 'Poor' : lcp > 2500 ? 'Needs Improvement' : 'Good'}</td></tr>` : ''}
              ${cls !== undefined ? `
              <tr>
                <td style="padding: 8px; font-weight: bold;">CLS: ${cls.toFixed(3)}</td>
                <td style="padding: 8px; ${cls > 0.25 ? 'color: #dc2626;' : cls > 0.1 ? 'color: #f59e0b;' : 'color: #10b981;'}">${cls > 0.25 ? 'Poor' : cls > 0.1 ? 'Needs Improvement' : 'Good'}</td>
              </tr>
              ` : ''}
              ${inp ? `
              <tr>
                <td style="padding: 8px; font-weight: bold;">INP (Interaction to Next Paint): ${Math.round(inp)} ms</td>
                <td style="padding: 8px; ${inp > 500 ? 'color: #dc2626;' : inp > 200 ? 'color: #f59e0b;' : 'color: #10b981;'}">${inp > 500 ? 'Poor' : inp > 200 ? 'Needs Improvement' : 'Good'}</td>
              </tr>
              ` : ''}
              ${fcp ? `
              <tr>
                <td style="padding: 8px; font-weight: bold;">FCP: ${Math.round(fcp)} ms</td>
                <td style="padding: 8px; ${fcp > 3000 ? 'color: #dc2626;' : fcp > 1800 ? 'color: #f59e0b;' : 'color: #10b981;'}">${fcp > 3000 ? 'Poor' : fcp > 1800 ? 'Needs Improvement' : 'Good'}</td>
              </tr>
              ` : ''}
              ${ttfb ? `
              <tr>
                <td style="padding: 8px; font-weight: bold;">TTFB: ${Math.round(ttfb)} ms</td>
                <td style="padding: 8px; ${ttfb > 1800 ? 'color: #dc2626;' : ttfb > 800 ? 'color: #f59e0b;' : 'color: #10b981;'}">${ttfb > 1800 ? 'Poor' : ttfb > 800 ? 'Needs Improvement' : 'Good'}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
          ${mobile && mobile.opportunities && mobile.opportunities.length > 0 ? `
          <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
            <div style="font-weight: bold; margin-bottom: 10px; color: #dc2626;">⚡ Performance Opportunities:</div>
            <ul style="margin-left: 20px; color: #666;">
              ${mobile?.opportunities?.slice(0, 5).map((opp: any) => {
                // Use savings field directly (in milliseconds)
                const savingsText = opp.savings ? `Potential savings: ${Math.round(opp.savings)}ms` : ''
                return `
                <li style="margin-bottom: 8px;">
                  <strong>${escapeHtml(opp.title)}</strong>${savingsText ? ` - ${savingsText}` : ''}
                  ${opp.description ? `<br><small style="color: #888;">${escapeHtml(opp.description.substring(0, 120))}${opp.description.length > 120 ? '...' : ''}</small>` : ''}
                </li>
              `}).join('')}
            </ul>
          </div>
          ` : ''}
        </div>
        `
      }).join('')}
    </div>
  </div>
  ` : ''}
  
  <!-- LLM Readability Analysis -->
  ${result.pages.some(p => p.llmReadability) ? `
  <div class="page">
    <h1>LLM Readability Analysis</h1>
    <p style="margin-bottom: 20px;">Analysis of dynamically rendered content that may be missed by LLMs and search engines:</p>
    <div class="issues-section">
      ${result.pages.filter(p => p.llmReadability).slice(0, 10).map(page => {
        const llm = page.llmReadability!
        // Calculate actual percentage (may be higher than displayed cap)
        const actualPercent = ((llm.renderedHtmlLength - llm.initialHtmlLength) / Math.max(llm.initialHtmlLength, 1)) * 100
        const displayPercent = actualPercent >= 10000 ? '10,000%+' : `${llm.renderingPercentage}%`
        const similarity = llm.similarity !== undefined ? `${llm.similarity}%` : 'N/A'
        
        return `
        <div class="issue-item ${llm.hasHighRendering ? 'high' : 'low'}" style="margin-bottom: 30px; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div class="issue-title" style="font-size: 15px; font-weight: bold; margin-bottom: 15px; color: #1f2937;">${page.url}</div>
          
          <div class="issue-details" style="font-size: 13px; line-height: 1.8; margin-bottom: 15px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px;">
              <div>
                <strong>Rendering Percentage:</strong> ${displayPercent}<br>
                <strong>Content Similarity:</strong> ${similarity}<br>
                <strong>Status:</strong> ${llm.hasHighRendering ? '<span style="color: #dc2626;">⚠️ High Rendering</span>' : '<span style="color: #10b981;">✅ Low Rendering</span>'}
              </div>
              <div>
                <strong>Initial HTML:</strong> ${llm.initialHtmlLength.toLocaleString()} characters<br>
                <strong>Rendered HTML:</strong> ${llm.renderedHtmlLength.toLocaleString()} characters<br>
                <strong>Difference:</strong> ${(llm.renderedHtmlLength - llm.initialHtmlLength).toLocaleString()} characters
              </div>
            </div>
            
            ${llm.contentAnalysis ? `
            <div style="margin-top: 15px; padding: 10px; background: #f9fafb; border-radius: 6px;">
              <strong style="display: block; margin-bottom: 8px;">Content Analysis:</strong>
              <div style="font-size: 12px; line-height: 1.6;">
                <strong>Text Content:</strong> ${llm.contentAnalysis.textContentInInitial.toLocaleString()} chars (initial) → ${llm.contentAnalysis.textContentInRendered.toLocaleString()} chars (rendered)<br>
                ${llm.contentAnalysis.criticalElementsMissing.length > 0 ? `
                <strong style="color: #dc2626;">Missing from Initial HTML:</strong> ${llm.contentAnalysis.criticalElementsMissing.join(', ')}<br>
                ` : ''}
                ${llm.contentAnalysis.recommendations.length > 0 ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                  <strong>Recommendations:</strong>
                  <ul style="margin: 5px 0; padding-left: 20px;">
                    ${llm.contentAnalysis.recommendations.map(rec => `<li style="margin: 3px 0;">${rec}</li>`).join('')}
                  </ul>
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}
            
            ${llm.hydrationIssues && llm.hydrationIssues.criticalContentMissing.length > 0 ? `
            <div style="margin-top: 15px; padding: 10px; background: #fef2f2; border-left: 3px solid #dc2626; border-radius: 4px;">
              <strong style="color: #dc2626; display: block; margin-bottom: 5px;">⚠️ Critical Content Rendered via JavaScript:</strong>
              <div style="font-size: 12px; color: #991b1b;">
                ${llm.hydrationIssues.criticalContentMissing.join(', ')} ${llm.hydrationIssues.criticalContentMissing.length === 1 ? 'is' : 'are'} not present in the initial HTML and only appear after JavaScript execution. This content may not be accessible to LLMs or search engines.
              </div>
            </div>
            ` : ''}
            
            ${llm.shadowDOMAnalysis && llm.shadowDOMAnalysis.hasShadowDOM ? `
            <div style="margin-top: 15px; padding: 10px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px;">
              <strong style="color: #d97706; display: block; margin-bottom: 5px;">⚠️ Shadow DOM Detected:</strong>
              <div style="font-size: 12px; color: #92400e;">
                Found ${llm.shadowDOMAnalysis.shadowRootCount} Shadow DOM root(s). Shadow DOM content may not be accessible to search engines and LLMs.
                ${llm.shadowDOMAnalysis.recommendations.length > 0 ? llm.shadowDOMAnalysis.recommendations[0] : ''}
              </div>
            </div>
            ` : ''}
            
            ${llm.scriptBundleAnalysis && (llm.scriptBundleAnalysis.renderBlockingScripts > 0 || llm.scriptBundleAnalysis.largeBundles.length > 0) ? `
            <div style="margin-top: 15px; padding: 10px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
              <strong style="color: #1e40af; display: block; margin-bottom: 5px;">📦 Script Analysis:</strong>
              <div style="font-size: 12px; color: #1e3a8a;">
                ${llm.scriptBundleAnalysis.renderBlockingScripts > 0 ? `
                <div style="margin-bottom: 5px;">
                  <strong>Render-blocking scripts:</strong> ${llm.scriptBundleAnalysis.renderBlockingScripts}. Add 'async' or 'defer' attributes to non-critical scripts.
                </div>
                ` : ''}
                ${llm.scriptBundleAnalysis.largeBundles.length > 0 ? `
                <div>
                  <strong>Large bundles:</strong> ${llm.scriptBundleAnalysis.largeBundles.length} bundle(s) detected. Consider code splitting and lazy loading.
                </div>
                ` : ''}
              </div>
            </div>
            ` : ''}
          </div>
          
          ${llm.hasHighRendering ? `
          <div class="fix-instructions" style="margin-top: 15px; padding: 12px; background: #fef2f2; border-radius: 6px;">
            <div class="fix-instructions-title" style="font-weight: bold; color: #dc2626; margin-bottom: 8px;">⚠️ High Rendering Detected</div>
            <div class="fix-instructions-content" style="font-size: 12px; line-height: 1.6; color: #991b1b;">
              Your page has a high level of JavaScript rendering (significant HTML changes after page load). Dynamically rendered content may be missed by LLMs and search engines. Consider server-side rendering (SSR) or static site generation (SSG) for critical content.
            </div>
          </div>
          ` : ''}
        </div>
        `
      }).join('')}
    </div>
  </div>
  ` : ''}
  
  <!-- Social Media Presence -->
  ${result.siteWide?.socialMedia ? `
  <div class="page">
    <h1>Social Media Presence</h1>
    <p style="margin-bottom: 20px;">Analysis of social media integration and sharing optimization:</p>
    <div class="issues-section">
      ${(() => {
        const social = result.siteWide.socialMedia!
        const meta = social.metaTags
        const links = social.socialLinks
        
        let html = ''
        
        // Open Graph section
        html += `
        <div class="issue-item ${meta.openGraph.hasTags && meta.openGraph.missingRequired.length === 0 ? 'good' : 'medium'}">
          <div class="issue-title">Open Graph Tags</div>
          <div class="issue-details">
            <strong>Status:</strong> ${meta.openGraph.hasTags ? '✅ Detected' : '❌ Missing'}<br>
            ${meta.openGraph.ogTitle ? `<strong>OG Title:</strong> ${escapeHtml(meta.openGraph.ogTitle)}<br>` : ''}
            ${meta.openGraph.ogDescription ? `<strong>OG Description:</strong> ${escapeHtml(meta.openGraph.ogDescription.substring(0, 100))}${meta.openGraph.ogDescription.length > 100 ? '...' : ''}<br>` : ''}
            ${meta.openGraph.ogImage ? `<strong>OG Image:</strong> ${escapeHtml(meta.openGraph.ogImage.substring(0, 80))}...<br>` : ''}
            ${meta.openGraph.missingRequired.length > 0 ? `<strong>Missing:</strong> ${meta.openGraph.missingRequired.join(', ')}` : ''}
          </div>
        </div>
        `
        
        // Twitter Cards section
        html += `
        <div class="issue-item ${meta.twitter.hasCards && meta.twitter.missingRequired.length === 0 ? 'good' : 'medium'}">
          <div class="issue-title">Twitter Card Tags</div>
          <div class="issue-details">
            <strong>Status:</strong> ${meta.twitter.hasCards ? '✅ Detected' : '❌ Missing'}<br>
            ${meta.twitter.cardType ? `<strong>Card Type:</strong> ${escapeHtml(meta.twitter.cardType)}<br>` : ''}
            ${meta.twitter.twitterSite ? `<strong>Twitter Site:</strong> @${escapeHtml(meta.twitter.twitterSite)}<br>` : ''}
            ${meta.twitter.missingRequired.length > 0 ? `<strong>Missing:</strong> ${meta.twitter.missingRequired.join(', ')}` : ''}
          </div>
        </div>
        `
        
        // Social Links section
        const linkCount = Object.keys(links).length
        html += `
        <div class="issue-item ${linkCount > 0 ? 'good' : 'low'}">
          <div class="issue-title">Social Media Links</div>
          <div class="issue-details">
            <strong>Status:</strong> ${linkCount > 0 ? `✅ Found ${linkCount} platform(s)` : '⚠️ No social links detected'}<br>
            ${links.facebook ? `<strong>Facebook:</strong> <a href="${escapeHtml(links.facebook)}" style="color: #3b82f6;">${escapeHtml(links.facebook)}</a><br>` : ''}
            ${links.twitter ? `<strong>Twitter/X:</strong> <a href="${escapeHtml(links.twitter)}" style="color: #3b82f6;">${escapeHtml(links.twitter)}</a><br>` : ''}
            ${links.instagram ? `<strong>Instagram:</strong> <a href="${escapeHtml(links.instagram)}" style="color: #3b82f6;">${escapeHtml(links.instagram)}</a><br>` : ''}
            ${links.youtube ? `<strong>YouTube:</strong> <a href="${escapeHtml(links.youtube)}" style="color: #3b82f6;">${escapeHtml(links.youtube)}</a><br>` : ''}
            ${links.linkedin ? `<strong>LinkedIn:</strong> <a href="${escapeHtml(links.linkedin)}" style="color: #3b82f6;">${escapeHtml(links.linkedin)}</a><br>` : ''}
            ${links.tiktok ? `<strong>TikTok:</strong> <a href="${escapeHtml(links.tiktok)}" style="color: #3b82f6;">${escapeHtml(links.tiktok)}</a><br>` : ''}
            ${links.pinterest ? `<strong>Pinterest:</strong> <a href="${escapeHtml(links.pinterest)}" style="color: #3b82f6;">${escapeHtml(links.pinterest)}</a><br>` : ''}
            ${links.github ? `<strong>GitHub:</strong> <a href="${escapeHtml(links.github)}" style="color: #3b82f6;">${escapeHtml(links.github)}</a><br>` : ''}
            ${links.snapchat ? `<strong>Snapchat:</strong> <a href="${escapeHtml(links.snapchat)}" style="color: #3b82f6;">${escapeHtml(links.snapchat)}</a><br>` : ''}
          </div>
        </div>
        `
        
        // Enhanced Pixel Tracking section (Agency tier)
        html += `
        <div class="issue-item ${(social.hasFacebookPixel || social.hasGoogleAnalytics || social.hasGoogleTagManager) ? 'good' : 'low'}">
          <div class="issue-title">Tracking Pixels & Analytics</div>
          <div class="issue-details">
            <strong>Facebook Pixel:</strong> ${social.hasFacebookPixel ? '✅ Detected' : '⚠️ Not detected'}<br>
            <strong>Google Analytics (GA4):</strong> ${social.hasGoogleAnalytics ? '✅ Detected' : '⚠️ Not detected'}<br>
            <strong>Google Tag Manager:</strong> ${social.hasGoogleTagManager ? '✅ Detected' : '⚠️ Not detected'}<br>
            ${social.pixelTracking ? `
              ${social.pixelTracking.facebookPixel ? `<strong>FB Pixel ID:</strong> ${escapeHtml(social.pixelTracking.facebookPixel)}<br>` : ''}
              ${social.pixelTracking.googleAnalytics ? `<strong>GA ID:</strong> ${escapeHtml(social.pixelTracking.googleAnalytics)}<br>` : ''}
              ${social.pixelTracking.googleTagManager ? `<strong>GTM ID:</strong> ${escapeHtml(social.pixelTracking.googleTagManager)}<br>` : ''}
              ${social.pixelTracking.linkedinInsightsTag ? `<strong>LinkedIn Insights Tag:</strong> ${escapeHtml(social.pixelTracking.linkedinInsightsTag)}<br>` : ''}
              ${social.pixelTracking.tiktokPixel ? `<strong>TikTok Pixel:</strong> ${escapeHtml(social.pixelTracking.tiktokPixel)}<br>` : ''}
              ${social.pixelTracking.pinterestTag ? `<strong>Pinterest Tag:</strong> ${escapeHtml(social.pixelTracking.pinterestTag)}<br>` : ''}
              ${social.pixelTracking.otherPixels && social.pixelTracking.otherPixels.length > 0 ? `
                <strong>Other Pixels:</strong> ${social.pixelTracking.otherPixels.map((p: string) => escapeHtml(p)).join(', ')}<br>
              ` : ''}
            ` : ''}
          </div>
        </div>
        `
        
        // Social Schema section (Agency tier)
        if (social.socialSchema) {
          html += `
          <div class="issue-item ${social.socialSchema.hasOrganizationSchema ? 'good' : 'medium'}">
            <div class="issue-title">Social Schema Markup</div>
            <div class="issue-details">
              <strong>Organization Schema:</strong> ${social.socialSchema.hasOrganizationSchema ? '✅ Detected' : '⚠️ Missing'}<br>
              <strong>Social Profile Links:</strong> ${social.socialSchema.hasSocialProfileLinks ? '✅ Detected' : '⚠️ Missing'}<br>
              ${social.socialSchema.schemaTypes && social.socialSchema.schemaTypes.length > 0 ? `
                <strong>Schema Types:</strong> ${social.socialSchema.schemaTypes.map((t: string) => escapeHtml(t)).join(', ')}<br>
              ` : ''}
            </div>
          </div>
          `
        }
        
        // Share Image Validation section (Agency tier)
        if (social.shareImageValidation) {
          html += `
          <div class="issue-item ${social.shareImageValidation.isValidSize && social.shareImageValidation.isValidRatio ? 'good' : 'medium'}">
            <div class="issue-title">Share Image Validation</div>
            <div class="issue-details">
              <strong>Size Valid:</strong> ${social.shareImageValidation.isValidSize ? '✅ Yes' : '⚠️ Check recommended'}<br>
              <strong>Ratio Valid:</strong> ${social.shareImageValidation.isValidRatio ? '✅ Yes' : '⚠️ Check recommended'}<br>
              ${social.shareImageValidation.ogImageSize ? `
                <strong>OG Image Size:</strong> ${social.shareImageValidation.ogImageSize.width}×${social.shareImageValidation.ogImageSize.height}px<br>
              ` : ''}
              ${social.shareImageValidation.twitterImageSize ? `
                <strong>Twitter Image Size:</strong> ${social.shareImageValidation.twitterImageSize.width}×${social.shareImageValidation.twitterImageSize.height}px<br>
              ` : ''}
              ${social.shareImageValidation.recommendations && social.shareImageValidation.recommendations.length > 0 ? `
                <strong>Recommendations:</strong><br>
                <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 11px;">
                  ${social.shareImageValidation.recommendations.map((rec: string) => `<li>${escapeHtml(rec)}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          </div>
          `
        }
        
        // Social Markup Consistency section (Agency tier)
        if (social.socialMarkupConsistency) {
          html += `
        <div class="issue-item ${!social.socialMarkupConsistency.hasConflicts ? 'good' : 'medium'}">
          <div class="issue-title">Social Markup Consistency</div>
          <div class="issue-details">
            <strong>Status:</strong> ${!social.socialMarkupConsistency.hasConflicts ? '✅ Consistent' : '⚠️ Conflicts detected'}<br>
            ${social.socialMarkupConsistency.conflicts && social.socialMarkupConsistency.conflicts.length > 0 ? `
              <strong>Conflicts:</strong><br>
              <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 11px;">
                ${social.socialMarkupConsistency.conflicts.map((conflict: string) => `<li>${escapeHtml(conflict)}</li>`).join('')}
              </ul>
            ` : ''}
            ${social.socialMarkupConsistency.recommendations && social.socialMarkupConsistency.recommendations.length > 0 ? `
              <strong>Recommendations:</strong><br>
              <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 11px;">
                ${social.socialMarkupConsistency.recommendations.map((rec: string) => `<li>${escapeHtml(rec)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        </div>
        `
        }
        
        // Favicon section
        html += `
        <div class="issue-item ${social.hasFavicon ? 'good' : 'low'}">
          <div class="issue-title">Favicon</div>
          <div class="issue-details">
            <strong>Status:</strong> ${social.hasFavicon ? '✅ Detected' : '⚠️ Missing'}<br>
            ${social.faviconUrl ? `<strong>URL:</strong> <a href="${escapeHtml(social.faviconUrl)}" style="color: #3b82f6;">${escapeHtml(social.faviconUrl)}</a>` : ''}
          </div>
        </div>
        `
        
        return html
      })()}
    </div>
  </div>
  ` : ''}
  
  <!-- Enhanced Schema Analysis -->
  ${result.pages.some(p => p.schemaAnalysis) ? `
  <div class="page">
    <h1>Schema Markup Analysis</h1>
    <p style="margin-bottom: 20px;">Identity Schema detection and validation:</p>
    <div class="issues-section">
      ${result.pages.filter(p => p.schemaAnalysis).slice(0, 10).map(page => {
        const schema = page.schemaAnalysis!
        return `
        <div class="issue-item ${!schema.hasIdentitySchema ? 'medium' : schema.missingFields && schema.missingFields.length > 0 ? 'low' : 'good'}">
          <div class="issue-title">${page.url}</div>
          <div class="issue-details">
            <strong>Has Schema:</strong> ${page.hasSchemaMarkup ? 'Yes' : 'No'}<br>
            <strong>Schema Types:</strong> ${page.schemaTypes?.join(', ') || 'None'}<br>
            <strong>Identity Schema:</strong> ${schema.hasIdentitySchema ? `Yes (${schema.identityType})` : 'No'}<br>
            ${schema.missingFields && schema.missingFields.length > 0 ? `<strong>Missing Fields:</strong> ${schema.missingFields.join(', ')}` : ''}
          </div>
          ${!schema.hasIdentitySchema ? `
          <div class="fix-instructions">
            <div class="fix-instructions-title">Recommendation</div>
            <div class="fix-instructions-content">Add Organization or Person Schema to help search engines and LLMs identify the ownership of your website.</div>
          </div>
          ` : ''}
        </div>
        `
      }).join('')}
    </div>
  </div>
  ` : ''}
  
  <!-- Competitor Keyword Gap Analysis (if add-on selected) -->
  ${result.competitorAnalysis ? `
  <div class="page">
    <h1>Competitor Keyword Gap Analysis</h1>
    ${generateCompetitorComparisonTable(result)}
    
    ${result.competitorAnalysis.detectedIndustry ? `
      <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0 0 8px 0;"><strong>🎯 Detected Industry:</strong> ${result.competitorAnalysis.detectedIndustry}</p>
        <p style="margin: 0 0 8px 0;"><strong>📊 Confidence:</strong> ${Math.round((result.competitorAnalysis.industryConfidence || 0) * 100)}%</p>
        ${result.competitorAnalysis.allCompetitors && result.competitorAnalysis.allCompetitors.length > 0 ? `
          <p style="margin: 0 0 8px 0;"><strong>🏢 Competitors Analyzed (${result.competitorAnalysis.allCompetitors.length}):</strong></p>
          <ul style="margin: 0; padding-left: 20px;">
            ${result.competitorAnalysis.allCompetitors.map(c => {
              const isAutoDetected = result.competitorAnalysis?.autoDetectedCompetitors?.includes(c)
              const isUserProvided = result.competitorAnalysis?.userProvidedCompetitors?.includes(c)
              const label = isAutoDetected ? '🤖 Auto-detected' : isUserProvided ? '👤 You provided' : ''
              return `<li style="margin: 4px 0;"><a href="${c}" style="color: #3b82f6;">${c.replace(/^https?:\/\/(www\.)?/, '')}</a> ${label ? `<span style="color: #666; font-size: 12px;">(${label})</span>` : ''}</li>`
            }).join('')}
          </ul>
        ` : ''}
      </div>
    ` : ''}
    
    ${result.competitorAnalysis.competitorUrl && result.competitorAnalysis.competitorUrl.startsWith('http') ? `
      <p style="margin-bottom: 20px;"><strong>Competitor Analysis Method:</strong> Real competitor crawl</p>
      <p style="margin-bottom: 20px;">This analysis crawled ${result.competitorAnalysis.allCompetitors?.length || 1} competitor site(s) and extracted real keywords from their content, comparing them against your site to identify opportunities.</p>
      ${result.competitorAnalysis.autoDetectedCompetitors && result.competitorAnalysis.autoDetectedCompetitors.length > 0 ? `
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
          <p style="margin: 0; font-size: 13px; color: #92400e;"><strong>ℹ️ Auto-Detection:</strong> ${result.competitorAnalysis.autoDetectedCompetitors.length} competitor(s) were automatically detected based on industry classification. You can override these by providing competitor URLs when creating the audit.</p>
        </div>
      ` : ''}
    ` : result.competitorAnalysis.competitorUrl && result.competitorAnalysis.competitorUrl.includes('required') ? `
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: bold; color: #dc2626;">⚠️ Agency Tier Requirement: Competitor URLs Required</p>
        <p style="margin: 8px 0 0 0; color: #666;">Agency tier includes 3 competitor crawls + keyword gap analysis. No competitor URLs were provided and auto-detection found none. Please provide competitor URLs for full Agency-tier competitor analysis.</p>
      </div>
      <p style="margin-bottom: 20px;">This analysis uses pattern-based keyword suggestions as a fallback. For full Agency-tier competitor analysis, provide competitor URLs when creating the audit.</p>
    ` : result.competitorAnalysis.competitorUrl && result.competitorAnalysis.competitorUrl.includes('No competitors') ? `
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: bold; color: #dc2626;">⚠️ No Competitors Found</p>
        <p style="margin: 8px 0 0 0; color: #666;">Auto-detection could not find competitors in your industry. This analysis uses pattern-based keyword suggestions as a fallback.</p>
      </div>
    ` : result.competitorAnalysis.competitorUrl ? `
      <p style="margin-bottom: 20px;">${result.competitorAnalysis.competitorUrl}. This analysis identifies niche-specific keyword opportunities by combining your site's core topics with common SEO patterns used by competitors in your industry.</p>
    ` : `
      <p style="margin-bottom: 20px;">Competitor analysis based on industry patterns and common SEO strategies.</p>
    `}
    
    <div style="margin-bottom: 30px;">
      <h2>Keyword Gaps (Opportunities)</h2>
      <p style="color: #666; margin-bottom: 15px;">These keywords are commonly used by competitors but missing from your site:</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${result.competitorAnalysis.keywordGaps && result.competitorAnalysis.keywordGaps.length > 0 ? result.competitorAnalysis.keywordGaps.map(kw => 
          `<span style="background: #fef2f2; border: 1px solid #fecaca; padding: 6px 12px; border-radius: 4px; font-size: 13px; color: #991b1b;">${escapeHtml(kw)}</span>`
        ).join('') : '<p style="color: #999; font-style: italic;">No keyword gaps identified</p>'}
      </div>
    </div>
    
    <div style="margin-bottom: 30px;">
      <h2>Shared Keywords</h2>
      <p style="color: #666; margin-bottom: 15px;">Keywords you're already targeting that competitors also use:</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${result.competitorAnalysis.sharedKeywords && result.competitorAnalysis.sharedKeywords.length > 0 ? result.competitorAnalysis.sharedKeywords.map(kw => 
          `<span style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px 12px; border-radius: 4px; font-size: 13px; color: #166534;">${escapeHtml(kw)}</span>`
        ).join('') : '<p style="color: #999; font-style: italic;">No shared keywords identified</p>'}
      </div>
    </div>
    
    <div>
      <h2>Competitor Keywords Analyzed</h2>
      <p style="color: #666; margin-bottom: 15px;">Common keywords found in competitor analysis:</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${result.competitorAnalysis.competitorKeywords && result.competitorAnalysis.competitorKeywords.length > 0 ? result.competitorAnalysis.competitorKeywords.map(kw => 
          `<span style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 4px; font-size: 13px; color: #1e40af;">${escapeHtml(kw)}</span>`
        ).join('') : '<p style="color: #999; font-style: italic;">No competitor keywords found</p>'}
      </div>
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f0f9ff; border-radius: 8px;">
      <h3 style="color: #3b82f6; margin-bottom: 10px;">Recommendations</h3>
      <ol style="padding-left: 20px;">
        <li style="margin-bottom: 10px;">Create content targeting the identified keyword gaps to capture additional search traffic</li>
        <li style="margin-bottom: 10px;">Optimize existing pages for shared keywords to improve rankings</li>
        <li style="margin-bottom: 10px;">Monitor competitor content strategies and adapt your approach accordingly</li>
        <li style="margin-bottom: 10px;">Focus on high-value keyword gaps that align with your business goals</li>
      </ol>
    </div>
  </div>
  ` : ''}
  
  <!-- Internal Link Graph (Agency tier) -->
  ${result.internalLinkGraph && result.raw.options.tier === 'agency' ? `
  <div class="page">
    <h1>Internal Link Graph Analysis</h1>
    ${result.summary.totalPages < 10 ? `
      <div style="padding: 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; margin-bottom: 20px;">
        <p style="margin: 0; font-weight: bold; color: #92400e;">⚠️ Insufficient Pages for Full Internal Link Graph</p>
        <p style="margin: 8px 0 0 0; color: #78350f;">This audit analyzed ${result.summary.totalPages} page(s). A comprehensive internal link graph requires at least 10 pages to provide meaningful insights. Below is the orphan page analysis based on available pages.</p>
      </div>
    ` : ''}
    ${generateInternalLinkGraphVisualization(result)}
  </div>
  ` : ''}
  
  <!-- Duplicate URL Cleaning (Agency tier) -->
  ${(result as any).duplicateUrlAnalysis && result.raw.options.tier === 'agency' ? `
  <div class="page">
    <h1>Duplicate URL Analysis</h1>
    ${generateDuplicateUrlReport((result as any).duplicateUrlAnalysis)}
  </div>
  ` : ''}
  
  <!-- JS Rendering Diagnostics (Agency tier) -->
  ${result.pages.some(p => (p.llmReadability as any)?.hydrationIssues || (p.llmReadability as any)?.scriptBundleAnalysis) && result.raw.options.tier === 'agency' ? `
  <div class="page">
    <h1>JS Rendering Diagnostics</h1>
    ${generateJSRenderingDiagnostics(result.pages)}
  </div>
  ` : ''}
  
  <!-- Crawl Diagnostics (Agency tier) -->
  ${result.crawlDiagnostics && result.raw.options.tier === 'agency' ? `
  <div class="page">
    <h1>Crawl Diagnostics</h1>
    ${result.crawlDiagnostics.crawlMetrics ? generateCrawlDiagnosticsDisplay(result.crawlDiagnostics) : `
      <div style="padding: 20px; background: #fef2f2; border-left: 4px solid #f59e0b; border-radius: 8px;">
        <p style="margin: 0; font-weight: bold; color: #dc2626;">⚠️ Limited Crawl Data</p>
        <p style="margin: 8px 0 0 0; color: #666;">
          Crawl diagnostics require at least 5 pages for meaningful metrics. 
          This audit analyzed ${result.summary.totalPages} page(s). 
          For full Agency-tier crawl diagnostics, ensure a deeper crawl is performed.
        </p>
      </div>
    `}
  </div>
  ` : ''}
  
  <!-- Enhanced Local SEO (Agency tier) -->
  ${result.localSEO && result.raw.options.tier === 'agency' ? `
  <div class="page">
    <h1>Local SEO Analysis</h1>
    ${generateEnhancedLocalSEODisplay(result.localSEO)}
  </div>
  ` : ''}
  
  <!-- Page-Level Issue Mapping (Agency tier) -->
  ${result.raw.options.tier === 'agency' ? `
  <div class="page">
    <h1>Page-Level Issue Mapping</h1>
    <p style="margin-bottom: 20px;">Detailed breakdown of issues per page for Agency-tier analysis:</p>
    ${generatePageLevelIssueMapping(result)}
  </div>
  ` : ''}
  
  <!-- Page-Level Findings -->
  <div class="page">
    <h1>Page-Level Findings</h1>
    <p>Summary of key metrics for scanned pages (showing top 50):</p>
    <table>
      <thead>
        <tr>
          <th>URL</th>
          <th>Status</th>
          <th>Title</th>
          <th>Words</th>
          <th>H1</th>
          <th>Images</th>
          <th>Missing Alt</th>
          <th>Links</th>
          <th>Load Time</th>
        </tr>
      </thead>
      <tbody>
        ${result.pages.slice(0, 50).map(page => {
          // Escape URL to prevent LaTeX interpretation
          const urlText = escapeHtml(page.url)
          
          // Format title (truncate if needed)
          const titleText = page.title 
            ? escapeHtml(page.title.length > 30 ? page.title.substring(0, 27) + '...' : page.title)
            : 'Missing'
          
          // Format links (use single line, escape to prevent LaTeX)
          const totalLinks = page.internalLinkCount + page.externalLinkCount
          const linksText = escapeHtml(`${totalLinks} (${page.internalLinkCount} int, ${page.externalLinkCount} ext)`)
          
          // Format load time (escape to prevent LaTeX)
          const loadTimeMs = page.loadTime || 0
          const loadTimeText = escapeHtml(`${loadTimeMs} ms`)
          // Prioritize PageSpeed Insights data (real-world) over local rendering metrics
          const pageSpeed = page.pageSpeedData as any
          const lcpValue = pageSpeed?.mobile?.lcp || pageSpeed?.desktop?.lcp || pageSpeed?.lcp || page.performanceMetrics?.lcp
          // Only show LCP if it's from PageSpeed (realistic) or if it's > 500ms (somewhat realistic from local rendering)
          const lcpText = (lcpValue && lcpValue > 500) ? `<br><small style="font-size: 9px;">${escapeHtml(`LCP: ${Math.round(lcpValue)} ms`)}</small>` : ''
          
          return `
          <tr>
            <td style="max-width: 200px; word-break: break-all; word-wrap: break-word; font-size: 9px; line-height: 1.3; padding: 8px; font-family: monospace;">${urlText}</td>
            <td style="text-align: center; padding: 8px;">${page.statusCode || 'Error'}</td>
            <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; font-size: 10px; padding: 8px;" title="${page.title ? escapeHtml(page.title) : ''}">${titleText}</td>
            <td style="text-align: center; padding: 8px;">${page.wordCount || 0}</td>
            <td style="text-align: center; padding: 8px;">${page.h1Count || 0}</td>
            <td style="text-align: center; padding: 8px;">${page.imageCount || 0}</td>
            <td style="text-align: center; padding: 8px;">${page.missingAltCount || 0}</td>
            <td style="text-align: center; font-size: 10px; line-height: 1.3; padding: 8px;">${linksText}</td>
            <td style="text-align: center; font-size: 10px; line-height: 1.3; padding: 8px;">${loadTimeText}${lcpText}</td>
          </tr>
        `
        }).join('')}
      </tbody>
    </table>
    ${result.pages.length > 50 ? `<p style="margin-top: 15px; color: #666;">Note: Showing top 50 of ${result.pages.length} pages. Full data available in web interface.</p>` : ''}
  </div>
</body>
</html>
  `
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'High':
      return '#ef4444'
    case 'Medium':
      return '#f59e0b'
    case 'Low':
      return '#10b981'
    default:
      return '#6b7280'
  }
}

/**
 * Escape HTML entities to display code examples properly in PDF
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\$/g, '&#36;') // Escape dollar signs to prevent LaTeX interpretation
}

/**
 * Get specific fix instructions for an issue based on its message
 * Uses issue.fixInstructions if available, otherwise generates from message
 */
function getFixInstructions(issue: { message: string; details?: string; category: string; fixInstructions?: string }): string {
  // If fix instructions already exist, use them
  if (issue.fixInstructions) {
    return issue.fixInstructions
  }
  const msg = issue.message.toLowerCase()
  const details = issue.details || ''
  
  // Technical issues
  if (msg.includes('sitemap') || msg.includes('sitemap.xml')) {
    return `1. Create a sitemap.xml file in your website's root directory (e.g., https://yoursite.com/sitemap.xml)
2. Include all important pages with their URLs, last modified dates, and priority
3. Submit the sitemap to Google Search Console (Search Console > Sitemaps > Add new sitemap)
4. Update your sitemap whenever you add or modify pages`
  }
  
  if (msg.includes('robots.txt')) {
    return `1. Create a robots.txt file in your website's root directory (e.g., https://yoursite.com/robots.txt)
2. Ensure it's accessible and returns a 200 status code
3. Use it to control which pages search engines can crawl (e.g., "User-agent: *\nAllow: /" to allow all)
4. Test it using Google Search Console's robots.txt Tester tool`
  }
  
  if (msg.includes('schema markup') || msg.includes('structured data')) {
    return `1. Add schema.org structured data to your pages using JSON-LD (recommended) or microdata
2. For JSON-LD, add a script tag in the <head> section: <script type="application/ld+json">{...}</script>
3. Use appropriate schema types (e.g., Organization, WebPage, Article, Product, LocalBusiness)
4. Validate your schema using Google's Rich Results Test tool
5. Common schemas: Organization (for homepage), Article (for blog posts), Product (for e-commerce)
6. Example JSON-LD: {"@context":"https://schema.org","@type":"Organization","name":"Your Company"}`
  }
  
  if (msg.includes('broken') || msg.includes('error status')) {
    return `1. Identify the broken URLs from the affected pages list
2. Check if pages were moved or deleted - set up 301 redirects to new locations
3. For permanently deleted pages, return a 410 Gone status or remove links to them
4. Fix any server errors (500, 503) by checking server logs and resolving backend issues
5. Update internal links pointing to broken pages`
  }
  
  // On-page issues
  if (msg.includes('missing page title') || msg.includes('missing title')) {
    return `1. Add a unique <title> tag in the <head> section of each affected page
2. Keep titles between 50-60 characters for optimal display in search results
3. Include your primary keyword near the beginning
4. Make each title unique and descriptive of the page content
5. Example: <title>Your Primary Keyword - Your Brand Name</title>`
  }
  
  if (msg.includes('page title too short') || msg.includes('title tag too short') || msg.includes('title too short')) {
    return `1. Expand your title tag to 50-60 characters
2. Include your primary keyword near the beginning
3. Add your brand name at the end (if space allows)
4. Make it compelling and click-worthy
5. Example: "Best [Keyword] Guide 2024 | [Brand Name]"
6. Test how it appears in search results using SERP preview tools`
  }
  
  if (msg.includes('page title too long')) {
    return `1. Shorten your page title to 50-60 characters
2. Remove unnecessary words or brand names if they push it over the limit
3. Keep the most important keywords at the beginning
4. Use a pipe (|) or dash (-) to separate key phrases if needed
5. Preview in search results to ensure it displays fully`
  }
  
  if (msg.includes('duplicate page title')) {
    return `1. Review all pages with the duplicate title from the affected pages list
2. Create unique, descriptive titles for each page that reflect their specific content
3. Include page-specific keywords or location information to differentiate them
4. Update the <title> tag in the <head> section of each affected page
5. Ensure no two pages share the exact same title`
  }
  
  if (msg.includes('missing meta description') || msg.includes('missing description')) {
    return `1. Add a <meta name="description"> tag in the <head> section of each affected page
2. Write compelling descriptions between 120-160 characters
3. Include your primary keyword naturally in the description
4. Make it enticing to encourage clicks from search results
5. Example: <meta name="description" content="Your compelling description here...">`
  }
  
  if (msg.includes('meta description too short') || msg.includes('description too short')) {
    return `1. Expand your meta description to 120-160 characters
2. Include your primary keyword naturally
3. Add a compelling call-to-action
4. Highlight unique value proposition
5. Example: "Discover the best [keyword] strategies. Learn proven techniques to [benefit]. Get started today!"
6. Make it compelling to improve click-through rates from search results`
  }
  
  if (msg.includes('meta description too long')) {
    return `1. Shorten your meta description to 120-160 characters
2. Remove unnecessary words while keeping the core message
3. Focus on the most important information and keywords
4. Ensure it displays fully in search results (Google typically shows ~155 characters)
5. Keep the most compelling part at the beginning`
  }
  
  if (msg.includes('duplicate meta description')) {
    return `1. Review all pages with duplicate meta descriptions from the affected pages list
2. Write unique descriptions for each page that highlight their specific content
3. Include page-specific keywords or value propositions
4. Update the <meta name="description"> tag on each affected page
5. Ensure each page has a distinct, compelling description`
  }
  
  if (msg.includes('missing h1') || msg.includes('no h1')) {
    return `1. Add a single <h1> tag to each affected page
2. Place it near the top of the main content area
3. Include your primary keyword in the H1
4. Make it descriptive and match the page's main topic
5. Ensure only one H1 per page (multiple H1s can confuse search engines)
6. Example: <h1>Your Main Heading Here</h1>`
  }
  
  if (msg.includes('multiple h1')) {
    return `1. Review all H1 tags on the affected pages
2. Keep only the most important heading as H1 (the main page title)
3. Convert other H1 tags to H2 or H3 tags
4. Maintain a logical heading hierarchy: H1 (main) → H2 (sections) → H3 (subsections)
5. Ensure your H1 accurately represents the page's primary topic`
  }
  
  // Content issues
  if (msg.includes('thin content') || msg.includes('low word count') || msg.includes('content could be more comprehensive')) {
    return `1. Expand content to at least 300 words for basic pages
2. Aim for 1000+ words for comprehensive, authoritative content
3. Add more detail, examples, and explanations
4. Include FAQs, case studies, or related information
5. Break content into logical sections with headings
6. Add supporting images, charts, or infographics
7. Consider creating a content calendar for regular updates`
  }
  
  if (msg.includes('content is very difficult to read') || msg.includes('content readability could be improved') || msg.includes('flesch')) {
    return `1. Simplify sentence structure - aim for 15-20 words per sentence
2. Use shorter, more common words instead of complex vocabulary
3. Break long sentences into shorter ones
4. Use active voice instead of passive voice
5. Add transition words to connect ideas
6. Use bullet points and lists for complex information
7. Test readability using tools like Hemingway Editor
8. Aim for Flesch Reading Ease score of 60+ for general audiences`
  }
  
  if (msg.includes('sentences are too long')) {
    return `1. Break long sentences into shorter ones
2. Aim for 15-20 words per sentence on average
3. Remove unnecessary clauses and phrases
4. Use commas and semicolons appropriately
5. Read sentences aloud to check natural flow
6. Use sentence variety - mix short and medium sentences`
  }
  
  if (msg.includes('content could benefit from lists') || msg.includes('lists')) {
    return `1. Use bulleted lists for unordered items
2. Use numbered lists for sequential steps
3. Keep list items concise (one line when possible)
4. Use parallel structure in list items
5. Introduce lists with a brief sentence
6. Limit lists to 5-7 items for readability
7. Break very long lists into multiple shorter lists`
  }
  
  // Accessibility issues
  if (msg.includes('missing alt') || msg.includes('alt text') || msg.includes('alt attribute') || msg.includes('high percentage of images missing alt')) {
    return `1. Add descriptive alt attributes to all images on affected pages
2. Describe what the image shows or its purpose (e.g., alt="Woman using laptop at desk")
3. Keep alt text concise (under 125 characters recommended)
4. For decorative images, use alt="" (empty but present)
5. Include relevant keywords naturally if the image is content-related
6. Example: <img src="image.jpg" alt="Descriptive text here">
7. Don't start with "image of" or "picture of" - be direct and descriptive`
  }
  
  if (msg.includes('viewport') || msg.includes('mobile')) {
    return `1. Add a viewport meta tag to the <head> section of affected pages
2. Use: <meta name="viewport" content="width=device-width, initial-scale=1.0">
3. This ensures your site displays correctly on mobile devices
4. Test mobile responsiveness using Google's Mobile-Friendly Test tool
5. Ensure all pages include this tag for proper mobile SEO`
  }
  
  // Performance issues
  if (msg.includes('lcp') || msg.includes('largest contentful paint')) {
    return `1. Optimize images: compress, use modern formats (WebP), add width/height attributes
2. Reduce server response time: use a CDN, optimize server configuration
3. Eliminate render-blocking resources: defer non-critical CSS/JS
4. Preload important resources: use <link rel="preload"> for critical assets
5. Optimize fonts: use font-display: swap, subset fonts
6. Consider lazy-loading below-the-fold images`
  }
  
  if (msg.includes('cls') || msg.includes('cumulative layout shift')) {
    return `1. Add size attributes to images and videos (width and height)
2. Reserve space for ads, embeds, and iframes
3. Avoid inserting content above existing content
4. Use transform animations instead of properties that trigger layout
5. Prefer transform and opacity for animations
6. Load web fonts with font-display: optional or swap`
  }
  
  if (msg.includes('fid') || msg.includes('first input delay') || msg.includes('tbt') || msg.includes('total blocking time')) {
    return `1. Reduce JavaScript execution time: code splitting, tree shaking
2. Break up long tasks: use setTimeout or requestIdleCallback
3. Defer non-critical JavaScript: load scripts asynchronously
4. Remove unused JavaScript: audit and remove unnecessary code
5. Minimize main thread work: use Web Workers for heavy computation
6. Optimize third-party scripts: load asynchronously or defer`
  }
  
  if (msg.includes('ttfb') || msg.includes('time to first byte')) {
    return `1. Optimize server response time: upgrade hosting, use faster server
2. Use a CDN: serve content from locations closer to users
3. Enable server-side caching: cache HTML and API responses
4. Optimize database queries: add indexes, reduce query complexity
5. Use HTTP/2 or HTTP/3: faster protocol for multiple requests
6. Consider static site generation for content that doesn't change frequently`
  }
  
  if (msg.includes('slow page load') || msg.includes('performance')) {
    return `1. Optimize images: compress, use modern formats, lazy-load
2. Minimize CSS and JavaScript: remove unused code, minify
3. Enable browser caching: set appropriate cache headers
4. Use a CDN: serve static assets from edge locations
5. Optimize server response time: upgrade hosting or optimize backend
6. Reduce HTTP requests: combine files, use sprites where appropriate`
  }
  
  // LLM Readability issues
  if (msg.includes('llm readability') || msg.includes('rendering percentage')) {
    return `1. Use server-side rendering (SSR) for critical content
2. Ensure main content is in initial HTML, not rendered via JavaScript
3. Move H1 tags and key headings to server-rendered HTML
4. Pre-render important content: use static generation where possible
5. Consider hybrid rendering: SSR for SEO-critical pages, CSR for interactive features
6. Test with JavaScript disabled to ensure content is accessible`
  }
  
  // Schema issues
  if (msg.includes('identity schema') || msg.includes('organization') || msg.includes('person schema')) {
    return `1. Add Organization or Person Schema using JSON-LD format
2. Include required fields: name (required), url (required for Organization)
3. Add optional but recommended fields: logo, email, phone, address
4. Place schema in <head> or <body> as JSON-LD script tag
5. Validate schema using Google's Rich Results Test
6. Example: <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Your Company","url":"https://yoursite.com"}</script>`
  }
  
  // Generic fallback
  return `1. Review the issue details above
2. Identify the root cause on the affected pages
3. Implement the recommended fix following SEO best practices
4. Test the changes to ensure they're working correctly
5. Monitor search console for improvements over the next few weeks`
}

/**
 * Generate priority action plan based on issues
 */
function generatePriorityActionPlan(result: AuditResult): string {
  const { 
    technicalIssues = [], 
    onPageIssues = [], 
    contentIssues = [], 
    accessibilityIssues = [], 
    performanceIssues = [] 
  } = result
  
  const highPriority = [
    ...(technicalIssues || []).filter(i => i.severity === 'High'),
    ...(onPageIssues || []).filter(i => i.severity === 'High'),
    ...(contentIssues || []).filter(i => i.severity === 'High'),
    ...(accessibilityIssues || []).filter(i => i.severity === 'High'),
    ...(performanceIssues || []).filter(i => i.severity === 'High')
  ]
  
  const mediumPriority = [
    ...(technicalIssues || []).filter(i => i.severity === 'Medium'),
    ...(onPageIssues || []).filter(i => i.severity === 'Medium'),
    ...(performanceIssues || []).filter(i => i.severity === 'Medium'),
    ...(contentIssues || []).filter(i => i.severity === 'Medium'),
    ...(accessibilityIssues || []).filter(i => i.severity === 'Medium')
  ]
  
  let html = ''
  
  if (highPriority.length > 0) {
    html += `<div style="margin-bottom: 30px;">
      <h2 style="color: #ef4444; margin-bottom: 15px;">Week 1: High Priority Issues (${highPriority.length})</h2>
      <p style="margin-bottom: 10px; color: #666;">These issues have the most significant impact on SEO performance. Fix these first.</p>
      <ol style="padding-left: 20px;">`
    highPriority.slice(0, 10).forEach((issue, idx) => {
      // Extract counts from details (e.g., "21 of 21 images", "Found on 2 pages")
      const countMatch = issue.details?.match(/(\d+)\s+of\s+(\d+)|Found on\s+(\d+)|(\d+)\s+page/i)
      const countText = countMatch ? ` (${countMatch[1] ? `${countMatch[1]} of ${countMatch[2]}` : countMatch[3] ? `Found on ${countMatch[3]} pages` : countMatch[4] ? `${countMatch[4]} pages` : ''})` : issue.affectedPages && issue.affectedPages.length > 0 ? ` (${issue.affectedPages.length} ${issue.affectedPages.length === 1 ? 'page' : 'pages'})` : ''
      
      html += `<li style="margin-bottom: 10px;">
        <strong>${escapeHtml(issue.message)}</strong>${countText ? `<span style="color: #666;">${countText}</span>` : ''}
        ${issue.details && !issue.details.match(/\d+\s+of\s+\d+|Found on\s+\d+/i) ? `<div style="color: #666; font-size: 12px; margin-top: 3px;">${escapeHtml(issue.details)}</div>` : ''}
      </li>`
    })
    html += `</ol></div>`
  }
  
  if (mediumPriority.length > 0) {
    html += `<div style="margin-bottom: 30px;">
      <h2 style="color: #f59e0b; margin-bottom: 15px;">Week 2: Medium Priority Issues (${mediumPriority.length})</h2>
      <p style="margin-bottom: 10px; color: #666;">Address these after high-priority fixes are complete.</p>
      <ol style="padding-left: 20px;">`
    mediumPriority.slice(0, 10).forEach((issue, idx) => {
      // Extract counts from details (e.g., "21 of 21 images", "Found on 2 pages")
      const countMatch = issue.details?.match(/(\d+)\s+of\s+(\d+)|Found on\s+(\d+)|(\d+)\s+page/i)
      const countText = countMatch ? ` (${countMatch[1] ? `${countMatch[1]} of ${countMatch[2]}` : countMatch[3] ? `Found on ${countMatch[3]} pages` : countMatch[4] ? `${countMatch[4]} pages` : ''})` : issue.affectedPages && issue.affectedPages.length > 0 ? ` (${issue.affectedPages.length} ${issue.affectedPages.length === 1 ? 'page' : 'pages'})` : ''
      
      html += `<li style="margin-bottom: 10px;">
        <strong>${escapeHtml(issue.message)}</strong>${countText ? `<span style="color: #666;">${countText}</span>` : ''}
        ${issue.details && !issue.details.match(/\d+\s+of\s+\d+|Found on\s+\d+/i) ? `<div style="color: #666; font-size: 12px; margin-top: 3px;">${escapeHtml(issue.details)}</div>` : ''}
      </li>`
    })
    html += `</ol></div>`
  }
  
  // Check both filtered arrays AND summary counts to avoid false positives
  const hasHighFromSummary = result.summary.highSeverityIssues > 0
  const hasMediumFromSummary = result.summary.mediumSeverityIssues > 0
  const hasHighFromArray = highPriority.length > 0
  const hasMediumFromArray = mediumPriority.length > 0
  
  // CRITICAL FIX: Trust summary counts as source of truth
  // If summary shows issues, we MUST show them (even if arrays are temporarily empty)
  // Only show "no issues" if BOTH the arrays AND summary confirm no issues
  const totalPriorityFromSummary = hasHighFromSummary || hasMediumFromSummary
  const totalPriorityFromArrays = hasHighFromArray || hasMediumFromArray
  
  if (!totalPriorityFromSummary && !totalPriorityFromArrays) {
    // Both summary and arrays confirm no issues
    html += `<p style="color: #10b981; font-weight: bold;">✅ No high or medium priority issues found. Your site is in excellent shape!</p>`
  } else if (totalPriorityFromSummary && !totalPriorityFromArrays) {
    // Summary shows issues but arrays are empty - this is a data consistency bug
    // Show the issues from summary counts and log a warning
    console.warn('[PDF] Priority Action Plan: Summary shows issues but filtered arrays are empty. This may indicate a severity categorization issue.')
    const totalPriorityCount = result.summary.highSeverityIssues + result.summary.mediumSeverityIssues
    html += `<div style="margin-bottom: 30px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
      <h2 style="color: #92400e; margin-bottom: 10px; font-size: 16px;">⚠️ ${totalPriorityCount} Priority Issue(s) Detected</h2>
      <p style="color: #78350f; margin-bottom: 8px; font-size: 14px;">
        ${result.summary.highSeverityIssues > 0 ? `<strong>High Priority:</strong> ${result.summary.highSeverityIssues} issue(s)` : ''}
        ${result.summary.highSeverityIssues > 0 && result.summary.mediumSeverityIssues > 0 ? ' • ' : ''}
        ${result.summary.mediumSeverityIssues > 0 ? `<strong>Medium Priority:</strong> ${result.summary.mediumSeverityIssues} issue(s)` : ''}
      </p>
      <p style="color: #78350f; font-size: 13px; margin: 0;">Please review the detailed issues sections below for specific recommendations.</p>
    </div>`
  }
  // If arrays have issues, they're already displayed above (lines 1493-1527)
  
  // Add keywords section if available
  if (result.summary.extractedKeywords && result.summary.extractedKeywords.length > 0) {
      // Format keywords as table (max 8 columns, wrap as needed)
      const keywords = result.summary.extractedKeywords
      const columns = 8
      html += `<div style="margin-top: 30px;">
      <h3 style="color: #3b82f6; margin-bottom: 10px;">Extracted Keywords</h3>
      <p style="color: #666; font-size: 14px; margin-bottom: 10px;">Keywords found in titles, headings, and meta descriptions:</p>
      <table style="width: 100%; margin-top: 10px; border-collapse: collapse;">
        <tbody>`
      for (let i = 0; i < keywords.length; i += columns) {
        const row = keywords.slice(i, i + columns)
        html += `<tr>`
        for (let j = 0; j < columns; j++) {
          if (j < row.length) {
            // Escape keyword to prevent LaTeX interpretation and HTML issues
            const keywordText = escapeHtml(row[j]).replace(/\s+/g, ' ') // Normalize whitespace
            html += `<td style="padding: 6px; border: 1px solid #e5e7eb; font-size: 12px; text-align: center; word-break: break-word;">${keywordText}</td>`
          } else {
            html += `<td style="padding: 6px; border: 1px solid #e5e7eb;"></td>`
          }
        }
        html += `</tr>`
      }
      html += `</tbody></table></div>`
  }
  
  return html
}

/**
 * Get tier description
 */
function getTierDescription(tier: string): string {
  switch (tier) {
    case 'starter':
      return 'Deep crawl (up to 5 pages), JavaScript rendering, Core Web Vitals, Technical SEO, On-Page SEO, Content Quality, Accessibility, Local SEO signals, Schema detection, Broken links, Internal linking overview.'
    case 'standard':
      return 'Everything in Starter + Larger crawl (up to 20 pages), Advanced Local SEO, Full Schema Validation, Mobile Responsiveness, Thin Content Detection, Keyword Extraction (NLP), Readability Diagnostics, Security Checks, Platform Detection, Automated Fix Recommendations.'
    case 'professional':
      return 'Everything in Standard + Deep crawl (up to 50 pages), Multi-level Internal Link Mapping, Crawl Diagnostics, Enhanced Accessibility, Full Keyword Opportunity Mapping, Content Structure Map, JS/CSS Payload Analysis, Core Web Vitals Opportunity Report, Priority Fix Action Plan.'
    case 'agency':
      return 'Everything in Professional + Large crawl (up to 200 pages), 3 Competitor Crawls + Keyword Gap Analysis, Full Local SEO Suite, Social Signals Audit, JS Rendering Diagnostics, Full Internal Link Graph, Crawl Error Exclusion, Duplicate URL Cleaning, Blank Report included (free).'
    default:
      return ''
  }
}

/**
 * Get add-ons list for PDF
 */
function getAddOnsList(addOns: any, tier?: string): string {
  const items: string[] = []
  
  // New add-ons structure
  if (addOns.additionalDays && typeof addOns.additionalDays === 'number' && addOns.additionalDays > 0) {
    // Legacy Fast Delivery support (backward compatibility only)
    let pricePerDay = 0
    if (tier === 'standard') pricePerDay = 10
    else if (tier === 'professional') pricePerDay = 15
    else if (tier === 'agency') pricePerDay = 20
    // Only show if price is available (not for Starter tier)
    if (pricePerDay > 0) {
      const totalPrice = pricePerDay * addOns.additionalDays
      // Use &#36; to escape dollar signs and prevent LaTeX interpretation
      items.push(`Fast Delivery (${addOns.additionalDays} ${addOns.additionalDays === 1 ? 'day' : 'days'}) - +&#36;${totalPrice}.00`)
    }
  }
  
  if (addOns.competitorAnalysis) {
    // Use &#36; to escape dollar signs
    items.push('Competitor Keyword Gap Report - +&#36;15.00')
  }
  
  // New add-ons
  if (addOns.blankReport) {
    if (tier === 'agency') {
      items.push('Blank Report (Unbranded) - Included')
    } else {
      items.push('Blank Report (Unbranded) - +&#36;10.00')
    }
  }
  if (addOns.schemaDeepDive) {
    items.push('Schema Deep-Dive Analysis - +&#36;15.00')
  }
  if (addOns.additionalCompetitors && typeof addOns.additionalCompetitors === 'number' && addOns.additionalCompetitors > 0) {
    const totalPrice = 10 * addOns.additionalCompetitors
    items.push(`Additional Competitors (${addOns.additionalCompetitors} ${addOns.additionalCompetitors === 1 ? 'competitor' : 'competitors'}) - +&#36;${totalPrice}.00`)
  }
  if (addOns.extraCrawlDepth) {
    items.push('Extra Crawl Depth - +&#36;15.00')
  }
  
  // Legacy add-ons (for backward compatibility with old audits)
  if (addOns.fastDelivery) {
    // Legacy Fast Delivery pricing (backward compatibility only)
    let price = 0
    if (tier === 'standard') price = 10
    else if (tier === 'professional') price = 15
    else if (tier === 'agency') price = 20
    if (price > 0) {
      items.push(`Fast Delivery - +&#36;${price}.00`)
    } else {
      items.push('Fast Delivery - Included')
    }
  }
  if (addOns.additionalPages && typeof addOns.additionalPages === 'number' && addOns.additionalPages > 0) {
    const totalPrice = 5 * addOns.additionalPages
    items.push(`Additional Pages (${addOns.additionalPages} ${addOns.additionalPages === 1 ? '50-page block' : '50-page blocks'}) - +&#36;${totalPrice}.00`)
  }
  if (addOns.additionalKeywords && typeof addOns.additionalKeywords === 'number' && addOns.additionalKeywords > 0) {
    const totalPrice = 1 * addOns.additionalKeywords
    items.push(`Additional Keywords (${addOns.additionalKeywords} ${addOns.additionalKeywords === 1 ? 'keyword' : 'keywords'}) - +&#36;${totalPrice}.00`)
  }
  if (addOns.imageAltTags) items.push('Image Alt Tags Optimization - +&#36;15.00')
  if (addOns.schemaMarkup) items.push('Schema Markup Analysis - +&#36;15.00')
  
  // Items already contain escaped HTML entities, so don't escape again
  return items.map(item => `<li>${item}</li>`).join('')
}

/**
 * Generate score dials (circular progress indicators) - Agency tier visual
 */
function generateScoreDials(summary: AuditResult['summary']): string {
  const scores = [
    { label: 'Overall', value: summary.overallScore, color: '#3b82f6' },
    { label: 'Technical', value: summary.technicalScore, color: '#ef4444' },
    { label: 'On-Page', value: summary.onPageScore, color: '#f59e0b' },
    { label: 'Content', value: summary.contentScore, color: '#10b981' },
    { label: 'Accessibility', value: summary.accessibilityScore, color: '#8b5cf6' }
  ]
  
  let html = '<div style="display: flex; flex-wrap: wrap; justify-content: space-around; margin: 30px 0; gap: 20px;">'
  
  scores.forEach(score => {
    const percentage = score.value
    const circumference = 2 * Math.PI * 45 // radius = 45
    const offset = circumference - (percentage / 100) * circumference
    const color = percentage >= 70 ? '#10b981' : percentage >= 40 ? '#f59e0b' : '#ef4444'
    
    html += `
      <div style="text-align: center; width: 120px;">
        <svg width="120" height="120" style="transform: rotate(-90deg);">
          <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" stroke-width="8"/>
          <circle cx="60" cy="60" r="45" fill="none" stroke="${color}" stroke-width="8"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" style="transition: stroke-dashoffset 0.5s;"/>
        </svg>
        <div style="margin-top: -90px; font-size: 24px; font-weight: bold; color: ${color};">
          ${score.value}
        </div>
        <div style="margin-top: 5px; font-size: 12px; color: #666; font-weight: bold;">
          ${score.label}
        </div>
      </div>
    `
  })
  
  html += '</div>'
  return html
}

/**
 * Generate issue distribution chart - Agency tier visual
 */
/**
 * Generate Quick Wins / TL;DR summary (client-friendly, non-technical)
 */
function generateQuickWinsSummary(result: AuditResult): string {
  const { summary, technicalIssues = [], onPageIssues = [], contentIssues = [], accessibilityIssues = [] } = result
  
  // Get top 5 high-priority issues
  const allHighPriority = [
    ...(technicalIssues || []).filter(i => i.severity === 'High'),
    ...(onPageIssues || []).filter(i => i.severity === 'High'),
    ...(contentIssues || []).filter(i => i.severity === 'High'),
    ...(accessibilityIssues || []).filter(i => i.severity === 'High')
  ].slice(0, 5)
  
  // If we don't have 5 high-priority, add medium-priority
  const allMediumPriority = [
    ...(technicalIssues || []).filter(i => i.severity === 'Medium'),
    ...(onPageIssues || []).filter(i => i.severity === 'Medium'),
    ...(contentIssues || []).filter(i => i.severity === 'Medium'),
    ...(accessibilityIssues || []).filter(i => i.severity === 'Medium')
  ]
  
  const top5 = allHighPriority.length >= 5 
    ? allHighPriority.slice(0, 5)
    : [...allHighPriority, ...allMediumPriority].slice(0, 5)
  
  if (top5.length === 0) {
    return `
    <div style="padding: 20px; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px;">
      <p style="margin: 0; font-weight: bold; color: #10b981;">✅ Great News!</p>
      <p style="margin: 8px 0 0 0; color: #666;">
        Your site has no critical issues that need immediate attention. Focus on the medium and low-priority items to further optimize your SEO performance.
      </p>
    </div>
    `
  }
  
  let html = '<ol style="padding-left: 20px; line-height: 1.8;">'
  
  top5.forEach((issue, idx) => {
    const affectedCount = issue.affectedPages?.length || 0
    const affectedText = affectedCount > 0 ? ` (${affectedCount} ${affectedCount === 1 ? 'page' : 'pages'})` : ''
    
    // Add contextual note about whether this is "normal" for certain site types
    const contextualNote = getContextualNote(issue, result)
    
    html += `
    <li style="margin-bottom: 20px; padding: 15px; background: ${idx < 2 ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${idx < 2 ? '#dc2626' : '#f59e0b'}; border-radius: 6px;">
      <div style="font-weight: bold; font-size: 16px; color: #1f2937; margin-bottom: 8px;">
        ${escapeHtml(issue.message)}${affectedText}
      </div>
      <div style="color: #4b5563; font-size: 14px; margin-bottom: 8px;">
        ${escapeHtml(issue.details || 'No additional details available.')}
      </div>
      ${contextualNote ? `
      <div style="margin-top: 8px; padding: 8px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 4px; font-size: 12px; color: #1e40af;">
        <strong>💡 Context:</strong> ${contextualNote}
      </div>
      ` : ''}
      <div style="margin-top: 10px; font-size: 13px; color: #059669;">
        <strong>Quick Fix:</strong> ${escapeHtml(getFixInstructions(issue).split('\n')[0] || 'See detailed instructions in the Priority Action Plan section.')}
      </div>
    </li>
    `
  })
  
  html += '</ol>'
  
  return html
}

/**
 * Get contextual note about whether an issue is "normal" for certain site types
 */
function getContextualNote(issue: Issue, result: AuditResult): string | null {
  const msg = issue.message.toLowerCase()
  const { serverTechnology, pages } = result
  
  // JavaScript-rendered content issues
  if (msg.includes('javascript') || msg.includes('rendered') || msg.includes('h1') && msg.includes('js')) {
    const isModernFramework = serverTechnology?.framework && ['Next.js', 'React', 'Vue.js', 'Angular'].includes(serverTechnology.framework)
    if (isModernFramework) {
      return `This is common with modern JavaScript frameworks like ${serverTechnology.framework}. While search engines can render JS, it's still better to server-side render critical content like H1s for faster indexing.`
    }
    return `This is increasingly common with modern websites that use client-side rendering. Search engines can handle it, but server-side rendering (SSR) or static generation is still recommended for critical content.`
  }
  
  // Compression issues
  if (msg.includes('compression') || msg.includes('gzip') || msg.includes('brotli')) {
    return `This is a standard server configuration issue. Most hosting providers (WordPress, Shopify, etc.) enable compression by default, but custom servers or some platforms require manual setup.`
  }
  
  // Missing alt tags
  if (msg.includes('alt') || msg.includes('image')) {
    const imageHeavyPages = pages.filter(p => (p.imageCount || 0) > 10).length
    if (imageHeavyPages > 5) {
      return `Image-heavy sites (portfolios, galleries, e-commerce) often have this issue. It's worth fixing for both SEO and accessibility compliance.`
    }
  }
  
  // Thin content
  if (msg.includes('thin') || msg.includes('word count') || msg.includes('content')) {
    const thinPages = pages.filter(p => (p.wordCount || 0) < 300).length
    if (thinPages > pages.length * 0.5) {
      return `Many modern websites (especially SaaS, portfolios, or landing pages) have thin content. This is normal for certain page types, but consider adding more context for better SEO.`
    }
  }
  
  // Missing schema
  if (msg.includes('schema') || msg.includes('structured data')) {
    return `Many sites don't use schema markup, but it's becoming increasingly important for rich results in search. It's a quick win that can improve click-through rates.`
  }
  
  // Duplicate titles/meta
  if (msg.includes('duplicate')) {
    return `This often happens with template-based sites (WordPress themes, page builders) where multiple pages share similar content. Easy to fix with unique titles.`
  }
  
  return null
}

/**
 * Generate score comparison chart (bar chart showing all category scores)
 */
function generateScoreComparisonChart(summary: AuditResult['summary']): string {
  const scores = [
    { name: 'Technical', value: summary.technicalScore, color: '#3b82f6' },
    { name: 'On-Page', value: summary.onPageScore, color: '#10b981' },
    { name: 'Content', value: summary.contentScore, color: '#f59e0b' },
    { name: 'Accessibility', value: summary.accessibilityScore, color: '#8b5cf6' }
  ]
  
  const maxHeight = 200 // Maximum bar height in pixels
  const maxScore = 100
  
  return `
    <div style="margin: 30px 0; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin-bottom: 15px; color: #333;">Category Score Comparison</h3>
      <div style="display: flex; align-items: flex-end; height: ${maxHeight + 60}px; gap: 15px; margin-bottom: 15px;">
        ${scores.map(score => {
          const barHeight = (score.value / maxScore) * maxHeight
          const scoreColor = score.value >= 80 ? '#10b981' : score.value >= 60 ? '#f59e0b' : '#ef4444'
          
          return `
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
            <div style="width: 100%; background: ${scoreColor}; height: ${barHeight}px; border-radius: 4px 4px 0 0; margin-bottom: 5px; position: relative;">
              <div style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); font-size: 14px; font-weight: bold; color: #1f2937; white-space: nowrap;">
                ${score.value}
              </div>
            </div>
            <div style="font-size: 12px; font-weight: bold; color: #4b5563; margin-top: 5px; text-align: center;">
              ${score.name}
            </div>
          </div>
          `
        }).join('')}
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #6b7280; margin-top: 10px;">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </div>
  `
}

/**
 * Generate simple fix order (one-page summary)
 */
function generateSimpleFixOrder(result: AuditResult): string {
  const { summary, technicalIssues = [], onPageIssues = [], contentIssues = [], accessibilityIssues = [] } = result
  
  // Get top issues by priority
  const allHigh = [
    ...(technicalIssues || []).filter(i => i.severity === 'High'),
    ...(onPageIssues || []).filter(i => i.severity === 'High'),
    ...(contentIssues || []).filter(i => i.severity === 'High'),
    ...(accessibilityIssues || []).filter(i => i.severity === 'High')
  ].slice(0, 5)
  
  const allMedium = [
    ...(technicalIssues || []).filter(i => i.severity === 'Medium'),
    ...(onPageIssues || []).filter(i => i.severity === 'Medium'),
    ...(contentIssues || []).filter(i => i.severity === 'Medium'),
    ...(accessibilityIssues || []).filter(i => i.severity === 'Medium')
  ].slice(0, 5)
  
  let html = '<div style="line-height: 1.8;">'
  
  if (allHigh.length > 0) {
    html += `
    <div style="margin-bottom: 30px; padding: 20px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px;">
      <h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 20px;">Week 1: High Priority (${allHigh.length} issues)</h2>
      <ol style="margin: 0; padding-left: 20px; color: #374151;">
        ${allHigh.map(issue => {
          const affected = issue.affectedPages?.length || 0
          const affectedText = affected > 0 ? ` <span style="color: #6b7280;">(${affected} ${affected === 1 ? 'page' : 'pages'})</span>` : ''
          return `<li style="margin-bottom: 10px;"><strong>${escapeHtml(issue.message)}</strong>${affectedText}</li>`
        }).join('')}
      </ol>
    </div>
    `
  }
  
  if (allMedium.length > 0) {
    html += `
    <div style="margin-bottom: 30px; padding: 20px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 8px;">
      <h2 style="color: #d97706; margin: 0 0 15px 0; font-size: 20px;">Week 2: Medium Priority (${allMedium.length} issues)</h2>
      <ol style="margin: 0; padding-left: 20px; color: #374151;">
        ${allMedium.map(issue => {
          const affected = issue.affectedPages?.length || 0
          const affectedText = affected > 0 ? ` <span style="color: #6b7280;">(${affected} ${affected === 1 ? 'page' : 'pages'})</span>` : ''
          return `<li style="margin-bottom: 10px;"><strong>${escapeHtml(issue.message)}</strong>${affectedText}</li>`
        }).join('')}
      </ol>
    </div>
    `
  }
  
  if (allHigh.length === 0 && allMedium.length === 0) {
    html += `
    <div style="padding: 20px; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px;">
      <p style="margin: 0; font-weight: bold; color: #10b981;">✅ Great News!</p>
      <p style="margin: 8px 0 0 0; color: #666;">Your site has no critical issues. Focus on the low-priority items to further optimize your SEO performance.</p>
    </div>
    `
  }
  
  html += `
  <div style="margin-top: 30px; padding: 15px; background: #eff6ff; border-radius: 6px;">
    <p style="margin: 0; color: #1e40af; font-size: 14px;">
      <strong>💡 Tip:</strong> See the detailed "Priority Action Plan" section (page 7) for step-by-step fix instructions for each issue.
    </p>
  </div>
  </div>
  `
  
  return html
}

function generateIssueDistributionChart(summary: AuditResult['summary']): string {
  const totalIssues = summary.highSeverityIssues + summary.mediumSeverityIssues + summary.lowSeverityIssues
  if (totalIssues === 0) return ''
  
  const highPercent = (summary.highSeverityIssues / totalIssues) * 100
  const mediumPercent = (summary.mediumSeverityIssues / totalIssues) * 100
  const lowPercent = (summary.lowSeverityIssues / totalIssues) * 100
  
  return `
    <div style="margin-top: 40px; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin-bottom: 15px; color: #333;">Issue Distribution</h3>
      <div style="display: flex; align-items: flex-end; height: 200px; gap: 10px; margin-bottom: 15px;">
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 100%; background: #ef4444; height: ${highPercent * 2}px; border-radius: 4px 4px 0 0; margin-bottom: 5px;"></div>
          <div style="font-size: 12px; font-weight: bold; color: #ef4444;">${summary.highSeverityIssues}</div>
          <div style="font-size: 11px; color: #666; margin-top: 3px;">High</div>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 100%; background: #f59e0b; height: ${mediumPercent * 2}px; border-radius: 4px 4px 0 0; margin-bottom: 5px;"></div>
          <div style="font-size: 12px; font-weight: bold; color: #f59e0b;">${summary.mediumSeverityIssues}</div>
          <div style="font-size: 11px; color: #666; margin-top: 3px;">Medium</div>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
          <div style="width: 100%; background: #6b7280; height: ${lowPercent * 2}px; border-radius: 4px 4px 0 0; margin-bottom: 5px;"></div>
          <div style="font-size: 12px; font-weight: bold; color: #6b7280;">${summary.lowSeverityIssues}</div>
          <div style="font-size: 11px; color: #666; margin-top: 3px;">Low</div>
        </div>
      </div>
    </div>
  `
}

/**
 * Generate Core Web Vitals graph - Agency tier visual
 */
function generateCoreWebVitalsGraph(pages: AuditResult['pages']): string {
  // CRITICAL FIX: ONLY use PageSpeed API data, NOT performanceMetrics
  const pageWithMetrics = pages.find(p => p.pageSpeedData)
  if (!pageWithMetrics) return ''
  
  const pageSpeed = pageWithMetrics.pageSpeedData as any
  const metrics = pageSpeed?.mobile || pageSpeed
  if (!metrics || (!metrics.lcp && !metrics.fcp && metrics.cls === undefined)) return ''
  
  const lcp = metrics.lcp ? Math.min(metrics.lcp, 10000) : 0
  const fcp = metrics.fcp ? Math.min(metrics.fcp, 5000) : 0
  const cls = metrics.cls !== undefined ? Math.min(metrics.cls * 1000, 500) : 0 // Scale CLS for visualization
  const ttfb = metrics.ttfb ? Math.min(metrics.ttfb, 2000) : 0
  
  // Normalize values for bar chart (0-100 scale)
  const lcpNormalized = Math.min(100, (lcp / 4000) * 100)
  const fcpNormalized = Math.min(100, (fcp / 3000) * 100)
  const clsNormalized = Math.min(100, (cls / 250) * 100)
  const ttfbNormalized = Math.min(100, (ttfb / 1800) * 100)
  
  const getColor = (value: number) => value <= 33 ? '#10b981' : value <= 66 ? '#f59e0b' : '#ef4444'
  
  return `
    <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin-bottom: 15px; color: #333;">Core Web Vitals Performance</h3>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="font-size: 13px; font-weight: bold;">LCP (Largest Contentful Paint)</span>
            <span style="font-size: 12px; color: ${getColor(lcpNormalized)};">${lcp}ms</span>
          </div>
          <div style="width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden;">
            <div style="width: ${lcpNormalized}%; height: 100%; background: ${getColor(lcpNormalized)}; transition: width 0.3s;"></div>
          </div>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="font-size: 13px; font-weight: bold;">FCP (First Contentful Paint)</span>
            <span style="font-size: 12px; color: ${getColor(fcpNormalized)};">${fcp}ms</span>
          </div>
          <div style="width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden;">
            <div style="width: ${fcpNormalized}%; height: 100%; background: ${getColor(fcpNormalized)}; transition: width 0.3s;"></div>
          </div>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="font-size: 13px; font-weight: bold;">CLS (Cumulative Layout Shift)</span>
            <span style="font-size: 12px; color: ${getColor(clsNormalized)};">${(metrics.cls || 0).toFixed(3)}</span>
          </div>
          <div style="width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden;">
            <div style="width: ${clsNormalized}%; height: 100%; background: ${getColor(clsNormalized)}; transition: width 0.3s;"></div>
          </div>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="font-size: 13px; font-weight: bold;">TTFB (Time to First Byte)</span>
            <span style="font-size: 12px; color: ${getColor(ttfbNormalized)};">${ttfb}ms</span>
          </div>
          <div style="width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden;">
            <div style="width: ${ttfbNormalized}%; height: 100%; background: ${getColor(ttfbNormalized)}; transition: width 0.3s;"></div>
          </div>
        </div>
      </div>
      <p style="margin-top: 15px; font-size: 11px; color: #666;">
        <strong>Data Source:</strong> Google PageSpeed Insights API | Green: Good | Yellow: Needs Improvement | Red: Poor
      </p>
    </div>
  `
}

/**
 * Generate competitor comparison table - Agency tier visual
 */
function generateCompetitorComparisonTable(result: AuditResult): string {
  if (!result.competitorAnalysis?.competitorCrawls || result.competitorAnalysis.competitorCrawls.length === 0) {
    return ''
  }
  
  const competitors = result.competitorAnalysis.competitorCrawls
  const sitePages = result.summary.totalPages
  const crawlSummary = result.competitorAnalysis.crawlSummary
  const isAgencyTier = result.raw.options.tier === 'agency'
  
  // Calculate site averages for comparison
  const siteAvgWordCount = result.pages.length > 0
    ? result.pages.reduce((sum, p) => sum + p.wordCount, 0) / result.pages.length
    : 0
  
  return `
    <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin-bottom: 15px; color: #333;">${isAgencyTier ? 'Competitor Crawl Summary' : 'Competitor Comparison'}</h3>
      ${crawlSummary ? `
        <div style="background: #eff6ff; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 0 0 8px 0;"><strong>📊 Crawl Statistics:</strong></p>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
            <li><strong>Total Competitors Analyzed:</strong> ${crawlSummary.totalCompetitorsAnalyzed}</li>
            <li><strong>Total Pages Crawled:</strong> ${crawlSummary.totalPagesCrawled}</li>
            <li><strong>Average Pages per Competitor:</strong> ${Math.round(crawlSummary.averagePageCount)}</li>
          </ul>
        </div>
      ` : ''}
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #3b82f6; color: white;">
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Competitor</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Pages</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Keywords</th>
            ${isAgencyTier ? `
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Avg Words</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Schema</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Depth</th>
            ` : ''}
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Your Site</th>
          </tr>
        </thead>
        <tbody>
          ${competitors.map((comp, idx) => {
            const structure = crawlSummary?.siteStructureComparison?.find(s => s.competitor === comp.url)
            const authoritySignals = comp.authoritySignals
            return `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
              <td style="padding: 10px; border: 1px solid #ddd; font-size: 12px;">
                <a href="${comp.url}" style="color: #3b82f6; text-decoration: none;">${escapeHtml(comp.url.replace(/^https?:\/\/(www\.)?/, ''))}</a>
              </td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${comp.pageCount || 1}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${comp.keywords?.length || 0}</td>
              ${isAgencyTier ? `
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${structure?.avgWordCount ? Math.round(structure.avgWordCount) : 'N/A'}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${structure?.schemaTypes?.length || 0}</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${structure?.maxDepth !== undefined ? structure.maxDepth : 'N/A'}</td>
              ` : ''}
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px; font-weight: bold; color: #3b82f6;">${sitePages} pages</td>
            </tr>
          `
          }).join('')}
          ${isAgencyTier ? `
            <tr style="background: #f0f9ff; font-weight: bold;">
              <td style="padding: 10px; border: 1px solid #ddd; font-size: 12px;">Your Site</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${sitePages}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${result.competitorAnalysis.sharedKeywords?.length || 0}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${Math.round(siteAvgWordCount)}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">${result.pages.filter(p => p.hasSchemaMarkup).length}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px;">-</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-size: 12px; color: #3b82f6;">Baseline</td>
            </tr>
          ` : ''}
        </tbody>
      </table>
      ${isAgencyTier && competitors.some(c => c.authoritySignals) ? `
        <div style="margin-top: 20px; padding: 15px; background: #f0fdf4; border-radius: 6px;">
          <h4 style="margin: 0 0 10px 0; color: #166534;">Site Structure Insights</h4>
          ${competitors.map(comp => {
            const signals = comp.authoritySignals
            if (!signals || signals.hubPages === undefined) return ''
            return `
              <div style="margin-bottom: 10px; padding: 10px; background: white; border-radius: 4px;">
                <strong>${escapeHtml(comp.url.replace(/^https?:\/\/(www\.)?/, ''))}:</strong>
                <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 12px;">
                  <li>Hub Pages: ${signals.hubPages || 0}</li>
                  <li>Avg Internal Links: ${signals.avgInternalLinks ? Math.round(signals.avgInternalLinks) : 'N/A'}</li>
                  <li>Max Depth: ${signals.maxDepth || 'N/A'}</li>
                </ul>
              </div>
            `
          }).join('')}
        </div>
      ` : ''}
    </div>
  `
}

/**
 * Generate internal link graph visualization - Agency tier visual
 */
function generateInternalLinkGraphVisualization(result: AuditResult): string {
  if (!result.internalLinkGraph || result.raw.options.tier !== 'agency') {
    return ''
  }
  
  const graph = result.internalLinkGraph
  
  return `
    <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin-bottom: 15px; color: #333;">Internal Link Graph Analysis</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px;">
        <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #ef4444;">
          <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${graph.orphanPages.length}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Orphan Pages</div>
        </div>
        <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${graph.isolatedPages?.length || 0}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Isolated Pages</div>
        </div>
        <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #10b981;">
          <div style="font-size: 24px; font-weight: bold; color: #10b981;">${graph.hubPages.length}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Hub Pages</div>
        </div>
        <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #3b82f6;">
          <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${graph.authorityPages.length}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Authority Pages</div>
        </div>
      </div>
      ${graph.orphanPages.length > 0 ? `
        <div style="margin-top: 20px; padding: 15px; background: #fef2f2; border-radius: 6px; border-left: 4px solid #ef4444;">
          <strong style="color: #dc2626;">⚠️ Orphan Pages Detected:</strong>
          <p style="margin-top: 8px; font-size: 12px; color: #666;">
            ${graph.orphanPages.slice(0, 5).map(url => escapeHtml(url)).join('<br>')}
            ${graph.orphanPages.length > 5 ? `<br>... and ${graph.orphanPages.length - 5} more` : ''}
          </p>
        </div>
      ` : ''}
    </div>
  `
}

/**
 * Generate duplicate URL report (Agency tier)
 */
function generateDuplicateUrlReport(duplicateReport: any): string {
  if (!duplicateReport) return ''
  
  // Handle both old format (duplicates array) and new format (duplicateGroups)
  const duplicateGroups = duplicateReport.duplicateGroups || duplicateReport.duplicates || []
  const totalDuplicates = duplicateReport.totalDuplicates || duplicateGroups.reduce((sum: number, g: any) => sum + (g.duplicates?.length || g.variations?.length || 0), 0)
  const canonicalConflicts = typeof duplicateReport.canonicalConflicts === 'number' 
    ? duplicateReport.canonicalConflicts 
    : (duplicateReport.canonicalConflicts?.length || 0)
  
  if (duplicateGroups.length === 0) {
    return `
      <div style="padding: 20px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
        <p style="margin: 0; font-weight: bold; color: #166534;">✓ No duplicate URLs detected</p>
        <p style="margin: 8px 0 0 0; color: #666;">Your site has proper URL structure with no duplicate variations detected.</p>
      </div>
    `
  }
  
  // Group by type for better organization
  const groupsByType = new Map<string, any[]>()
  duplicateGroups.forEach((group: any) => {
    const type = group.type || 'unknown'
    if (!groupsByType.has(type)) {
      groupsByType.set(type, [])
    }
    groupsByType.get(type)!.push(group)
  })
  
  return `
    <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin-bottom: 15px; color: #333;">Duplicate URL Analysis</h3>
      
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px; border-radius: 6px;">
        <p style="margin: 0 0 8px 0; font-weight: bold; color: #dc2626;">⚠️ Duplicate URL Issues Detected</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px;">
          <li><strong>Total Duplicate Groups:</strong> ${duplicateGroups.length}</li>
          <li><strong>Total Duplicate URLs:</strong> ${totalDuplicates}</li>
          <li><strong>Canonical Conflicts:</strong> ${canonicalConflicts}</li>
        </ul>
      </div>
      
      <h4 style="margin-top: 30px; margin-bottom: 15px;">Duplicate URL Groups by Type</h4>
      
      ${Array.from(groupsByType.entries()).map(([type, groups]) => `
        <div style="margin-bottom: 30px;">
          <h5 style="color: #dc2626; margin-bottom: 10px; text-transform: capitalize; font-size: 14px;">${type.replace(/-/g, ' ')} Variations (${groups.length} group${groups.length !== 1 ? 's' : ''})</h5>
          ${groups.map((group: any) => {
            const duplicates = group.duplicates || group.variations || []
            return `
            <div style="margin-bottom: 15px; padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #ef4444;">
              <p style="margin: 0 0 8px 0;"><strong>Preferred Canonical:</strong> <a href="${group.canonical}" style="color: #3b82f6; word-break: break-all; font-size: 12px;">${escapeHtml(group.canonical)}</a></p>
              <p style="margin: 0 0 8px 0; font-size: 12px;"><strong>Duplicate Variations (${duplicates.length}):</strong></p>
              <ul style="margin: 5px 0 0 0; padding-left: 20px;">
                ${duplicates.map((dup: string) => `
                  <li style="color: #666; font-size: 11px; margin-bottom: 4px;">
                    <a href="${dup}" style="color: #991b1b; word-break: break-all;">${escapeHtml(dup)}</a>
                  </li>
                `).join('')}
              </ul>
              ${group.recommendation ? `
                <div style="margin-top: 10px; padding: 10px; background: #fffbeb; border-radius: 4px;">
                  <p style="margin: 0; font-size: 11px; color: #92400e;"><strong>💡 Recommendation:</strong> ${escapeHtml(group.recommendation)}</p>
                </div>
              ` : ''}
            </div>
          `
          }).join('')}
        </div>
      `).join('')}
      
      ${canonicalConflicts > 0 ? `
        <div style="margin-top: 30px; padding: 15px; background: #fef2f2; border-radius: 6px; border-left: 4px solid #ef4444;">
          <h4 style="margin: 0 0 10px 0; color: #dc2626;">Canonical Tag Conflicts</h4>
          <p style="margin: 0; font-size: 13px; color: #666;">
            Found ${canonicalConflicts} page(s) with canonical tags that conflict with recommended canonicals. 
            Review and update canonical tags to point to the preferred URL format.
          </p>
        </div>
      ` : ''}
      
      <div style="margin-top: 30px; padding: 15px; background: #f0f9ff; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: #3b82f6;">How to Fix Duplicate URLs</h4>
        <ol style="margin: 0; padding-left: 20px; font-size: 13px;">
          <li style="margin-bottom: 8px;">Choose one preferred URL format (HTTPS, with/without www, with/without trailing slash)</li>
          <li style="margin-bottom: 8px;">Add canonical tags to all duplicate variations pointing to the preferred URL</li>
          <li style="margin-bottom: 8px;">Set up 301 redirects from duplicate URLs to the preferred URL</li>
          <li style="margin-bottom: 8px;">Update internal links to use the preferred URL format consistently</li>
          <li style="margin-bottom: 8px;">Submit the preferred URLs to Google Search Console</li>
        </ol>
      </div>
    </div>
  `
}

/**
 * Generate JS rendering diagnostics (Agency tier)
 */
function generateJSRenderingDiagnostics(pages: any[]): string {
  const pagesWithDiagnostics = pages.filter(p => (p.llmReadability as any)?.hydrationIssues || (p.llmReadability as any)?.scriptBundleAnalysis)
  
  if (pagesWithDiagnostics.length === 0) {
    return '<p>No JS rendering diagnostics available.</p>'
  }
  
  return `
    <div style="margin-top: 30px;">
      ${pagesWithDiagnostics.slice(0, 5).map(page => {
        const llm = page.llmReadability as any
        const hydration = llm?.hydrationIssues
        const scripts = llm?.scriptBundleAnalysis
        const shadow = llm?.shadowDOMAnalysis
        
        return `
          <div style="margin-bottom: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
            <h3 style="margin-bottom: 15px; color: #333;">${escapeHtml(page.url)}</h3>
            
            ${hydration ? `
              <div style="margin-bottom: 15px;">
                <h4 style="color: #3b82f6; margin-bottom: 8px;">Hydration Analysis</h4>
                <ul style="padding-left: 20px; font-size: 12px;">
                  <li>Hydration Mismatch: ${hydration.hasHydrationMismatch ? '⚠️ Yes' : '✓ No'}</li>
                  <li>Missing Content (JS Disabled): ${hydration.missingContentWithJSDisabled ? '⚠️ Yes' : '✓ No'}</li>
                  ${hydration.criticalContentMissing && hydration.criticalContentMissing.length > 0 ? `
                    <li>Critical Missing: ${hydration.criticalContentMissing.join(', ')}</li>
                  ` : ''}
                </ul>
              </div>
            ` : ''}
            
            ${scripts ? `
              <div style="margin-bottom: 15px;">
                <h4 style="color: #3b82f6; margin-bottom: 8px;">Script Bundle Analysis</h4>
                <ul style="padding-left: 20px; font-size: 12px;">
                  <li>Total Script Size: ${(scripts.totalScriptSize / 1024).toFixed(2)} KB</li>
                  <li>Large Bundles: ${scripts.largeBundles?.length || 0}</li>
                  <li>Render-Blocking Scripts: ${scripts.renderBlockingScripts || 0}</li>
                  ${scripts.recommendations && scripts.recommendations.length > 0 ? `
                    <li>Recommendations: ${scripts.recommendations.join('; ')}</li>
                  ` : ''}
                </ul>
              </div>
            ` : ''}
            
            ${shadow ? `
              <div style="margin-bottom: 15px;">
                <h4 style="color: #3b82f6; margin-bottom: 8px;">Shadow DOM Analysis</h4>
                <ul style="padding-left: 20px; font-size: 12px;">
                  <li>Has Shadow DOM: ${shadow.hasShadowDOM ? '⚠️ Yes' : '✓ No'}</li>
                  <li>Shadow Roots: ${shadow.shadowRootCount || 0}</li>
                  ${shadow.recommendations && shadow.recommendations.length > 0 ? `
                    <li>Recommendations: ${shadow.recommendations.join('; ')}</li>
                  ` : ''}
                </ul>
              </div>
            ` : ''}
          </div>
        `
      }).join('')}
    </div>
  `
}

/**
 * Generate crawl diagnostics display (Agency tier)
 */
function generateCrawlDiagnosticsDisplay(diagnostics: any): string {
  if (!diagnostics.crawlMetrics) {
    return '<p>No crawl metrics available.</p>'
  }
  
  const metrics = diagnostics.crawlMetrics
  
  return `
    <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin-bottom: 15px; color: #333;">Crawl Performance Metrics</h3>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px;">
        <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #3b82f6;">
          <div style="font-size: 18px; font-weight: bold; color: #3b82f6;">${(metrics.timeToCrawl / 1000).toFixed(1)}s</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Total Crawl Time</div>
        </div>
        <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #10b981;">
          <div style="font-size: 18px; font-weight: bold; color: #10b981;">${metrics.pagesPerSecond.toFixed(2)}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Pages/Second</div>
        </div>
        <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <div style="font-size: 18px; font-weight: bold; color: #f59e0b;">${metrics.averagePageLoadTime}ms</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Avg Page Load Time</div>
        </div>
        <div style="padding: 15px; background: white; border-radius: 6px; border-left: 4px solid ${metrics.queueHealth === 'healthy' ? '#10b981' : metrics.queueHealth === 'degraded' ? '#f59e0b' : '#ef4444'};">
          <div style="font-size: 18px; font-weight: bold; color: ${metrics.queueHealth === 'healthy' ? '#10b981' : metrics.queueHealth === 'degraded' ? '#f59e0b' : '#ef4444'};">
            ${metrics.queueHealth.charAt(0).toUpperCase() + metrics.queueHealth.slice(1)}
          </div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">Queue Health</div>
        </div>
      </div>
      
      <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 6px;">
        <h4 style="margin-bottom: 10px; color: #333;">Crawl Efficiency: ${metrics.crawlEfficiency}%</h4>
        <div style="width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden;">
          <div style="width: ${metrics.crawlEfficiency}%; height: 100%; background: ${metrics.crawlEfficiency >= 70 ? '#10b981' : metrics.crawlEfficiency >= 40 ? '#f59e0b' : '#ef4444'}; transition: width 0.3s;"></div>
        </div>
      </div>
      
      ${metrics.disallowedPaths && metrics.disallowedPaths.length > 0 ? `
        <div style="margin-top: 20px;">
          <h4 style="margin-bottom: 10px; color: #333;">Disallowed Paths (robots.txt):</h4>
          <ul style="padding-left: 20px; font-size: 12px;">
            ${metrics.disallowedPaths.slice(0, 10).map((path: string) => `<li>${escapeHtml(path)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `
}

/**
 * Generate enhanced local SEO display (Agency tier)
 */
function generateEnhancedLocalSEODisplay(localSEO: any): string {
  if (!localSEO) return ''
  
  return `
    <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <h3 style="margin-bottom: 15px; color: #333;">Local SEO Score: ${localSEO.overallScore}/100</h3>
      
      ${localSEO.napConsistency ? `
        <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 6px;">
          <h4 style="color: #3b82f6; margin-bottom: 10px;">NAP Consistency</h4>
          <p style="font-size: 12px; margin-bottom: 5px;"><strong>Consistency Score:</strong> ${localSEO.napConsistency.consistencyScore}/100</p>
          <p style="font-size: 12px; margin-bottom: 5px;"><strong>Phone Variations:</strong> ${localSEO.napConsistency.phoneVariations?.length || 0}</p>
          <p style="font-size: 12px; margin-bottom: 5px;"><strong>Address Variations:</strong> ${localSEO.napConsistency.addressVariations?.length || 0}</p>
          ${localSEO.napConsistency.inconsistentPages && localSEO.napConsistency.inconsistentPages.length > 0 ? `
            <p style="font-size: 12px; color: #ef4444; margin-top: 10px;">
              <strong>Inconsistent Pages:</strong> ${localSEO.napConsistency.inconsistentPages.slice(0, 5).map((url: string) => escapeHtml(url)).join(', ')}
            </p>
          ` : ''}
        </div>
      ` : ''}
      
      ${localSEO.citations && localSEO.citations.length > 0 ? `
        <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 6px;">
          <h4 style="color: #3b82f6; margin-bottom: 10px;">Local Citations</h4>
          <ul style="padding-left: 20px; font-size: 12px;">
            ${localSEO.citations.map((citation: any) => `
              <li>
                <strong>${citation.platform}:</strong> 
                ${citation.isConsistent ? '✓ Consistent' : '⚠️ Inconsistent'}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${localSEO.gbpIndicators ? `
        <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 6px;">
          <h4 style="color: #3b82f6; margin-bottom: 10px;">Google Business Profile Indicators</h4>
          <ul style="padding-left: 20px; font-size: 12px;">
            <li>Google Maps Embed: ${localSEO.gbpIndicators.hasGoogleMapsEmbed ? '✓ Yes' : '✗ No'}</li>
            <li>Google Reviews Widget: ${localSEO.gbpIndicators.hasGoogleReviewsWidget ? '✓ Yes' : '✗ No'}</li>
            <li>GBP Link: ${localSEO.gbpIndicators.hasGBPLink ? '✓ Yes' : '✗ No'}</li>
            <li>Opening Hours: ${localSEO.gbpIndicators.hasOpeningHours ? '✓ Yes' : '✗ No'}</li>
          </ul>
        </div>
      ` : ''}
      
      ${localSEO.schema ? `
        <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 6px;">
          <h4 style="color: #3b82f6; margin-bottom: 10px;">LocalBusiness Schema Completeness</h4>
          <ul style="padding-left: 20px; font-size: 12px;">
            <li>LocalBusiness Schema: ${localSEO.schema.hasLocalBusiness ? '✓ Yes' : '✗ No'}</li>
            <li>Address: ${localSEO.schema.hasAddress ? '✓ Yes' : '✗ No'}</li>
            <li>Phone: ${localSEO.schema.hasPhone ? '✓ Yes' : '✗ No'}</li>
            <li>Geo Coordinates: ${localSEO.schema.hasGeo ? '✓ Yes' : '✗ No'} ${localSEO.schema.geoCoordinates ? `(${localSEO.schema.geoCoordinates.latitude}, ${localSEO.schema.geoCoordinates.longitude})` : ''}</li>
            <li>Opening Hours: ${localSEO.schema.hasOpeningHours ? '✓ Yes' : '✗ No'}</li>
            <li>Review Markup: ${localSEO.schema.hasReviewMarkup ? '✓ Yes' : '✗ No'} ${localSEO.schema.reviewCount ? `(${localSEO.schema.reviewCount} review${localSEO.schema.reviewCount > 1 ? 's' : ''})` : ''} ${localSEO.schema.reviewRating ? `(${localSEO.schema.reviewRating.toFixed(1)}★)` : ''}</li>
            <li>Driving Directions: ${localSEO.schema.hasDrivingDirections ? '✓ Yes' : '✗ No'}</li>
            <li>Price Range: ${localSEO.schema.hasPriceRange ? '✓ Yes' : '✗ No'}</li>
          </ul>
          ${localSEO.schema.missingFields && localSEO.schema.missingFields.length > 0 ? `
            <div style="margin-top: 10px; padding: 10px; background: #fef2f2; border-radius: 4px;">
              <strong style="font-size: 12px; color: #dc2626;">Missing Fields:</strong>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #666;">${escapeHtml(localSEO.schema.missingFields.join(', '))}</p>
            </div>
          ` : ''}
          ${localSEO.schema.openingHoursSchema && localSEO.schema.openingHoursSchema.length > 0 ? `
            <div style="margin-top: 10px; padding: 10px; background: #f0fdf4; border-radius: 4px;">
              <strong style="font-size: 12px; color: #166534;">Opening Hours Schema:</strong>
              <ul style="margin: 5px 0 0 0; padding-left: 20px; font-size: 11px; color: #666;">
                ${localSEO.schema.openingHoursSchema.map((hours: string) => `<li>${escapeHtml(hours)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      ` : ''}
      
      ${localSEO.serviceAreaPages && localSEO.serviceAreaPages.length > 0 ? `
        <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 6px;">
          <h4 style="color: #3b82f6; margin-bottom: 10px;">City/Service-Area Landing Pages (${localSEO.serviceAreaPages.length})</h4>
          <ul style="padding-left: 20px; font-size: 12px;">
            ${localSEO.serviceAreaPages.slice(0, 10).map((page: any) => `
              <li>
                <a href="${escapeHtml(page.url)}" style="color: #3b82f6;">${escapeHtml(page.title || page.url)}</a>
                ${page.city ? ` - ${escapeHtml(page.city)}` : ''}
                ${page.service ? ` (${escapeHtml(page.service)})` : ''}
                ${page.wordCount ? ` - ${page.wordCount} words` : ''}
              </li>
            `).join('')}
            ${localSEO.serviceAreaPages.length > 10 ? `<li>... and ${localSEO.serviceAreaPages.length - 10} more pages</li>` : ''}
          </ul>
        </div>
      ` : ''}
      
      ${localSEO.keywords ? `
        <div style="margin-bottom: 20px; padding: 15px; background: white; border-radius: 6px;">
          <h4 style="color: #3b82f6; margin-bottom: 10px;">Local Keywords</h4>
          <p style="font-size: 12px; margin-bottom: 5px;"><strong>Location Keywords:</strong> ${localSEO.keywords.hasLocationKeywords ? '✓ Yes' : '✗ No'}</p>
          <p style="font-size: 12px; margin-bottom: 5px;"><strong>Service Keywords:</strong> ${localSEO.keywords.hasServiceKeywords ? '✓ Yes' : '✗ No'}</p>
          ${localSEO.keywords.detectedLocations && localSEO.keywords.detectedLocations.length > 0 ? `
            <p style="font-size: 12px; margin-bottom: 5px;"><strong>Detected Locations:</strong> ${escapeHtml(localSEO.keywords.detectedLocations.slice(0, 10).join(', '))}${localSEO.keywords.detectedLocations.length > 10 ? ` (and ${localSEO.keywords.detectedLocations.length - 10} more)` : ''}</p>
          ` : ''}
          ${localSEO.keywords.detectedServices && localSEO.keywords.detectedServices.length > 0 ? `
            <p style="font-size: 12px; margin-bottom: 5px;"><strong>Detected Services:</strong> ${escapeHtml(localSEO.keywords.detectedServices.slice(0, 10).join(', '))}${localSEO.keywords.detectedServices.length > 10 ? ` (and ${localSEO.keywords.detectedServices.length - 10} more)` : ''}</p>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `
}

/**
 * Generate page-level issue mapping (Agency tier)
 * Shows per-page breakdown of all issues affecting each page
 */
function generatePageLevelIssueMapping(result: AuditResult): string {
  // Build a map of page URL -> issues affecting that page
  const pageIssueMap = new Map<string, Array<{ issue: any; severity: string }>>()
  
  // Initialize map with all pages
  result.pages.forEach(page => {
    pageIssueMap.set(page.url, [])
  })
  
  // Map issues to pages - collect all issues from categorized sections
  const allIssues = [
    ...(result.technicalIssues || []),
    ...(result.onPageIssues || []),
    ...(result.contentIssues || []),
    ...(result.accessibilityIssues || [])
  ]
  
  allIssues.forEach(issue => {
    if (issue.affectedPages && issue.affectedPages.length > 0) {
      issue.affectedPages.forEach(pageUrl => {
        const existing = pageIssueMap.get(pageUrl) || []
        existing.push({ issue, severity: issue.severity })
        pageIssueMap.set(pageUrl, existing)
      })
    } else {
      // Site-wide issue - affects all pages
      result.pages.forEach(page => {
        const existing = pageIssueMap.get(page.url) || []
        existing.push({ issue, severity: issue.severity })
        pageIssueMap.set(page.url, existing)
      })
    }
  })
  
  // Calculate page scores
  const pageScores = new Map<string, { score: number; highIssues: number; mediumIssues: number; lowIssues: number }>()
  
  pageIssueMap.forEach((issues, pageUrl) => {
    let score = 100
    let highIssues = 0
    let mediumIssues = 0
    let lowIssues = 0
    
    issues.forEach(({ issue, severity }) => {
      if (severity === 'High') {
        score -= 10
        highIssues++
      } else if (severity === 'Medium') {
        score -= 5
        mediumIssues++
      } else {
        score -= 2
        lowIssues++
      }
    })
    
    pageScores.set(pageUrl, {
      score: Math.max(0, Math.min(100, score)),
      highIssues,
      mediumIssues,
      lowIssues
    })
  })
  
  // Sort pages by issue count (most issues first)
  const pagesWithIssues = result.pages
    .map(page => ({
      page,
      issueCount: (pageIssueMap.get(page.url) || []).length,
      score: pageScores.get(page.url) || { score: 100, highIssues: 0, mediumIssues: 0, lowIssues: 0 }
    }))
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 20) // Show top 20 pages with most issues
  
  return `
    <div style="margin-top: 20px;">
      ${pagesWithIssues.map(({ page, issueCount, score }) => {
        const issues = pageIssueMap.get(page.url) || []
        const scoreColor = score.score >= 80 ? '#10b981' : score.score >= 60 ? '#f59e0b' : '#ef4444'
        
        return `
          <div style="margin-bottom: 25px; padding: 15px; background: #f9fafb; border-radius: 6px; border-left: 4px solid ${scoreColor};">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
              <div style="flex: 1;">
                <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #333;">
                  <a href="${page.url}" style="color: #3b82f6; text-decoration: none; word-break: break-all;">${escapeHtml(page.url)}</a>
                </h3>
                <p style="margin: 0; font-size: 11px; color: #666;">
                  ${page.title ? escapeHtml(page.title.substring(0, 80)) + (page.title.length > 80 ? '...' : '') : 'No title'}
                </p>
              </div>
              <div style="text-align: right; margin-left: 15px;">
                <div style="font-size: 20px; font-weight: bold; color: ${scoreColor};">
                  ${score.score}/100
                </div>
                <div style="font-size: 10px; color: #666;">Page Score</div>
              </div>
            </div>
            
            <div style="display: flex; gap: 15px; margin-bottom: 15px; font-size: 11px;">
              <div>
                <strong style="color: #ef4444;">High:</strong> ${score.highIssues}
              </div>
              <div>
                <strong style="color: #f59e0b;">Medium:</strong> ${score.mediumIssues}
              </div>
              <div>
                <strong style="color: #10b981;">Low:</strong> ${score.lowIssues}
              </div>
              <div>
                <strong>Total Issues:</strong> ${issueCount}
              </div>
            </div>
            
            ${issues.length > 0 ? `
              <div style="margin-top: 10px;">
                <strong style="font-size: 12px; color: #333;">Issues Affecting This Page:</strong>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 11px;">
                  ${issues.map(({ issue, severity }) => {
                    const severityColor = severity === 'High' ? '#ef4444' : severity === 'Medium' ? '#f59e0b' : '#10b981'
                    return `
                      <li style="margin-bottom: 5px; color: #666;">
                        <span style="color: ${severityColor}; font-weight: bold;">[${severity}]</span> 
                        ${escapeHtml(issue.title || issue.message)}
                        ${issue.category ? ` <span style="color: #999;">(${issue.category})</span>` : ''}
                      </li>
                    `
                  }).join('')}
                </ul>
              </div>
            ` : `
              <div style="margin-top: 10px; padding: 10px; background: #f0fdf4; border-radius: 4px;">
                <p style="margin: 0; font-size: 11px; color: #166534;">✓ No issues detected on this page</p>
              </div>
            `}
          </div>
        `
      }).join('')}
      
      ${result.pages.length > 20 ? `
        <div style="margin-top: 20px; padding: 15px; background: #f0f9ff; border-radius: 6px;">
          <p style="margin: 0; font-size: 12px; color: #666;">
            Showing top 20 pages with most issues. Total pages analyzed: ${result.pages.length}. 
            Full page-level issue mapping available in web interface.
          </p>
        </div>
      ` : ''}
    </div>
  `
}

