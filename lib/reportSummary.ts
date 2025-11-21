/**
 * Client-Facing Summary Builder
 * 
 * Generates human-readable summaries from audit results.
 * Rule-based (no AI) for consistent, professional output.
 */

import { AuditResult } from './types'

/**
 * Generate short summary (~150-250 words) for Upwork delivery
 */
export function generateShortSummary(result: AuditResult): string {
  const { summary, technicalIssues, onPageIssues, contentIssues, accessibilityIssues } = result
  
  const totalIssues = summary.highSeverityIssues + summary.mediumSeverityIssues + summary.lowSeverityIssues
  
  let text = `I've completed a comprehensive SEO audit of your website. `
  
  text += `The audit analyzed ${summary.totalPages} page${summary.totalPages !== 1 ? 's' : ''} and identified ${totalIssues} issue${totalIssues !== 1 ? 's' : ''} across technical, on-page, content, and accessibility categories. `
  
  text += `Your overall SEO score is ${summary.overallScore}/100, with category scores of: Technical (${summary.technicalScore}/100), On-Page (${summary.onPageScore}/100), Content (${summary.contentScore}/100), and Accessibility (${summary.accessibilityScore}/100). `
  
  // Top issues by severity
  const topIssues: string[] = []
  
  if (summary.highSeverityIssues > 0) {
    topIssues.push(`${summary.highSeverityIssues} high-priority issue${summary.highSeverityIssues !== 1 ? 's' : ''}`)
  }
  if (summary.mediumSeverityIssues > 0) {
    topIssues.push(`${summary.mediumSeverityIssues} medium-priority issue${summary.mediumSeverityIssues !== 1 ? 's' : ''}`)
  }
  if (summary.lowSeverityIssues > 0) {
    topIssues.push(`${summary.lowSeverityIssues} low-priority issue${summary.lowSeverityIssues !== 1 ? 's' : ''}`)
  }
  
  if (topIssues.length > 0) {
    text += `Priority breakdown: ${topIssues.join(', ')}. `
  }
  
  // Mention top issue types - prioritize high-priority issues first
  const highPriorityIssues = [
    ...technicalIssues.filter(i => i.severity === 'High'),
    ...onPageIssues.filter(i => i.severity === 'High'),
    ...contentIssues.filter(i => i.severity === 'High'),
    ...accessibilityIssues.filter(i => i.severity === 'High')
  ]
  
  const issueTypes: string[] = []
  
  // Add high-priority issues first (up to 3)
  if (highPriorityIssues.length > 0) {
    const highIssueTypes = highPriorityIssues
      .map(i => normalizeIssueType(i.message))
      .filter((v, i, a) => a.indexOf(v) === i) // unique
      .slice(0, 3)
    issueTypes.push(...highIssueTypes)
  }
  
  // Then add medium-priority issues if we have room
  if (issueTypes.length < 5) {
    const mediumPriorityIssues = [
      ...technicalIssues.filter(i => i.severity === 'Medium'),
      ...onPageIssues.filter(i => i.severity === 'Medium'),
      ...contentIssues.filter(i => i.severity === 'Medium'),
      ...accessibilityIssues.filter(i => i.severity === 'Medium')
    ]
    const mediumIssueTypes = mediumPriorityIssues
      .map(i => normalizeIssueType(i.message))
      .filter((v, i, a) => a.indexOf(v) === i) // unique
      .filter(t => !issueTypes.includes(t)) // don't duplicate
      .slice(0, 5 - issueTypes.length)
    issueTypes.push(...mediumIssueTypes)
  }
  
  if (issueTypes.length > 0) {
    text += `Key areas requiring attention include: ${issueTypes.join(', ')}. `
  }
  
  // Recommendations - dynamically based on actual issues found
  const recommendations: string[] = []
  
  if (highPriorityIssues.length > 0) {
    // Get specific high-priority issue types
    const missingH1 = highPriorityIssues.some(i => i.message.includes('Missing H1') || i.message.includes('missing H1'))
    const missingTitle = highPriorityIssues.some(i => i.message.includes('Missing page title') || i.message.includes('missing title'))
    const missingMeta = highPriorityIssues.some(i => i.message.includes('Missing meta description') || i.message.includes('missing meta'))
    const brokenPages = highPriorityIssues.some(i => i.message.includes('broken') || i.message.includes('error status'))
    const thinContent = highPriorityIssues.some(i => i.message.includes('Thin content') || i.message.includes('thin content'))
    
    if (missingH1) {
      recommendations.push('adding H1 tags to all pages')
    }
    if (missingTitle) {
      recommendations.push('adding page titles to all pages')
    }
    if (missingMeta) {
      recommendations.push('adding meta descriptions to all pages')
    }
    if (brokenPages) {
      recommendations.push('fixing broken pages that return error status codes')
    }
    if (thinContent) {
      recommendations.push('expanding thin content pages to at least 300 words')
    }
    
    // If no specific recommendations, use generic
    if (recommendations.length === 0) {
      const hasHighTech = highPriorityIssues.some(i => i.category === 'Technical')
      const hasHighOnPage = highPriorityIssues.some(i => i.category === 'On-page')
      const hasHighContent = highPriorityIssues.some(i => i.category === 'Content')
      
      if (hasHighOnPage) {
        recommendations.push('fixing critical on-page SEO elements')
      } else if (hasHighTech) {
        recommendations.push('addressing high-priority technical SEO issues')
      } else if (hasHighContent) {
        recommendations.push('improving content quality on affected pages')
      } else {
        recommendations.push('addressing high-priority issues')
      }
    }
  } else {
    // No high-priority issues, focus on medium/low
    const missingTitle = onPageIssues.some(i => i.message.includes('Missing page title'))
    const missingMeta = onPageIssues.some(i => i.message.includes('Missing meta description'))
    const missingH1 = onPageIssues.some(i => i.message.includes('Missing H1'))
    const thinContent = contentIssues.some(i => i.message.includes('Thin content'))
    
    if (missingTitle || missingMeta || missingH1) {
      const missingItems: string[] = []
      if (missingTitle) missingItems.push('titles')
      if (missingMeta) missingItems.push('meta descriptions')
      if (missingH1) missingItems.push('H1 tags')
      recommendations.push(`optimizing on-page elements like ${missingItems.join(' and ')}`)
    } else if (onPageIssues.length > 0) {
      recommendations.push('optimizing on-page SEO elements')
    }
    
    if (thinContent) {
      recommendations.push('expanding thin content pages')
    } else if (contentIssues.length > 0) {
      recommendations.push('improving content quality')
    }
    
    if (technicalIssues.length > 0 && recommendations.length === 0) {
      recommendations.push('enhancing technical SEO elements')
    }
  }
  
  if (recommendations.length > 0) {
    if (recommendations.length === 1) {
      text += `Recommended next steps include ${recommendations[0]}. `
    } else if (recommendations.length === 2) {
      text += `Recommended next steps include ${recommendations[0]} and ${recommendations[1]}. `
    } else {
      text += `Recommended next steps include ${recommendations.slice(0, -1).join(', ')}, and ${recommendations[recommendations.length - 1]}. `
    }
  } else {
    text += `Recommended next steps include continuing to monitor and maintain your current SEO performance. `
  }
  
  text += `A detailed report with specific recommendations for each issue is included in the attached PDF.`
  
  return text
}

/**
 * Generate detailed summary (~400-600 words) for PDF first page
 */
export function generateDetailedSummary(result: AuditResult): string {
  const { summary, technicalIssues, onPageIssues, contentIssues, accessibilityIssues, siteWide } = result
  
  const totalIssues = summary.highSeverityIssues + summary.mediumSeverityIssues + summary.lowSeverityIssues
  
  let text = `Executive Summary\n\n`
  
  text += `This SEO audit examined ${summary.totalPages} page${summary.totalPages !== 1 ? 's' : ''} from your website to assess technical SEO, on-page optimization, content quality, and accessibility. `
  text += `The analysis identified ${totalIssues} issue${totalIssues !== 1 ? 's' : ''} across these categories, with ${summary.highSeverityIssues} high-priority, ${summary.mediumSeverityIssues} medium-priority, and ${summary.lowSeverityIssues} low-priority findings.\n\n`
  
  text += `Overall Performance\n\n`
  text += `Your website received an overall SEO score of ${summary.overallScore}/100. `
  
  if (summary.overallScore >= 80) {
    text += `This indicates strong SEO fundamentals with room for optimization in specific areas. `
  } else if (summary.overallScore >= 60) {
    text += `This suggests moderate SEO performance with several areas requiring improvement. `
  } else {
    text += `This indicates significant SEO issues that should be addressed to improve search visibility. `
  }
  
  text += `Category scores break down as follows:\n\n`
  text += `• Technical SEO: ${summary.technicalScore}/100 - This measures crawlability, site structure, robots.txt, sitemap.xml, and HTTP status codes.\n`
  text += `• On-Page SEO: ${summary.onPageScore}/100 - This evaluates page titles, meta descriptions, heading structure (H1/H2), and canonical tags.\n`
  text += `• Content Quality: ${summary.contentScore}/100 - This assesses word count, content depth, and thin page detection.\n`
  text += `• Accessibility: ${summary.accessibilityScore}/100 - This reviews image alt attributes and mobile responsiveness indicators.\n\n`
  
  text += `Key Findings\n\n`
  
  // Technical findings
  if (technicalIssues.length > 0) {
    const highTech = technicalIssues.filter(i => i.severity === 'High').length
    text += `Technical SEO: ${technicalIssues.length} issue${technicalIssues.length !== 1 ? 's' : ''} found, including ${highTech} high-priority. `
    if (!siteWide.sitemapExists) {
      text += `Notably, no sitemap.xml was detected, which can limit search engine discovery of your pages. `
    }
    if (siteWide.brokenPages.length > 0) {
      text += `${siteWide.brokenPages.length} broken page${siteWide.brokenPages.length !== 1 ? 's' : ''} were identified that return error status codes. `
    }
    text += `\n`
  }
  
  // On-page findings
  if (onPageIssues.length > 0) {
    // Count pages, not issues (issues may be consolidated with multiple affectedPages)
    const missingTitleIssues = onPageIssues.filter(i => i.message.includes('Missing page title'))
    const missingMetaIssues = onPageIssues.filter(i => i.message.includes('Missing meta description'))
    const missingH1Issues = onPageIssues.filter(i => i.message.includes('Missing H1'))
    
    const missingTitleCount = missingTitleIssues.reduce((sum, issue) => sum + (issue.affectedPages?.length || 1), 0)
    const missingMetaCount = missingMetaIssues.reduce((sum, issue) => sum + (issue.affectedPages?.length || 1), 0)
    const missingH1Count = missingH1Issues.reduce((sum, issue) => sum + (issue.affectedPages?.length || 1), 0)
    
    text += `On-Page SEO: ${onPageIssues.length} issue${onPageIssues.length !== 1 ? 's' : ''} identified. `
    if (missingTitleCount > 0) text += `${missingTitleCount} page${missingTitleCount !== 1 ? 's' : ''} missing titles, `
    if (missingMetaCount > 0) text += `${missingMetaCount} page${missingMetaCount !== 1 ? 's' : ''} missing meta descriptions, `
    if (missingH1Count > 0) text += `${missingH1Count} page${missingH1Count !== 1 ? 's' : ''} missing H1 tags. `
    if (siteWide.duplicateTitles.length > 0) {
      text += `Additionally, ${siteWide.duplicateTitles.length / 2} duplicate title${siteWide.duplicateTitles.length / 2 !== 1 ? 's' : ''} were found across pages. `
    }
    text += `\n`
  }
  
  // Content findings
  if (contentIssues.length > 0) {
    const thinPages = contentIssues.filter(i => i.message.includes('Thin content')).length
    text += `Content Quality: ${contentIssues.length} issue${contentIssues.length !== 1 ? 's' : ''} detected. `
    if (thinPages > 0) {
      text += `${thinPages} page${thinPages !== 1 ? 's' : ''} contain${thinPages === 1 ? 's' : ''} thin content (less than 300 words), which may limit their SEO value. `
    }
    text += `\n`
  }
  
  // Accessibility findings
  if (accessibilityIssues.length > 0) {
    const missingAlt = accessibilityIssues.filter(i => i.message.includes('alt')).length
    const missingViewport = result.pages.filter(p => !p.hasViewport).length
    
    text += `Accessibility: ${accessibilityIssues.length} issue${accessibilityIssues.length !== 1 ? 's' : ''} found. `
    if (missingAlt > 0) {
      text += `${missingAlt} page${missingAlt !== 1 ? 's' : ''} have images missing alt text, which impacts both accessibility and SEO. `
    }
    if (missingViewport > 0) {
      text += `${missingViewport} page${missingViewport !== 1 ? 's' : ''} lack viewport meta tags, affecting mobile responsiveness. `
    }
    text += `\n`
  }
  
  text += `\nRecommended Next Steps\n\n`
  
  const recommendations: string[] = []
  
  if (summary.highSeverityIssues > 0) {
    recommendations.push(`Address all ${summary.highSeverityIssues} high-priority issue${summary.highSeverityIssues !== 1 ? 's' : ''} first, as these have the most significant impact on SEO performance`)
  }
  
  if (!siteWide.sitemapExists) {
    recommendations.push(`Create and submit a sitemap.xml to help search engines discover all pages`)
  }
  
  if (onPageIssues.filter(i => i.message.includes('Missing')).length > 0) {
    recommendations.push(`Add missing page titles, meta descriptions, and H1 tags to all pages`)
  }
  
  if (contentIssues.filter(i => i.message.includes('Thin content')).length > 0) {
    recommendations.push(`Expand thin content pages to at least 300 words to improve their SEO value`)
  }
  
  if (accessibilityIssues.filter(i => i.message.includes('alt')).length > 0) {
    recommendations.push(`Add descriptive alt text to all images for accessibility and SEO benefits`)
  }
  
  if (siteWide.brokenPages.length > 0) {
    recommendations.push(`Fix ${siteWide.brokenPages.length} broken page${siteWide.brokenPages.length !== 1 ? 's' : ''} that return error status codes`)
  }
  
  if (recommendations.length === 0) {
    recommendations.push(`Continue monitoring SEO performance and maintain current optimization levels`)
  }
  
  recommendations.forEach((rec, idx) => {
    text += `${idx + 1}. ${rec}\n`
  })
  
  text += `\nThis report provides detailed information on each issue, including affected pages and specific recommendations for resolution.`
  
  return text
}

/**
 * Normalize issue message to a readable issue type
 */
function normalizeIssueType(message: string): string {
  let type = message
  
  // Handle "Missing" issues
  if (type.includes('Missing')) {
    if (type.includes('H1')) {
      return 'Missing H1 tag'
    } else if (type.includes('page title') || type.includes('title')) {
      return 'Missing page title'
    } else if (type.includes('meta description') || type.includes('description')) {
      return 'Missing meta description'
    } else if (type.includes('schema markup') || type.includes('structured data')) {
      return 'Missing schema markup'
    } else if (type.includes('alt') || type.includes('Alt')) {
      return 'Missing image alt tags'
    } else {
      return type.replace(/Missing (page )?/, 'Missing ').trim()
    }
  }
  
  // Handle "too short" / "too long" issues
  if (type.includes('too short') || type.includes('too long')) {
    const isShort = type.includes('too short')
    if (type.includes('title')) {
      return isShort ? 'Page title too short' : 'Page title too long'
    } else if (type.includes('meta description') || type.includes('Meta description')) {
      return isShort ? 'Meta description too short' : 'Meta description too long'
    }
  }
  
  // Handle "Thin content"
  if (type.includes('Thin content') || type.includes('thin content')) {
    return 'Thin content'
  }
  
  // Handle "Duplicate"
  if (type.includes('Duplicate')) {
    if (type.includes('title')) {
      return 'Duplicate page titles'
    } else if (type.includes('meta description') || type.includes('description')) {
      return 'Duplicate meta descriptions'
    }
  }
  
  // Handle "Multiple H1"
  if (type.includes('Multiple H1') || type.includes('multiple H1')) {
    return 'Multiple H1 tags'
  }
  
  // Handle "broken" / "error"
  if (type.includes('broken') || type.includes('error status')) {
    return 'Broken pages'
  }
  
  // Handle sitemap/robots
  if (type.includes('sitemap')) {
    return 'Missing sitemap.xml'
  }
  if (type.includes('robots.txt')) {
    return 'Missing or unreachable robots.txt'
  }
  
  // Default: return first few words, cleaned up
  return type.split(' ').slice(0, 4).join(' ').trim()
}

