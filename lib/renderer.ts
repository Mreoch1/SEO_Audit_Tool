/**
 * JavaScript Rendering Engine
 * 
 * Uses Puppeteer to render pages with JavaScript execution,
 * enabling detection of JS-rendered content, images, links, and performance metrics.
 */

import puppeteer, { Browser, Page } from 'puppeteer'

export interface RenderedPageData {
  html: string
  renderedHtml: string
  loadTime: number
  statusCode: number
  contentType: string
  metrics: {
    lcp?: number
    fid?: number
    cls?: number
    tbt?: number
    fcp?: number
    ttfb?: number
  }
  imageData?: {
    imageCount: number
    missingAltCount: number
    images: Array<{
      src: string
      alt?: string
      isLazy: boolean
      isBackground: boolean
    }>
  }
  linkData?: {
    internalLinkCount: number
    externalLinkCount: number
    links: Array<{ href: string; text: string; isInternal: boolean }>
  }
}

// Browser instance per audit (not global)
let browserInstance: Browser | null = null
let pageInstance: Page | null = null

/**
 * Get or create a browser instance with connection checking and auto-reconnect
 */
async function getBrowser(): Promise<Browser> {
  // Check if browser exists and is still connected
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance
  }
  
  // Browser doesn't exist or is disconnected - create new one
  if (browserInstance) {
    try {
      await browserInstance.close().catch(() => {})
    } catch {
      // Ignore errors when closing disconnected browser
    }
    browserInstance = null
  }
  
  console.log('[Renderer] Launching new browser instance...')
  try {
    browserInstance = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection'
      ],
      // Increase timeout for browser launch
      timeout: 60000,
      // Use pipe instead of WebSocket for more stable connection
      pipe: true,
      ignoreHTTPSErrors: true
    })
    
    // Verify browser is actually connected and working
    if (!browserInstance.isConnected()) {
      throw new Error('Browser launched but not connected')
    }
    
    // Test browser with a simple page creation
    try {
      const testPage = await browserInstance.newPage()
      await testPage.close()
      console.log('[Renderer] Browser instance verified and ready')
    } catch (testError) {
      console.error('[Renderer] Browser test failed, closing and retrying:', testError)
      await browserInstance.close().catch(() => {})
      throw new Error(`Browser test failed: ${testError instanceof Error ? testError.message : 'Unknown error'}`)
    }
    
    // Handle browser disconnection
    browserInstance.on('disconnected', () => {
      console.warn('[Renderer] Browser disconnected, will recreate on next use')
      browserInstance = null
      pageInstance = null
    })
    
    return browserInstance
  } catch (launchError: any) {
    console.error('[Renderer] Failed to launch browser:', launchError)
    browserInstance = null
    // Re-throw with more context
    throw new Error(`Failed to launch Puppeteer browser: ${launchError?.message || 'Unknown error'}. This may be due to missing Chrome/Chromium installation or system permissions.`)
  }
}

/**
 * Get or create a page instance (reuse for performance within same audit)
 */
async function getPage(): Promise<Page> {
  const browser = await getBrowser()
  
  // Reuse existing page if it's still open
  if (pageInstance && !pageInstance.isClosed()) {
    return pageInstance
  }
  
  // Create new page
  pageInstance = await browser.newPage()
  return pageInstance
}

/**
 * Initialize browser for an audit (call at start of audit)
 */
export async function initializeBrowser(): Promise<void> {
  await getBrowser()
}

/**
 * Close browser instance (call at end of audit or on error)
 */
export async function closeBrowser(): Promise<void> {
  if (pageInstance && !pageInstance.isClosed()) {
    try {
      await pageInstance.close()
    } catch (error) {
      console.warn('[Renderer] Error closing page:', error)
    }
    pageInstance = null
  }
  
  if (browserInstance) {
    try {
      await browserInstance.close()
    } catch (error) {
      console.warn('[Renderer] Error closing browser:', error)
    }
    browserInstance = null
  }
}

/**
 * Render a page with JavaScript execution (with retry logic for ECONNRESET)
 */
export async function renderPage(
  url: string,
  userAgent: string = 'SEO-Audit-Bot/1.0',
  maxRetries: number = 2
): Promise<RenderedPageData> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const page = await getPage()
      
      // Set user agent
      await page.setUserAgent(userAgent)
      
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 })
      
      const startTime = Date.now()
      
      // Navigate and wait for network to be idle
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      })
      
      const loadTime = Date.now() - startTime
      
      // Get status code
      const statusCode = response?.status() || 200
      
      // Get content type
      const contentType = response?.headers()['content-type'] || 'text/html'
      
      // Get rendered HTML (after JS execution)
      const renderedHtml = await page.content()
      
      // Measure Core Web Vitals
      const metrics = await measureCoreWebVitals(page)
      
      // Wait a bit more for any lazy-loaded content
      await page.waitForTimeout(2000)
      
      // Get final HTML (in case lazy loading added content)
      const finalHtml = await page.content()
      
      // Analyze images and links while page is still open
      const imageData = await analyzeImages(page, url)
      const linkData = await analyzeLinks(page, url)
      
      // Don't close the page - we'll reuse it for next page in same audit
      // Just navigate away to clear state
      try {
        await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {})
      } catch {
        // Ignore errors when clearing page
      }
      
      return {
        html: renderedHtml,
        renderedHtml: finalHtml,
        loadTime,
        statusCode,
        contentType,
        metrics,
        imageData,
        linkData
      }
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || String(error)
      const isConnectionError = /ECONNRESET|socket hang up|Connection closed|Target closed/i.test(errorMessage)
      
      // If it's a connection error and we have retries left, force browser recreation
      if (isConnectionError && attempt < maxRetries) {
        console.warn(`[Renderer] Connection error on attempt ${attempt + 1}/${maxRetries + 1} for ${url}, recreating browser...`)
        // Force browser recreation
        if (browserInstance) {
          try {
            await browserInstance.close().catch(() => {})
          } catch {
            // Ignore
          }
          browserInstance = null
          pageInstance = null
        }
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      
      // If not a connection error or out of retries, throw
      if (!isConnectionError || attempt === maxRetries) {
        throw new Error(`Failed to render ${url} after ${attempt + 1} attempts: ${errorMessage}`)
      }
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error(`Failed to render ${url}`)
}

/**
 * Measure Core Web Vitals and performance metrics
 */
async function measureCoreWebVitals(page: Page): Promise<RenderedPageData['metrics']> {
  const metrics: RenderedPageData['metrics'] = {}
  
  try {
    // Inject performance measurement script
    await page.evaluateOnNewDocument(() => {
      // LCP (Largest Contentful Paint)
      if (typeof PerformanceObserver !== 'undefined') {
        let lcpValue = 0
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          lcpValue = lastEntry.renderTime || lastEntry.loadTime || 0
          ;(window as any).__lcp = lcpValue
        }).observe({ entryTypes: ['largest-contentful-paint'] })
        
        // CLS (Cumulative Layout Shift)
        let clsValue = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          }
          ;(window as any).__cls = clsValue
        }).observe({ entryTypes: ['layout-shift'] })
        
        // FID (First Input Delay)
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            const fid = entry.processingStart - entry.startTime
            if (!(window as any).__fid) {
              ;(window as any).__fid = fid
            }
          }
        }).observe({ entryTypes: ['first-input'] })
        
        // TBT (Total Blocking Time) - measure long tasks
        const longTasks: number[] = []
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (entry.duration > 50) {
              longTasks.push(entry.duration - 50)
            }
          }
          ;(window as any).__tbt = longTasks.reduce((a, b) => a + b, 0)
        }).observe({ entryTypes: ['longtask'] })
        
        // FCP (First Contentful Paint)
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              ;(window as any).__fcp = entry.startTime
            }
          }
        }).observe({ entryTypes: ['paint'] })
      }
    })
    
    // Wait for page to stabilize and metrics to be collected
    await page.waitForTimeout(5000) // Increased wait time
    
    // Try to wait for LCP if it hasn't fired yet
    try {
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          if ((window as any).__lcp) {
            resolve()
            return
          }
          // Wait up to 5 more seconds for LCP
          const checkInterval = setInterval(() => {
            if ((window as any).__lcp) {
              clearInterval(checkInterval)
              resolve()
            }
          }, 500)
          setTimeout(() => {
            clearInterval(checkInterval)
            resolve()
          }, 5000)
        })
      })
    } catch {
      // Continue if this fails
    }
    
    // Extract metrics - check multiple times for late-arriving metrics
    let pageMetrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as any
      const paintEntries = performance.getEntriesByType('paint') as any[]
      const fcpEntry = paintEntries.find((e: any) => e.name === 'first-contentful-paint')
      
      return {
        lcp: (window as any).__lcp || 0,
        cls: (window as any).__cls !== undefined ? (window as any).__cls : 0,
        fid: (window as any).__fid || 0,
        tbt: (window as any).__tbt || 0,
        fcp: (window as any).__fcp || (fcpEntry ? fcpEntry.startTime : 0),
        ttfb: nav ? nav.responseStart - nav.requestStart : 0
      }
    })
    
    // Wait a bit more and check again for late metrics
    await page.waitForTimeout(2000)
    const updatedMetrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as any
      return {
        lcp: (window as any).__lcp || 0,
        cls: (window as any).__cls !== undefined ? (window as any).__cls : 0,
        fid: (window as any).__fid || 0,
        tbt: (window as any).__tbt || 0,
        fcp: (window as any).__fcp || 0,
        ttfb: nav ? nav.responseStart - nav.requestStart : 0
      }
    })
    
    // Use the latest values
    pageMetrics = {
      lcp: updatedMetrics.lcp || pageMetrics.lcp,
      cls: updatedMetrics.cls || pageMetrics.cls,
      fid: updatedMetrics.fid || pageMetrics.fid,
      tbt: updatedMetrics.tbt || pageMetrics.tbt,
      fcp: updatedMetrics.fcp || pageMetrics.fcp,
      ttfb: updatedMetrics.ttfb || pageMetrics.ttfb
    }
    
    // Include metrics if they have reasonable values
    // CLS can be 0, so check if it's been set (not undefined)
    if (pageMetrics.lcp > 0) metrics.lcp = Math.round(pageMetrics.lcp)
    if (pageMetrics.cls !== undefined && pageMetrics.cls !== null) {
      metrics.cls = Math.round(pageMetrics.cls * 1000) / 1000 // Round to 3 decimals
    }
    if (pageMetrics.fid > 0) metrics.fid = Math.round(pageMetrics.fid)
    if (pageMetrics.tbt > 0) metrics.tbt = Math.round(pageMetrics.tbt)
    if (pageMetrics.fcp > 0) metrics.fcp = Math.round(pageMetrics.fcp)
    if (pageMetrics.ttfb > 0) metrics.ttfb = Math.round(pageMetrics.ttfb)
    
  } catch (error) {
    // If metrics collection fails, continue without them
    console.warn('Failed to collect performance metrics:', error)
  }
  
  return metrics
}

/**
 * Analyze images from rendered page
 */
export async function analyzeImages(page: Page, baseUrl: string): Promise<{
  imageCount: number
  missingAltCount: number
  images: Array<{
    src: string
    alt?: string
    isLazy: boolean
    isBackground: boolean
  }>
}> {
  return await page.evaluate((base) => {
    const images: any[] = []
    const baseHost = new URL(base).hostname
    
    // Regular img tags
    document.querySelectorAll('img').forEach(img => {
      images.push({
        src: img.src || img.getAttribute('src') || '',
        alt: img.alt || img.getAttribute('alt') || undefined,
        isLazy: img.loading === 'lazy' || 
                img.hasAttribute('data-src') || 
                img.hasAttribute('data-lazy'),
        isBackground: false
      })
    })
    
    // Picture elements
    document.querySelectorAll('picture source').forEach(source => {
      const srcset = (source as HTMLSourceElement).srcset || source.getAttribute('srcset')
      if (srcset) {
        images.push({
          src: srcset,
          alt: undefined,
          isLazy: false,
          isBackground: false
        })
      }
    })
    
    // Background images (CSS)
    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el)
      const bgImage = style.backgroundImage
      if (bgImage && bgImage !== 'none' && bgImage !== 'initial') {
        const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/)
        if (match && match[1]) {
          images.push({
            src: match[1],
            alt: undefined,
            isLazy: false,
            isBackground: true
          })
        }
      }
    })
    
    // Also check data attributes for lazy-loaded images
    document.querySelectorAll('[data-src], [data-lazy-src], [data-bg]').forEach(el => {
      const src = el.getAttribute('data-src') || 
                  el.getAttribute('data-lazy-src') || 
                  el.getAttribute('data-bg')
      if (src) {
        images.push({
          src,
          alt: el.getAttribute('alt') || undefined,
          isLazy: true,
          isBackground: el.hasAttribute('data-bg')
        })
      }
    })
    
    // Remove duplicates (same src)
    const uniqueImages = Array.from(
      new Map(images.map(img => [img.src, img])).values()
    )
    
    return {
      imageCount: uniqueImages.length,
      missingAltCount: uniqueImages.filter(img => !img.alt || img.alt.trim() === '').length,
      images: uniqueImages
    }
  }, baseUrl)
}

/**
 * Analyze links from rendered page
 */
export async function analyzeLinks(page: Page, baseUrl: string): Promise<{
  internalLinkCount: number
  externalLinkCount: number
  links: Array<{ href: string; text: string; isInternal: boolean }>
}> {
  return await page.evaluate((base) => {
    const links: any[] = []
    const baseHost = new URL(base).hostname
    
    // Regular anchor tags
    document.querySelectorAll('a[href]').forEach(a => {
      try {
        const href = (a as HTMLAnchorElement).href || a.getAttribute('href')
        if (!href) return
        
        const url = new URL(href, base)
        links.push({
          href: url.toString(),
          text: (a.textContent || '').trim() || a.getAttribute('aria-label') || '',
          isInternal: url.hostname === baseHost
        })
      } catch {
        // Relative URL - count as internal
        const href = a.getAttribute('href')
        if (href && !href.startsWith('#')) {
          links.push({
            href: href,
            text: (a.textContent || '').trim() || a.getAttribute('aria-label') || '',
            isInternal: true
          })
        }
      }
    })
    
    // Button-based navigation (onclick with window.location or similar)
    document.querySelectorAll('button, [role="button"], [onclick]').forEach(btn => {
      const onclick = btn.getAttribute('onclick') || ''
      const match = onclick.match(/(?:window\.location|location\.href)\s*=\s*['"]([^'"]+)['"]/)
      if (match) {
        try {
          const url = new URL(match[1], base)
          links.push({
            href: match[1],
            text: (btn.textContent || '').trim() || btn.getAttribute('aria-label') || '',
            isInternal: url.hostname === baseHost
          })
        } catch {
          // Relative URL
          links.push({
            href: match[1],
            text: (btn.textContent || '').trim() || btn.getAttribute('aria-label') || '',
            isInternal: true
          })
        }
      }
    })
    
    // Remove duplicates
    const uniqueLinks = Array.from(
      new Map(links.map(link => [link.href, link])).values()
    )
    
    return {
      internalLinkCount: uniqueLinks.filter(l => l.isInternal).length,
      externalLinkCount: uniqueLinks.filter(l => !l.isInternal).length,
      links: uniqueLinks
    }
  }, baseUrl)
}

