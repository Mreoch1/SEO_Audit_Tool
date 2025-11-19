/**
 * Performance Analysis Module
 * 
 * Analyzes Core Web Vitals and generates performance issues
 */

import { Issue, PageData } from './types'

/**
 * Generate performance issues based on Core Web Vitals
 */
export function generatePerformanceIssues(page: PageData): Issue[] {
  const issues: Issue[] = []
  
  if (!page.performanceMetrics) {
    return issues
  }
  
  const { lcp, cls, fid, tbt, fcp, ttfb } = page.performanceMetrics
  
  // LCP (Largest Contentful Paint)
  // Good: <2.5s, Needs Improvement: 2.5s-4s, Poor: >4s
  if (lcp) {
    if (lcp > 4000) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        message: 'Slow Largest Contentful Paint (LCP)',
        details: `LCP is ${lcp}ms (target: <2.5s, poor: >4s). This affects user experience and search rankings.`,
        affectedPages: [page.url]
      })
    } else if (lcp > 2500) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        message: 'Largest Contentful Paint needs improvement',
        details: `LCP is ${lcp}ms (target: <2.5s). Consider optimizing images, reducing server response time, or eliminating render-blocking resources.`,
        affectedPages: [page.url]
      })
    }
  }
  
  // CLS (Cumulative Layout Shift)
  // Good: <0.1, Needs Improvement: 0.1-0.25, Poor: >0.25
  if (cls !== undefined) {
    if (cls > 0.25) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        message: 'High Cumulative Layout Shift (CLS)',
        details: `CLS is ${cls.toFixed(3)} (target: <0.1, poor: >0.25). Layout shifts hurt user experience.`,
        affectedPages: [page.url]
      })
    } else if (cls > 0.1) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        message: 'Cumulative Layout Shift needs improvement',
        details: `CLS is ${cls.toFixed(3)} (target: <0.1). Add size attributes to images and videos, avoid inserting content above existing content.`,
        affectedPages: [page.url]
      })
    }
  }
  
  // FID (First Input Delay) / INP (Interaction to Next Paint)
  // Good: <100ms, Needs Improvement: 100ms-300ms, Poor: >300ms
  if (fid) {
    if (fid > 300) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        message: 'Slow First Input Delay (FID)',
        details: `FID is ${fid}ms (target: <100ms, poor: >300ms). Users experience delays when interacting with your page.`,
        affectedPages: [page.url]
      })
    } else if (fid > 100) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        message: 'First Input Delay needs improvement',
        details: `FID is ${fid}ms (target: <100ms). Reduce JavaScript execution time, break up long tasks.`,
        affectedPages: [page.url]
      })
    }
  }
  
  // TBT (Total Blocking Time)
  // Good: <200ms, Needs Improvement: 200ms-600ms, Poor: >600ms
  if (tbt) {
    if (tbt > 600) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        message: 'High Total Blocking Time (TBT)',
        details: `TBT is ${tbt}ms (target: <200ms, poor: >600ms). Long tasks block the main thread and hurt interactivity.`,
        affectedPages: [page.url]
      })
    } else if (tbt > 200) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        message: 'Total Blocking Time needs improvement',
        details: `TBT is ${tbt}ms (target: <200ms). Optimize JavaScript, reduce third-party script impact, use code splitting.`,
        affectedPages: [page.url]
      })
    }
  }
  
  // FCP (First Contentful Paint)
  // Good: <1.8s, Needs Improvement: 1.8s-3s, Poor: >3s
  if (fcp) {
    if (fcp > 3000) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        message: 'Slow First Contentful Paint (FCP)',
        details: `FCP is ${fcp}ms (target: <1.8s, poor: >3s). Users wait too long to see content.`,
        affectedPages: [page.url]
      })
    } else if (fcp > 1800) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        message: 'First Contentful Paint needs improvement',
        details: `FCP is ${fcp}ms (target: <1.8s). Optimize server response time, eliminate render-blocking resources.`,
        affectedPages: [page.url]
      })
    }
  }
  
  // TTFB (Time to First Byte)
  // Good: <800ms, Needs Improvement: 800ms-1800ms, Poor: >1800ms
  if (ttfb) {
    if (ttfb > 1800) {
      issues.push({
        category: 'Performance',
        severity: 'High',
        message: 'Slow Time to First Byte (TTFB)',
        details: `TTFB is ${ttfb}ms (target: <800ms, poor: >1800ms). Server response is too slow.`,
        affectedPages: [page.url]
      })
    } else if (ttfb > 800) {
      issues.push({
        category: 'Performance',
        severity: 'Medium',
        message: 'Time to First Byte needs improvement',
        details: `TTFB is ${ttfb}ms (target: <800ms). Optimize server response time, use a CDN, improve server location.`,
        affectedPages: [page.url]
      })
    }
  }
  
  // Overall load time (fallback if no CWV available)
  if (page.loadTime > 3000 && !lcp && !fcp) {
    issues.push({
      category: 'Performance',
      severity: page.loadTime > 5000 ? 'High' : 'Medium',
      message: 'Slow page load time',
      details: `Page loads in ${page.loadTime}ms (recommended: <3s). Consider optimizing assets, using a CDN, or reducing server response time.`,
      affectedPages: [page.url]
    })
  }
  
  return issues
}

