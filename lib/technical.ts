/**
 * Technical SEO Checks
 * 
 * HTTP/2 detection, compression (GZIP/Brotli), and other technical checks
 */

/**
 * Detect HTTP version from response
 * 
 * Note: fetch() API doesn't expose HTTP version directly.
 * We check for HTTP/3 via Alt-Svc header, and infer HTTP/2 vs HTTP/1.1
 * based on server behavior and headers.
 */
export async function checkHttpVersion(url: string, userAgent: string): Promise<'http/1.1' | 'http/2' | 'http/3' | 'unknown'> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': userAgent }
    })

    // Check if HTTP/3 is advertised via Alt-Svc header
    const altSvc = response.headers.get('Alt-Svc')
    if (altSvc && (altSvc.includes('h3=') || altSvc.includes('h3-29='))) {
      return 'http/3'
    }

    // Check for HTTP/2 indicators
    // HTTP/2 servers often send headers that indicate HTTP/2 support
    // Note: fetch() in Node.js doesn't expose HTTP version, so we use heuristics
    
    // Check for HTTP/2 Server Push (rare but definitive)
    const linkHeader = response.headers.get('Link')
    if (linkHeader) {
      // HTTP/2 often uses Link header for server push hints
      // This is a weak indicator, but can help
    }

    // Check server header for HTTP/2 indicators
    const server = response.headers.get('Server') || ''
    
    // Most modern CDNs and servers use HTTP/2 by default
    // If using HTTPS and modern server, likely HTTP/2
    if (url.startsWith('https://')) {
      // For HTTPS sites, HTTP/2 is very common
      // We'll default to http/2 for HTTPS unless we have evidence otherwise
      // This is a heuristic - in production you might want to use a library
      // that can actually detect HTTP/2 (like http2-wrapper)
      return 'http/2' // Assume HTTP/2 for HTTPS (common default)
    }

    // For HTTP sites, likely HTTP/1.1 (HTTP/2 requires HTTPS in practice)
    return 'http/1.1'
  } catch (error) {
    console.error('HTTP version check failed:', error)
    return 'unknown'
  }
}

/**
 * Check if server supports compression (GZIP/Brotli)
 * 
 * Returns compression status from HEAD request
 */
export async function checkCompression(
  url: string,
  userAgent: string
): Promise<{ gzip: boolean; brotli: boolean; uncompressedSize?: number; compressedSize?: number }> {
  try {
    // Fetch with compression headers
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': userAgent,
        'Accept-Encoding': 'gzip, deflate, br' // Request Brotli (br) and GZIP
      }
    })

    const contentEncoding = response.headers.get('Content-Encoding') || ''
    const contentLength = response.headers.get('Content-Length')
    
    const gzip = contentEncoding.includes('gzip') || contentEncoding.includes('deflate')
    const brotli = contentEncoding.includes('br')

    // If we got a Content-Length, we can see compressed size
    const compressedSize = contentLength ? parseInt(contentLength, 10) : undefined

    return {
      gzip,
      brotli,
      compressedSize
    }
  } catch (error) {
    console.error('Compression check failed:', error)
    return { gzip: false, brotli: false }
  }
}

/**
 * Check compression with actual GET request to measure savings
 * 
 * This provides more accurate data but requires downloading the page
 * Use sparingly (e.g., only for homepage or sample pages)
 */
export async function checkCompressionWithSize(
  url: string,
  userAgent: string
): Promise<{ gzip: boolean; brotli: boolean; uncompressedSize: number; compressedSize: number; savingsPercent: number }> {
  try {
    // Fetch without compression (identity)
    const uncompressedResponse = await fetch(url, {
      headers: { 
        'User-Agent': userAgent, 
        'Accept-Encoding': 'identity' // Request no compression
      },
      signal: AbortSignal.timeout(10000)
    })
    const uncompressedBuffer = await uncompressedResponse.arrayBuffer()
    const uncompressedSize = uncompressedBuffer.byteLength

    // Fetch with compression
    const compressedResponse = await fetch(url, {
      headers: { 
        'User-Agent': userAgent, 
        'Accept-Encoding': 'gzip, deflate, br' // Request compression
      },
      signal: AbortSignal.timeout(10000)
    })
    const compressedBuffer = await compressedResponse.arrayBuffer()
    const compressedSize = compressedBuffer.byteLength

    const contentEncoding = compressedResponse.headers.get('Content-Encoding') || ''
    const gzip = contentEncoding.includes('gzip') || contentEncoding.includes('deflate')
    const brotli = contentEncoding.includes('br')

    const savingsPercent = uncompressedSize > 0 
      ? ((uncompressedSize - compressedSize) / uncompressedSize) * 100 
      : 0

    return {
      gzip,
      brotli,
      uncompressedSize,
      compressedSize,
      savingsPercent
    }
  } catch (error) {
    console.error('Compression size check failed:', error)
    return { gzip: false, brotli: false, uncompressedSize: 0, compressedSize: 0, savingsPercent: 0 }
  }
}

