/**
 * PDF Report Generation
 * 
 * Generates white-label PDF reports from audit results using Puppeteer
 */

import puppeteer from 'puppeteer'
import { AuditResult } from './types'
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
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  })
  
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    })
    
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
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
      max-width: 200px;
      margin-bottom: 30px;
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
    ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="Logo" class="logo">` : ''}
    <div class="brand-name">${branding.brandName}</div>
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
  
  <!-- Service Details -->
  ${result.raw.options.tier || (result.raw.options.addOns && Object.keys(result.raw.options.addOns).length > 0) ? `
  <div class="page">
    <h1>Service Details</h1>
    ${result.raw.options.tier ? `
    <div style="margin-bottom: 20px;">
      <h2>Service Tier</h2>
      <p><strong>${result.raw.options.tier.charAt(0).toUpperCase() + result.raw.options.tier.slice(1)}</strong> - ${getTierDescription(result.raw.options.tier)}</p>
      ${result.raw.options.addOns?.fastDelivery || result.raw.options.addOns?.additionalPages ? (() => {
        const tier = result.raw.options.tier
        if (tier === 'standard' || tier === 'advanced') {
          const days = result.raw.options.addOns?.additionalPages || 1
          // Escape to prevent LaTeX interpretation
          const daysText = escapeHtml(`${days}-day delivery enabled`)
          return `<p style="color: #f59e0b; font-weight: bold; margin-top: 10px;">⚡ Fast Delivery: ${daysText}</p>`
        }
        return ''
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
  
  <!-- Priority Action Plan -->
  <div class="page">
    <h1>Priority Action Plan</h1>
    <p style="margin-bottom: 20px;">Address issues in this order for maximum SEO impact:</p>
    ${generatePriorityActionPlan(result)}
  </div>
  
  <!-- Scores Overview -->
  <div class="page">
    <h1>SEO Scores Overview</h1>
    <div class="scores-grid">
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
    <p style="margin-top: 30px;">
      <strong>Issue Breakdown:</strong> ${summary.highSeverityIssues} High Priority, 
      ${summary.mediumSeverityIssues} Medium Priority, 
      ${summary.lowSeverityIssues} Low Priority
    </p>
  </div>
  
  <!-- Technical Issues -->
  ${result.technicalIssues.length > 0 ? `
  <div class="page">
    <h1>Technical SEO Issues</h1>
    <div class="issues-section">
      ${result.technicalIssues.slice(0, 20).map(issue => `
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
  ${result.onPageIssues.length > 0 ? `
  <div class="page">
    <h1>On-Page SEO Issues</h1>
    <div class="issues-section">
      ${result.onPageIssues.slice(0, 20).map(issue => `
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
  ${result.contentIssues.length > 0 ? `
  <div class="page">
    <h1>Content Quality Issues</h1>
    <div class="issues-section">
      ${result.contentIssues.slice(0, 20).map(issue => `
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
  ${result.accessibilityIssues.length > 0 ? `
  <div class="page">
    <h1>Accessibility Issues</h1>
    <div class="issues-section">
      ${result.accessibilityIssues.slice(0, 20).map(issue => `
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
    <p style="margin-bottom: 20px;">Performance data from Google PageSpeed Insights and page rendering:</p>
    <div class="issues-section">
      ${result.pages.filter(p => p.pageSpeedData || p.performanceMetrics).slice(0, 10).map(page => {
        // Use PageSpeed data if available (more accurate), otherwise fall back to performanceMetrics
        const pageSpeed = page.pageSpeedData
        const mobile = pageSpeed?.mobile
        const desktop = pageSpeed?.desktop
        const metrics = page.performanceMetrics
        
        // Use mobile metrics (stricter) if PageSpeed available
        const lcp = mobile?.lcp || metrics?.lcp
        const fcp = mobile?.fcp || metrics?.fcp
        const cls = mobile?.cls !== undefined ? mobile.cls : metrics?.cls
        const inp = mobile?.inp || metrics?.fid // INP from PageSpeed, FID from metrics
        const ttfb = mobile?.ttfb || metrics?.ttfb
        const tbt = metrics?.tbt // TBT only from metrics
        
        return `
        <div class="issue-item">
          <div class="issue-title">${page.url}</div>
          <div style="margin-bottom: 15px;">
            ${pageSpeed ? '<div style="color: #059669; font-weight: bold; margin-bottom: 10px;">📊 Data from Google PageSpeed Insights</div>' : '<div style="color: #666; margin-bottom: 10px;">📊 Data from page rendering</div>'}
          </div>
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
                <td style="padding: 8px; font-weight: bold;">${pageSpeed ? 'INP' : 'FID'}: ${Math.round(inp)} ms</td>
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
              ${mobile.opportunities.slice(0, 5).map(opp => {
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
    <p style="margin-bottom: 20px;">Analysis of dynamically rendered content that may be missed by LLMs:</p>
    <div class="issues-section">
      ${result.pages.filter(p => p.llmReadability).slice(0, 10).map(page => {
        const llm = page.llmReadability!
        // Calculate actual percentage (may be higher than displayed cap)
        const actualPercent = ((llm.renderedHtmlLength - llm.initialHtmlLength) / Math.max(llm.initialHtmlLength, 1)) * 100
        const displayPercent = actualPercent >= 10000 ? '10,000%+' : `${llm.renderingPercentage}%`
        return `
        <div class="issue-item ${llm.hasHighRendering ? 'high' : 'low'}" style="margin-bottom: 20px;">
          <div class="issue-title" style="font-size: 14px; margin-bottom: 10px;">${page.url}</div>
          <div class="issue-details" style="font-size: 13px; line-height: 1.8;">
            <strong>Rendering Percentage:</strong> ${displayPercent}<br>
            <strong>Initial HTML:</strong> ${llm.initialHtmlLength.toLocaleString()} characters<br>
            <strong>Rendered HTML:</strong> ${llm.renderedHtmlLength.toLocaleString()} characters
          </div>
          ${llm.hasHighRendering ? `
          <div class="fix-instructions" style="margin-top: 10px;">
            <div class="fix-instructions-title">⚠️ High Rendering Detected</div>
            <div class="fix-instructions-content">Your page has a high level of rendering (changes to the HTML). Dynamically rendering a lot of page content risks some important information being missed by LLMs that generally do not read this content. Consider server-side rendering for critical content.</div>
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
          </div>
        </div>
        `
        
        // Facebook Pixel section
        html += `
        <div class="issue-item ${social.hasFacebookPixel ? 'good' : 'low'}">
          <div class="issue-title">Facebook Pixel</div>
          <div class="issue-details">
            <strong>Status:</strong> ${social.hasFacebookPixel ? '✅ Detected' : '⚠️ Not detected'}
          </div>
        </div>
        `
        
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
    ${result.competitorAnalysis.competitorUrl.startsWith('http') ? `
      <p style="margin-bottom: 20px;"><strong>Competitor Analyzed:</strong> <a href="${result.competitorAnalysis.competitorUrl}" style="color: #3b82f6;">${result.competitorAnalysis.competitorUrl}</a></p>
      <p style="margin-bottom: 20px;">This analysis crawled the competitor site and extracted real keywords from their content, comparing them against your site to identify opportunities.</p>
    ` : `
      <p style="margin-bottom: 20px;">${result.competitorAnalysis.competitorUrl}. This analysis identifies niche-specific keyword opportunities by combining your site's core topics with common SEO patterns used by competitors in your industry.</p>
    `}
    
    <div style="margin-bottom: 30px;">
      <h2>Keyword Gaps (Opportunities)</h2>
      <p style="color: #666; margin-bottom: 15px;">These keywords are commonly used by competitors but missing from your site:</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${result.competitorAnalysis.keywordGaps.map(kw => 
          `<span style="background: #fef2f2; border: 1px solid #fecaca; padding: 6px 12px; border-radius: 4px; font-size: 13px; color: #991b1b;">${escapeHtml(kw)}</span>`
        ).join('')}
      </div>
    </div>
    
    <div style="margin-bottom: 30px;">
      <h2>Shared Keywords</h2>
      <p style="color: #666; margin-bottom: 15px;">Keywords you're already targeting that competitors also use:</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${result.competitorAnalysis.sharedKeywords.map(kw => 
          `<span style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px 12px; border-radius: 4px; font-size: 13px; color: #166534;">${escapeHtml(kw)}</span>`
        ).join('')}
      </div>
    </div>
    
    <div>
      <h2>Competitor Keywords Analyzed</h2>
      <p style="color: #666; margin-bottom: 15px;">Common keywords found in competitor analysis:</p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${result.competitorAnalysis.competitorKeywords.map(kw => 
          `<span style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 4px; font-size: 13px; color: #1e40af;">${escapeHtml(kw)}</span>`
        ).join('')}
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
          const lcpValue = page.performanceMetrics?.lcp || page.pageSpeedData?.mobile?.lcp || page.pageSpeedData?.desktop?.lcp
          const lcpText = lcpValue ? `<br><small style="font-size: 9px;">${escapeHtml(`LCP: ${Math.round(lcpValue)} ms`)}</small>` : ''
          
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
  const { technicalIssues, onPageIssues, contentIssues, accessibilityIssues, performanceIssues } = result
  
  const highPriority = [
    ...technicalIssues.filter(i => i.severity === 'High'),
    ...onPageIssues.filter(i => i.severity === 'High'),
    ...contentIssues.filter(i => i.severity === 'High'),
    ...accessibilityIssues.filter(i => i.severity === 'High'),
    ...performanceIssues.filter(i => i.severity === 'High')
  ]
  
  const mediumPriority = [
    ...technicalIssues.filter(i => i.severity === 'Medium'),
    ...onPageIssues.filter(i => i.severity === 'Medium'),
    ...performanceIssues.filter(i => i.severity === 'Medium'),
    ...contentIssues.filter(i => i.severity === 'Medium'),
    ...accessibilityIssues.filter(i => i.severity === 'Medium')
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
  
  if (highPriority.length === 0 && mediumPriority.length === 0) {
    html += `<p style="color: #10b981; font-weight: bold;">✅ No high or medium priority issues found. Your site is in excellent shape!</p>`
  }
  
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
      return 'Quick scan of 1–3 pages with key SEO issues and fixes.'
    case 'standard':
      return 'Full site audit with technical, on-page, and performance checks.'
    case 'advanced':
      return 'Complete audit plus competitor analysis and action plan.'
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
    // Fast Delivery (Additional Days) pricing: $10 for Standard, $15 for Advanced
    let pricePerDay = 0
    if (tier === 'standard') pricePerDay = 10
    else if (tier === 'advanced') pricePerDay = 15
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
  
  // Legacy add-ons (for backward compatibility with old audits)
  if (addOns.fastDelivery) {
    // Fast Delivery pricing: $10 for Standard, $15 for Advanced
    let price = 0
    if (tier === 'standard') price = 10
    else if (tier === 'advanced') price = 15
    if (price > 0) {
      items.push(`Fast Delivery - +&#36;${price}.00`)
    } else {
      items.push('Fast Delivery - Included')
    }
  }
  if (addOns.additionalPages && typeof addOns.additionalPages === 'number' && addOns.additionalPages > 0) {
    const totalPrice = 5 * addOns.additionalPages
    items.push(`Additional Pages (${addOns.additionalPages} ${addOns.additionalPages === 1 ? 'page' : 'pages'}) - +&#36;${totalPrice}.00`)
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

