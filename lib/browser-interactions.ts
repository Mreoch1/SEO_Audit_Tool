import { Page, Browser } from 'puppeteer'
import { RenderedPageData } from './renderer'

/**
 * Measure Core Web Vitals and performance metrics
 */
export async function measureCoreWebVitals(page: Page): Promise<RenderedPageData['metrics']> {
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
                        ; (window as any).__lcp = lcpValue
                }).observe({ entryTypes: ['largest-contentful-paint'] })

                // CLS (Cumulative Layout Shift)
                let clsValue = 0
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries() as any[]) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value
                        }
                    }
                    ; (window as any).__cls = clsValue
                }).observe({ entryTypes: ['layout-shift'] })

                // FID (First Input Delay)
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries() as any[]) {
                        const fid = entry.processingStart - entry.startTime
                        if (!(window as any).__fid) {
                            ; (window as any).__fid = fid
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
                    ; (window as any).__tbt = longTasks.reduce((a, b) => a + b, 0)
                }).observe({ entryTypes: ['longtask'] })

                // FCP (First Contentful Paint)
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.name === 'first-contentful-paint') {
                            ; (window as any).__fcp = entry.startTime
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
 * Expand dynamic content on the page
 * Handles infinite scroll, load more buttons, tabs, and accordions
 */
export async function expandPageContent(page: Page, browserInstance: Browser | null): Promise<void> {
    // Step 1: Scroll down to trigger infinite scroll (3 scrolls)
    for (let i = 0; i < 3; i++) {
        // Check connection before each scroll
        if (!browserInstance || !browserInstance.isConnected()) {
            throw new Error('Browser disconnected during content expansion')
        }
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight)
        })
        await page.waitForTimeout(1000) // Wait for content to load
    }

    // Step 2: Click "Load More" buttons (multiple rounds)
    for (let round = 0; round < 3; round++) {
        // Check connection before each round
        if (!browserInstance || !browserInstance.isConnected()) {
            throw new Error('Browser disconnected during button clicking')
        }
        const clicked = await page.evaluate(() => {
            const loadMoreButtons = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter((el: any) => {
                const text = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase()
                const isVisible = el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0
                return isVisible && (
                    text.includes('load more') ||
                    text.includes('show more') ||
                    text.includes('see more') ||
                    text.includes('view more') ||
                    text.includes('expand')
                )
            })
            loadMoreButtons.forEach((btn: any) => {
                try {
                    btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    btn.click()
                } catch { }
            })
            return loadMoreButtons.length
        })

        if (clicked === 0) break // No more buttons to click
        await page.waitForTimeout(2000) // Wait for content to load
    }

    // Step 3: Expand tabbed content (click tabs to reveal hidden content)
    if (!browserInstance || !browserInstance.isConnected()) {
        throw new Error('Browser disconnected before tab expansion')
    }
    await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('[role="tab"], .tab, [data-tab]')).filter((el: any) => {
            const isVisible = el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0
            return isVisible && !el.classList.contains('active') && !el.classList.contains('selected')
        })
        tabs.slice(0, 5).forEach((tab: any) => {
            try {
                tab.scrollIntoView({ behavior: 'smooth', block: 'center' })
                tab.click()
            } catch { }
        })
    })
    await page.waitForTimeout(1500)

    // Step 4: Expand accordions (multiple rounds)
    for (let round = 0; round < 2; round++) {
        // Check connection before each round
        if (!browserInstance || !browserInstance.isConnected()) {
            throw new Error('Browser disconnected during accordion expansion')
        }
        const expanded = await page.evaluate(() => {
            const accordions = Array.from(document.querySelectorAll(
                '[aria-expanded="false"], .accordion:not(.active), [data-accordion]:not(.active)'
            )).filter((el: any) => {
                const isVisible = el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0
                return isVisible
            })
            accordions.slice(0, 10).forEach((acc: any) => {
                try {
                    acc.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    acc.click()
                } catch { }
            })
            return accordions.length
        })

        if (expanded === 0) break
        await page.waitForTimeout(1500)
    }

    // Step 5: Final scroll to bottom to trigger any remaining lazy loading
    if (!browserInstance || !browserInstance.isConnected()) {
        throw new Error('Browser disconnected before final scroll')
    }
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(2000) // Wait for final content to load
}
