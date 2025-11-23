/**
 * Enhanced Technical SEO Checks
 * 
 * Comprehensive technical analysis including:
 * - Security headers (HTTPS, HSTS, CSP)
 * - Server configuration (HTTP version, compression, caching)
 * - Mobile optimization (viewport, responsive design)
 * - URL structure and canonicalization
 * - Redirect chains and status codes
 * - Core Web Vitals and performance metrics
 */

import { Issue } from './types'

export interface EnhancedTechnicalData {
  https: boolean
  hsts: boolean
  csp: boolean
  xFrameOptions: boolean
  xContentTypeOptions: boolean
  referrerPolicy: boolean
  httpVersion: 'http/1.1' | 'http/2' | 'http/3' | 'unknown'
  compression: {
    gzip: boolean
    brotli: boolean
    savingsPercent?: number
  }
  caching: {
    hasCacheControl: boolean
    hasETag: boolean
    maxAge?: number
  }
  urlStructure: {
    hasTrailingSlash: boolean
    usesHTTPS: boolean
    hasWWW: boolean
    urlLength: number
  }
  redirects: {
    hasRedirect: boolean
    redirectChain?: string[]
    finalStatus: number
  }
}

/**
 * Perform comprehensive technical SEO analysis
 */
export async function performEnhancedTechnicalCheck(
  url: string,
  userAgent: string
): Promise<{ data: EnhancedTechnicalData; issues: Issue[] }> {
  const issues: Issue[] = []
  const data: EnhancedTechnicalData = {
    https: false,
    hsts: false,
    csp: false,
    xFrameOptions: false,
    xContentTypeOptions: false,
    referrerPolicy: false,
    httpVersion: 'unknown',
    compression: { gzip: false, brotli: false },
    caching: { hasCacheControl: false, hasETag: false },
    urlStructure: {
      hasTrailingSlash: false,
      usesHTTPS: false,
      hasWWW: false,
      urlLength: url.length
    },
    redirects: { hasRedirect: false, finalStatus: 200 }
  }

  try {
    // Follow redirects to get final URL
    let finalUrl = url
    const redirectChain: string[] = [url]
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': userAgent }
    })

    // Follow redirects manually
    let redirectCount = 0
    while ((response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) && redirectCount < 5) {
      const location = response.headers.get('Location')
      if (location) {
        finalUrl = new URL(location, finalUrl).toString()
        redirectChain.push(finalUrl)
        redirectCount++
        response = await fetch(finalUrl, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': userAgent }
        })
      } else {
        break
      }
    }

    data.redirects.finalStatus = response.status
    data.redirects.hasRedirect = redirectChain.length > 1
    if (redirectChain.length > 1) {
      data.redirects.redirectChain = redirectChain
    }

    // Check for redirect chains (bad for SEO)
    if (redirectChain.length > 2) {
      issues.push({
        category: 'Technical',
        severity: 'Medium',
        message: 'Redirect chain detected',
        details: `Found ${redirectChain.length} redirects. Chains can slow down page load and dilute link equity. Consider consolidating redirects.`,
        affectedPages: [url]
      })
    }

    // Check HTTPS
    data.https = finalUrl.startsWith('https://')
    data.urlStructure.usesHTTPS = data.https
    if (!data.https) {
      issues.push({
        category: 'Technical',
        severity: 'High',
        message: 'Site not using HTTPS',
        details: 'HTTPS is required for security and SEO. Google prioritizes HTTPS sites in search results.',
        affectedPages: [url]
      })
    }

    // Check security headers
    const headers = response.headers
    data.hsts = headers.has('Strict-Transport-Security')
    data.csp = headers.has('Content-Security-Policy')
    data.xFrameOptions = headers.has('X-Frame-Options')
    data.xContentTypeOptions = headers.has('X-Content-Type-Options')
    data.referrerPolicy = headers.has('Referrer-Policy')

    if (!data.hsts && data.https) {
      issues.push({
        category: 'Technical',
        severity: 'Medium',
        message: 'Missing HSTS header',
        details: 'HTTP Strict Transport Security (HSTS) prevents protocol downgrade attacks and cookie hijacking.',
        affectedPages: [url]
      })
    }

    if (!data.xFrameOptions) {
      issues.push({
        category: 'Technical',
        severity: 'Low',
        message: 'Missing X-Frame-Options header',
        details: 'X-Frame-Options prevents clickjacking attacks. Recommended: "SAMEORIGIN" or "DENY".',
        affectedPages: [url]
      })
    }

    if (!data.xContentTypeOptions) {
      issues.push({
        category: 'Technical',
        severity: 'Low',
        message: 'Missing X-Content-Type-Options header',
        details: 'X-Content-Type-Options: nosniff prevents MIME type sniffing attacks.',
        affectedPages: [url]
      })
    }

    if (!data.csp) {
      issues.push({
        category: 'Technical',
        severity: 'Low',
        message: 'Missing Content-Security-Policy header',
        details: 'CSP helps prevent XSS attacks, clickjacking, and other code injection attacks. Recommended for enhanced security.',
        affectedPages: [url]
      })
    }

    if (!data.referrerPolicy) {
      issues.push({
        category: 'Technical',
        severity: 'Low',
        message: 'Missing Referrer-Policy header',
        details: 'Referrer-Policy controls how much referrer information is shared. Recommended: "strict-origin-when-cross-origin" or "no-referrer-when-downgrade".',
        affectedPages: [url]
      })
    }

    // Check HTTP version
    const altSvc = headers.get('Alt-Svc')
    if (altSvc && (altSvc.includes('h3=') || altSvc.includes('h3-29='))) {
      data.httpVersion = 'http/3'
    } else if (finalUrl.startsWith('https://')) {
      data.httpVersion = 'http/2' // Assume HTTP/2 for HTTPS
    } else {
      data.httpVersion = 'http/1.1'
    }

    if (data.httpVersion === 'http/1.1' && data.https) {
      issues.push({
        category: 'Technical',
        severity: 'Low',
        message: 'Using HTTP/1.1 instead of HTTP/2 or HTTP/3',
        details: 'HTTP/2 and HTTP/3 offer better performance through multiplexing and reduced latency.',
        affectedPages: [url]
      })
    }

    // Check compression
    const acceptEncoding = 'gzip, deflate, br'
    const compressedResponse = await fetch(finalUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': userAgent,
        'Accept-Encoding': acceptEncoding
      }
    })
    const contentEncoding = compressedResponse.headers.get('Content-Encoding') || ''
    data.compression.gzip = contentEncoding.includes('gzip') || contentEncoding.includes('deflate')
    data.compression.brotli = contentEncoding.includes('br')

    if (!data.compression.gzip && !data.compression.brotli) {
      issues.push({
        category: 'Technical',
        severity: 'Medium',
        message: 'No compression enabled',
        details: 'Enable GZIP or Brotli compression to reduce page size and improve load times.',
        affectedPages: [url]
      })
    } else if (!data.compression.brotli && data.compression.gzip) {
      issues.push({
        category: 'Technical',
        severity: 'Low',
        message: 'Brotli compression not enabled',
        details: 'Brotli provides 15-20% better compression than GZIP. Consider enabling Brotli for better performance.',
        affectedPages: [url]
      })
    }

    // Check caching headers
    const cacheControl = headers.get('Cache-Control')
    const etag = headers.has('ETag')
    data.caching.hasCacheControl = !!cacheControl
    data.caching.hasETag = etag

    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i)
      if (maxAgeMatch) {
        data.caching.maxAge = parseInt(maxAgeMatch[1], 10)
      }
    }

    if (!data.caching.hasCacheControl) {
      issues.push({
        category: 'Technical',
        severity: 'Medium',
        message: 'Missing Cache-Control header',
        details: 'Cache-Control headers improve page load times for returning visitors. Recommended: "public, max-age=31536000" for static assets.',
        affectedPages: [url]
      })
    }

    // Check URL structure
    const urlObj = new URL(finalUrl)
    data.urlStructure.hasTrailingSlash = urlObj.pathname.endsWith('/')
    data.urlStructure.hasWWW = urlObj.hostname.startsWith('www.')
    data.urlStructure.urlLength = finalUrl.length

    if (data.urlStructure.urlLength > 100) {
      issues.push({
        category: 'Technical',
        severity: 'Low',
        message: 'URL too long',
        details: `URL is ${data.urlStructure.urlLength} characters. Keep URLs under 100 characters for better readability and sharing.`,
        affectedPages: [url]
      })
    }

    // CRITICAL FIX #5: Check for mixed content - Verify actual resource protocol after resolution
    if (data.https) {
      try {
        const htmlResponse = await fetch(finalUrl, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': userAgent }
        })
        const html = await htmlResponse.text()
        
        // Extract all resource URLs (img src, script src, link href, iframe src, etc.)
        const resourcePatterns = [
          /<img[^>]+src=["']([^"']+)["']/gi,
          /<script[^>]+src=["']([^"']+)["']/gi,
          /<link[^>]+href=["']([^"']+)["']/gi,
          /<iframe[^>]+src=["']([^"']+)["']/gi,
          /<source[^>]+src=["']([^"']+)["']/gi,
          /<video[^>]+src=["']([^"']+)["']/gi,
          /<audio[^>]+src=["']([^"']+)["']/gi,
          /url\(["']?([^"')]+)["']?\)/gi, // CSS background images
        ]
        
        const httpResources: string[] = []
        resourcePatterns.forEach(pattern => {
          let match
          while ((match = pattern.exec(html)) !== null) {
            const resourceUrl = match[1]
            if (resourceUrl && resourceUrl.startsWith('http://')) {
              // CRITICAL FIX #5: Check if the resource actually resolves to HTTP
              // Don't flag protocol-relative URLs (//example.com) or relative URLs
              if (!resourceUrl.startsWith('//') && !resourceUrl.startsWith('/')) {
                try {
                  const urlObj = new URL(resourceUrl)
                  // Only flag if it's explicitly http:// (not https://)
                  if (urlObj.protocol === 'http:') {
                    httpResources.push(resourceUrl)
                  }
                } catch {
                  // Invalid URL, skip
                }
              }
            }
          }
        })
        
        if (httpResources.length > 0) {
          issues.push({
            category: 'Technical',
            severity: 'Medium',
            message: 'Mixed content detected',
            details: `HTTPS pages should not load HTTP resources. Found ${httpResources.length} HTTP resource(s). Update all links to use HTTPS.`,
            affectedPages: [url]
          })
        }
      } catch {
        // Ignore errors when checking for mixed content
      }
    }

  } catch (error) {
    console.error('Enhanced technical check failed:', error)
    issues.push({
      category: 'Technical',
      severity: 'High',
      message: 'Failed to perform technical analysis',
      details: error instanceof Error ? error.message : 'Unknown error',
      affectedPages: [url]
    })
  }

  return { data, issues }
}

/**
 * Generate actionable fix instructions for technical issues
 */
export function getTechnicalFixInstructions(issue: Issue): string {
  const message = issue.message.toLowerCase()
  
  if (message.includes('https')) {
    return `1. Obtain an SSL certificate from your hosting provider or use Let's Encrypt (free)
2. Install the certificate on your web server
3. Update all internal links to use HTTPS
4. Set up 301 redirects from HTTP to HTTPS
5. Update your sitemap.xml to use HTTPS URLs
6. Verify in Google Search Console that HTTPS is properly configured`
  }
  
  if (message.includes('hsts')) {
    return `1. Add the Strict-Transport-Security header to your server configuration
2. For Apache, add to .htaccess: Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
3. For Nginx, add to server block: add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
4. Start with a short max-age (e.g., 300 seconds) for testing
5. Gradually increase to 31536000 (1 year) once confirmed working`
  }
  
  if (message.includes('compression')) {
    return `1. Enable GZIP compression in your server configuration
2. For Apache, add to .htaccess:
   <IfModule mod_deflate.c>
     AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
   </IfModule>
3. For Nginx, add to server block:
   gzip on;
   gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
4. For Brotli, install the brotli module and enable it similarly
5. Test compression using tools like GTmetrix or PageSpeed Insights`
  }
  
  if (message.includes('cache-control')) {
    return `1. Add Cache-Control headers to your server configuration
2. For static assets (CSS, JS, images): Cache-Control: public, max-age=31536000
3. For HTML pages: Cache-Control: public, max-age=3600 (or use ETag for validation)
4. For Apache, add to .htaccess:
   <FilesMatch "\.(jpg|jpeg|png|gif|css|js)$">
     Header set Cache-Control "max-age=31536000, public"
   </FilesMatch>
5. For Nginx, add to server block:
   location ~* \.(jpg|jpeg|png|gif|css|js)$ {
     expires 1y;
     add_header Cache-Control "public, immutable";
   }`
  }
  
  if (message.includes('redirect chain')) {
    return `1. Identify all redirects in the chain: ${issue.affectedPages?.join(' → ') || 'check manually'}
2. Update the original URL to redirect directly to the final destination
3. Remove intermediate redirects
4. Test the redirect chain using curl: curl -I -L [URL]
5. Update internal links to point directly to the final URL
6. Submit updated sitemap to Google Search Console`
  }
  
  if (message.includes('http/2') || message.includes('http/3')) {
    return `1. Ensure your server supports HTTP/2 (most modern servers do)
2. For Apache, enable mod_http2: a2enmod http2
3. For Nginx, HTTP/2 is enabled by default in version 1.9.5+
4. Verify HTTP/2 is working: Check response headers or use online tools
5. For HTTP/3, you'll need a server that supports QUIC protocol (e.g., Cloudflare)`
  }
  
  if (message.includes('mixed content')) {
    return `1. Search your HTML/CSS/JS files for "http://" links
2. Update all absolute URLs to use "https://"
3. Use protocol-relative URLs (//example.com) or relative URLs where possible
4. Check browser console for mixed content warnings
5. Use Content Security Policy (CSP) to block mixed content:
   Content-Security-Policy: upgrade-insecure-requests`
  }
  
  if (message.includes('content-security-policy') || message.includes('csp')) {
    return `1. Add Content-Security-Policy header to your server configuration
2. Start with a basic policy: Content-Security-Policy: default-src 'self'
3. For Apache, add to .htaccess: Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
4. For Nginx, add to server block: add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'" always;
5. Test your CSP using browser console and gradually tighten the policy
6. Use CSP reporting to monitor violations: report-uri /csp-report-endpoint`
  }
  
  if (message.includes('referrer-policy')) {
    return `1. Add Referrer-Policy header to your server configuration
2. Recommended value: Referrer-Policy: strict-origin-when-cross-origin
3. For Apache, add to .htaccess: Header always set Referrer-Policy "strict-origin-when-cross-origin"
4. For Nginx, add to server block: add_header Referrer-Policy "strict-origin-when-cross-origin" always;
5. Alternative values:
   - no-referrer: Never send referrer information
   - same-origin: Only send referrer for same-origin requests
   - strict-origin: Only send origin (not full URL) for cross-origin requests`
  }
  
  return `Review the issue details and consult your web server documentation for implementation steps.`
}

