/**
 * JavaScript Rendering Engine
 * 
 * Uses Puppeteer to render pages with JavaScript execution,
 * enabling detection of JS-rendered content, images, links, and performance metrics.
 */

import puppeteer from 'puppeteer-extra'
// import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Browser, Page } from 'puppeteer'

// puppeteer.use(StealthPlugin()) // Disabled due to compatibility issues
import * as fs from 'fs'
import { measureCoreWebVitals, expandPageContent } from './browser-interactions'

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
  h1Data?: {
    h1Count: number
    h1Text: string[]
  }
  renderedTitle?: string // CRITICAL FIX: Page title extracted from rendered DOM
  initialHtml?: string // CRITICAL FIX: Initial HTML for rendering percentage calculation
  schemaScripts?: string[] // CRITICAL FIX: JSON-LD schema scripts extracted from rendered DOM
}

// Browser instance per audit (not global)
let browserInstance: Browser | null = null
let pageInstance: Page | null = null

/**
 * Check if browser is healthy and connected
 */
function isBrowserHealthy(): boolean {
  return browserInstance !== null &&
    browserInstance.isConnected() &&
    (pageInstance === null || !pageInstance.isClosed())
}

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
      await browserInstance.close().catch(() => { })
    } catch {
      // Ignore errors when closing disconnected browser
    }
    browserInstance = null
  }

  console.log('[Renderer] Launching new browser instance...')
  try {
    // Try to use system Chrome if available (more stable on macOS)
    const systemChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    let useSystemChrome: string | undefined = process.env.PUPPETEER_EXECUTABLE_PATH
    if (!useSystemChrome) {
      try {
        const fs = require('fs')
        if (fs.existsSync(systemChromePath)) {
          useSystemChrome = systemChromePath
        }
      } catch {
        // Ignore if fs check fails
      }
    }

    // Enhanced Chrome flags to prevent crashes on macOS
    // NOTE: Removed --single-process as it causes "Cannot use V8 Proxy resolver" error
    const launchOptions: any = {
      headless: "new", // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor',
        '--no-first-run',
        '--no-default-browser-check',
        '--mute-audio',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-default-apps',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-notifications',
        '--disable-offer-store-unmasked-wallet-cards',
        '--disable-popup-blocking',
        '--disable-print-preview',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--no-crash-upload',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--disable-software-rasterizer',
        '--disable-background-media-suspend',
        '--disable-features=TranslateUI'
      ],
      timeout: 60000,
      ignoreHTTPSErrors: true,
      protocolTimeout: 120000,
      // Use pipe mode for better stability (avoids WebSocket issues)
      pipe: true
    }

    // Use system Chrome if available
    if (useSystemChrome) {
      launchOptions.executablePath = useSystemChrome
      console.log('[Renderer] Using system Chrome:', useSystemChrome)
    }

    browserInstance = await puppeteer.launch(launchOptions)

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
      await browserInstance.close().catch(() => { })
      throw new Error(`Browser test failed: ${testError instanceof Error ? testError.message : 'Unknown error'}`)
    }

    // Handle browser disconnection with debouncing
    // The disconnected event can fire during normal operations (especially during long waits),
    // so we need to verify actual disconnection before logging or cleaning up
    let disconnectTimeout: NodeJS.Timeout | null = null
    let disconnectLogged = false // Prevent spam of disconnection messages

    browserInstance.on('disconnected', () => {
      // Debounce the disconnection check - sometimes this fires temporarily during page operations
      if (disconnectTimeout) {
        clearTimeout(disconnectTimeout)
      }

      disconnectTimeout = setTimeout(() => {
        // Double-check that browser is actually disconnected
        if (browserInstance && !browserInstance.isConnected()) {
          // Silently handle disconnection - retry logic will handle it if needed
          // Only log if this persists across multiple operations
          // (The retry logic in renderPage will show messages if retries fail)
          browserInstance = null
          pageInstance = null
          disconnectLogged = true
        } else {
          // Browser reconnected or was false positive, reset flag
          disconnectLogged = false
        }
      }, 2000) // Wait 2 seconds before confirming disconnection
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

  // Reuse existing page if it's still open AND browser is connected
  if (pageInstance && !pageInstance.isClosed() && browser.isConnected()) {
    // Verify page is still functional by checking if we can access the URL
    try {
      await pageInstance.evaluate(() => document.readyState).catch(() => {
        // Page is dead, create new one
        pageInstance = null
      })
      if (pageInstance) {
        return pageInstance
      }
    } catch {
      // Page is dead, create new one
      pageInstance = null
    }
  }

  // Create new page
  pageInstance = await browser.newPage()

  // Set default timeouts to prevent hanging
  pageInstance.setDefaultNavigationTimeout(30000)
  pageInstance.setDefaultTimeout(30000)

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
  // CRITICAL FIX: Don't try to render PDFs or non-HTML files
  const isNonHtmlFile = url.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe|css|js|xml|json|txt)$/i)
  if (isNonHtmlFile) {
    throw new Error(`Cannot render non-HTML file: ${url}`)
  }
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // CRITICAL FIX: Add exponential backoff and better error handling
      if (attempt > 0) {
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`[Renderer] Waiting ${backoffDelay}ms before retry ${attempt + 1}/${maxRetries + 1}...`)
        await new Promise(resolve => setTimeout(resolve, backoffDelay))

        // Force browser cleanup before retry
        if (browserInstance) {
          try {
            await browserInstance.close().catch(() => { })
          } catch {
            // Ignore cleanup errors
          }
          browserInstance = null
          pageInstance = null
        }
      }

      const page = await getPage()

      // CRITICAL: Verify browser is still connected before proceeding
      if (!browserInstance || !browserInstance.isConnected()) {
        throw new Error('Browser disconnected before page operation')
      }

      // Set user agent
      await page.setUserAgent(userAgent)

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 })

      const startTime = Date.now()

      // Set a realistic viewport
      await page.setViewport({ width: 1920, height: 1080 })

      // Navigate and wait for DOM to load (stable and fast)
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      // Wait longer for JS to execute and for any anti-bot checks to complete
      // Check connection before waiting
      if (!browserInstance?.isConnected() || !browserInstance.isConnected()) {
        throw new Error('Browser disconnected during page load')
      }
      await page.waitForTimeout(2000)

      const loadTime = Date.now() - startTime

      // Get status code
      const statusCode = response?.status() || 200

      // Get content type
      const contentType = response?.headers()['content-type'] || 'text/html'

      // Get rendered HTML (after JS execution) - with connection check
      if (!browserInstance || !browserInstance.isConnected()) {
        throw new Error('Browser disconnected before content extraction')
      }
      const renderedHtml = await page.content()

      // Measure Core Web Vitals
      const metrics = await measureCoreWebVitals(page)

      // CRITICAL FIX: Wait for dynamic content to load
      // Try to expand infinite scroll, load more buttons, accordions, tabs
      // Add connection checks throughout to prevent hanging on disconnected browser
      try {
        await expandPageContent(page, browserInstance)
      } catch {
        // If expansion fails, continue with what we have
      }

      // Get final HTML (in case lazy loading added content)
      // Final connection check before data extraction
      if (!browserInstance || !browserInstance.isConnected()) {
        throw new Error('Browser disconnected before final data extraction')
      }
      const finalHtml = await page.content()
      
      // CRITICAL FIX: Extract JSON-LD schema scripts from rendered DOM
      // This catches schema that's injected dynamically via JavaScript
      let schemaScripts: string[] = []
      try {
        schemaScripts = await page.evaluate(() => {
          const scripts: string[] = []
          document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
            const content = script.textContent || script.innerHTML
            if (content && content.trim()) {
              scripts.push(content.trim())
            }
          })
          return scripts
        })
      } catch (error) {
        console.warn('[Renderer] Failed to extract schema from DOM:', error)
      }

      // Analyze images and links while page is still open
      // Add connection checks for each analysis step
      if (!browserInstance || !browserInstance.isConnected()) {
        throw new Error('Browser disconnected during image/link analysis')
      }

      // Wrap analysis in try-catch to handle page JavaScript interference
      let imageData, linkData, h1Data
      try {
        imageData = await analyzeImages(page, url)
      } catch (error: any) {
        console.warn('[Renderer] Image analysis error, using empty data:', error?.message || error)
        imageData = { imageCount: 0, missingAltCount: 0, images: [] }
      }

      if (!browserInstance || !browserInstance.isConnected()) {
        throw new Error('Browser disconnected during link analysis')
      }

      try {
        linkData = await analyzeLinks(page, url)
      } catch (error: any) {
        console.warn('[Renderer] Link analysis error, using empty data:', error?.message || error)
        linkData = { internalLinkCount: 0, externalLinkCount: 0, links: [] }
      }

      // CRITICAL FIX: Extract title from rendered DOM (handles JS-rendered titles)
      // Wait for title to stabilize (some sites update title after initial load)
      if (!browserInstance || !browserInstance.isConnected()) {
        throw new Error('Browser disconnected during title extraction')
      }

      let renderedTitle: string | undefined
      try {
        // CRITICAL FIX: Wait for title to stabilize and check for dynamic updates
        // Some sites (like Next.js) update title after initial render
        let previousTitle = ''
        let stableCount = 0
        const maxChecks = 8 // Increased from 5
        const checkInterval = 800 // Increased from 500ms
        
        for (let i = 0; i < maxChecks; i++) {
          await page.waitForTimeout(checkInterval)
          const currentTitle = await page.evaluate(() => {
            // Try multiple methods to get title
            return document.title || 
                   (document.querySelector('title')?.textContent || '').trim() ||
                   (document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '').trim()
          })
          
          if (currentTitle && currentTitle.length > 0) {
            if (currentTitle === previousTitle) {
              stableCount++
              if (stableCount >= 2) {
                // Title is stable
                renderedTitle = currentTitle
                break
              }
            } else {
              stableCount = 0
              previousTitle = currentTitle
            }
          }
        }
        // If title never stabilized, use the last non-empty value
        if (!renderedTitle && previousTitle) {
          renderedTitle = previousTitle
        }
        // Final fallback: try one more time after a longer wait
        if (!renderedTitle) {
          await page.waitForTimeout(1000)
          renderedTitle = await page.evaluate(() => document.title || '')
        }
      } catch (error: any) {
        console.warn('[Renderer] Title extraction error:', error?.message || error)
        // Fallback: try once more
        try {
          renderedTitle = await page.evaluate(() => document.title || '')
        } catch {
          renderedTitle = undefined
        }
      }

      // CRITICAL FIX: Extract H1s from rendered DOM (handles shadow DOM, React hydration, lazy-loaded headings)
      if (!browserInstance || !browserInstance.isConnected()) {
        throw new Error('Browser disconnected during H1 extraction')
      }

      try {
        h1Data = await extractH1sFromDOM(page)
      } catch (error: any) {
        console.warn('[Renderer] H1 extraction error, using empty data:', error?.message || error)
        h1Data = { h1Count: 0, h1Text: [] }
      }

      // Don't close the page - we'll reuse it for next page in same audit
      // Just navigate away to clear state (but check browser is still connected first)
      // CRITICAL: Add connection health check before navigation
      try {
        if (browserInstance && browserInstance.isConnected() && !page.isClosed()) {
          // Quick health check - try to access page properties
          try {
            await page.evaluate(() => document.readyState).catch(() => {
              throw new Error('Page is not responsive')
            })
            // Page is healthy, clear it
            await page.goto('about:blank', {
              waitUntil: 'domcontentloaded',
              timeout: 5000
            }).catch(() => {
              // If navigation fails, page might be dead - mark for recreation
              pageInstance = null
            })
          } catch {
            // Page is not responsive, mark for recreation
            pageInstance = null
          }
        } else {
          // Browser or page is dead, mark for recreation
          pageInstance = null
        }
      } catch {
        // Ignore errors when clearing page, but mark for recreation
        pageInstance = null
      }

      return {
        html: renderedHtml,
        renderedHtml: finalHtml,
        initialHtml: renderedHtml, // The HTML from the initial fetch
        loadTime,
        statusCode,
        contentType,
        metrics,
        imageData,
        linkData,
        h1Data, // CRITICAL FIX: H1s extracted from rendered DOM
        renderedTitle, // CRITICAL FIX: Title extracted from rendered DOM
        schemaScripts // CRITICAL FIX: JSON-LD schema scripts extracted from rendered DOM
      }
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || String(error)
      const isConnectionError = /ECONNRESET|socket hang up|Connection closed|Target closed|Browser disconnected/i.test(errorMessage)
      const isBrowserCrash = /Failed to launch the browser process|browser process|Failed to launch/i.test(errorMessage)

      // Check if browser is actually disconnected
      const isActuallyDisconnected = !browserInstance || !browserInstance.isConnected()

      // Force browser cleanup on any error
      if (browserInstance) {
        try {
          await browserInstance.close().catch(() => { })
        } catch {
          // Ignore cleanup errors
        }
        browserInstance = null
        pageInstance = null
      }

      // If it's a connection/browser error and we have retries left, try again
      if ((isConnectionError || isBrowserCrash || isActuallyDisconnected) && attempt < maxRetries) {
        // Only log if it's not a simple disconnection (those are common and handled automatically)
        // Log browser crashes and connection errors, but suppress routine disconnections
        if (isBrowserCrash || (!isActuallyDisconnected && isConnectionError)) {
          console.log(`[Renderer] ${isBrowserCrash ? 'Browser crash' : 'Connection error'} on attempt ${attempt + 1}/${maxRetries + 1} for ${url}, will retry...`)
        }
        // For routine disconnections, silently retry (they're common during long operations)
        continue
      }

      // If out of retries or non-recoverable error, throw
      if (attempt === maxRetries) {
        console.error(`[Renderer] Failed to render ${url} after ${attempt + 1} attempts: ${errorMessage}`)
        throw new Error(`Failed to render ${url} after ${attempt + 1} attempts: ${errorMessage}`)
      }
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error(`Failed to render ${url}`)
}

// measureCoreWebVitals moved to browser-interactions.ts

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
  try {
    // Use isolated evaluation context to avoid conflicts with page JavaScript
    return await page.evaluate((baseUrl) => {
      // Use try-catch to handle any page JavaScript interference
      try {
        const images: any[] = []
        const baseHost = new URL(baseUrl).hostname

        // Regular img tags (these NEED alt attributes)
        const imgElements: any[] = []
        document.querySelectorAll('img').forEach(img => {
          const imageData = {
            src: img.src || img.getAttribute('src') || '',
            alt: img.alt || img.getAttribute('alt') || undefined,
            isLazy: img.loading === 'lazy' ||
              img.hasAttribute('data-src') ||
              img.hasAttribute('data-lazy'),
            isBackground: false
          }
          imgElements.push(imageData)
          images.push(imageData)
        })

        // Picture elements (these don't need alt - the <img> inside does)
        // We'll track them but not count them for alt text purposes
        document.querySelectorAll('picture source').forEach(source => {
          const srcset = (source as HTMLSourceElement).srcset || source.getAttribute('srcset')
          if (srcset) {
            images.push({
              src: srcset,
              alt: undefined,
              isLazy: false,
              isBackground: false,
              isPictureSource: true // Mark as picture source
            })
          }
        })

        // Background images (CSS) - these don't need alt attributes
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
            const imageData = {
              src,
              alt: el.getAttribute('alt') || undefined,
              isLazy: true,
              isBackground: el.hasAttribute('data-bg')
            }
            // Only count as img element if it's not a background image
            if (!el.hasAttribute('data-bg')) {
              imgElements.push(imageData)
            }
            images.push(imageData)
          }
        })

        // Remove duplicates (same src)
        const uniqueImages = Array.from(
          new Map(images.map(img => [img.src, img])).values()
        )

        // Remove duplicates from img elements only (for alt counting)
        const uniqueImgElements = Array.from(
          new Map(imgElements.map(img => [img.src, img])).values()
        )

        // Count missing alt ONLY for <img> elements (not background images or picture sources)
        const missingAltCount = uniqueImgElements.filter(img =>
          !img.alt || img.alt.trim() === '' || img.alt === 'undefined'
        ).length

        return {
          imageCount: uniqueImgElements.length, // Only count <img> elements for alt text purposes
          missingAltCount: missingAltCount,
          images: uniqueImages // Return all images for reference
        }
      } catch (evalError: any) {
        // If evaluation fails due to page JavaScript interference, return empty results
        // This prevents "__name is not defined" and similar errors from breaking the audit
        return { imageCount: 0, missingAltCount: 0, images: [] }
      }
    }, baseUrl)
  } catch (error: any) {
    // If page evaluation fails (e.g., page JavaScript interference), return empty results
    console.warn('[Renderer] Image analysis failed, returning empty results:', error?.message || error)
    return {
      imageCount: 0,
      missingAltCount: 0,
      images: []
    }
  }
}

/**
 * Analyze links from rendered page
 */
export async function analyzeLinks(page: Page, baseUrl: string): Promise<{
  internalLinkCount: number
  externalLinkCount: number
  links: Array<{ href: string; text: string; isInternal: boolean }>
}> {
  try {
    // Use isolated evaluation context to avoid conflicts with page JavaScript
    return await page.evaluate((baseUrl) => {
      // Use try-catch to handle any page JavaScript interference
      try {
        const links: any[] = []
        const baseHost = new URL(baseUrl).hostname

        // CRITICAL FIX: Only count links in main content areas, exclude nav/footer/header
        // Find main content container
        const mainContent = document.querySelector('main') ||
          document.querySelector('article') ||
          document.querySelector('[role="main"]') ||
          document.body

        // Exclude navigation, header, footer, and aside elements
        const excludedSelectors = 'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]'
        const excludedElements = new Set<Element>()
        document.querySelectorAll(excludedSelectors).forEach(el => excludedElements.add(el))

        // Helper to check if element is in excluded area
        const isInExcludedArea = (element: Element): boolean => {
          let current: Element | null = element
          while (current && current !== document.body) {
            if (excludedElements.has(current)) return true
            current = current.parentElement
          }
          return false
        }

        // Regular anchor tags - only in main content
        mainContent.querySelectorAll('a[href]').forEach(a => {
          // Skip if link is in excluded area (nav/footer/header)
          if (isInExcludedArea(a)) return
          try {
            const href = (a as HTMLAnchorElement).href || a.getAttribute('href')
            if (!href) return

            const url = new URL(href, baseUrl)
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
              const url = new URL(match[1], baseUrl)
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
      } catch (evalError: any) {
        // If evaluation fails due to page JavaScript interference, return empty results
        return { internalLinkCount: 0, externalLinkCount: 0, links: [] }
      }
    }, baseUrl)
  } catch (error: any) {
    // If page evaluation fails, return empty results
    console.warn('[Renderer] Link analysis failed, returning empty results:', error?.message || error)
    return {
      internalLinkCount: 0,
      externalLinkCount: 0,
      links: []
    }
  }
}

/**
 * Extract H1 tags from rendered DOM (handles shadow DOM, React hydration, lazy-loaded headings)
 * CRITICAL FIX: Use DOM evaluation instead of regex to catch dynamically loaded H1s
 */
export async function extractH1sFromDOM(page: Page): Promise<{
  h1Count: number
  h1Text: string[]
}> {
  try {
    // Use isolated evaluation context to avoid conflicts with page JavaScript
    return await page.evaluate(() => {
      // Use try-catch to handle any page JavaScript interference
      try {
        const h1s: string[] = []

        // Function to recursively extract H1s, including from shadow DOM
        const extractH1s = (root: Document | ShadowRoot | Element) => {
          // Regular H1 elements
          root.querySelectorAll('h1').forEach(h1 => {
            const text = h1.textContent?.trim() || ''
            if (text) {
              h1s.push(text)
            }
          })

          // Check shadow DOM (for Web Components)
          root.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
              extractH1s(el.shadowRoot)
            }
          })
        }

        // Start extraction from document
        extractH1s(document)

        // Also check for React/Next.js hydration - look for elements that might become H1s
        // Some frameworks render H1s with data attributes or specific classes
        document.querySelectorAll('[data-h1], .h1, [role="heading"][aria-level="1"]').forEach(el => {
          const text = el.textContent?.trim() || ''
          if (text && !h1s.includes(text)) {
            h1s.push(text)
          }
        })

        return {
          h1Count: h1s.length,
          h1Text: h1s
        }
      } catch (evalError: any) {
        // If evaluation fails due to page JavaScript interference, return empty results
        return { h1Count: 0, h1Text: [] }
      }
    })
  } catch (error: any) {
    // If page evaluation fails, return empty results
    console.warn('[Renderer] H1 extraction failed, returning empty results:', error?.message || error)
    return {
      h1Count: 0,
      h1Text: []
    }
  }
}

