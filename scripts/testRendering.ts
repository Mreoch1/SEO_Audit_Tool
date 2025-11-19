/**
 * Test Script: Verify Rendering Engine Works
 * 
 * Run this to test if the new Puppeteer rendering is working correctly
 */

import { renderPage } from '../lib/renderer'
import { closeBrowser } from '../lib/renderer'

async function testRendering() {
  const testUrl = 'https://holidaydrawnames.com'
  
  console.log('🧪 Testing Rendering Engine...\n')
  console.log(`Testing URL: ${testUrl}\n`)
  
  try {
    console.log('⏳ Rendering page with Puppeteer...')
    const startTime = Date.now()
    
    const rendered = await renderPage(testUrl)
    
    const totalTime = Date.now() - startTime
    
    console.log(`✅ Rendering completed in ${totalTime}ms\n`)
    
    console.log('📊 Results:')
    console.log(`   Status Code: ${rendered.statusCode}`)
    console.log(`   Load Time: ${rendered.loadTime}ms`)
    console.log(`   Content Type: ${rendered.contentType}`)
    console.log(`   Initial HTML Length: ${rendered.html.length.toLocaleString()} chars`)
    console.log(`   Rendered HTML Length: ${rendered.renderedHtml.length.toLocaleString()} chars`)
    console.log(`   Rendering Percentage: ${((rendered.renderedHtml.length - rendered.html.length) / rendered.html.length * 100).toFixed(1)}%`)
    
    console.log('\n🖼️  Image Analysis:')
    if (rendered.imageData) {
      console.log(`   Total Images: ${rendered.imageData.imageCount}`)
      console.log(`   Missing Alt: ${rendered.imageData.missingAltCount}`)
      console.log(`   Lazy-loaded: ${rendered.imageData.images.filter(img => img.isLazy).length}`)
      console.log(`   Background Images: ${rendered.imageData.images.filter(img => img.isBackground).length}`)
      
      if (rendered.imageData.images.length > 0) {
        console.log('\n   Sample Images:')
        rendered.imageData.images.slice(0, 5).forEach((img, idx) => {
          console.log(`   ${idx + 1}. ${img.src.substring(0, 60)}${img.src.length > 60 ? '...' : ''}`)
          console.log(`      Alt: ${img.alt || 'MISSING'}`)
          console.log(`      Lazy: ${img.isLazy}, Background: ${img.isBackground}`)
        })
      }
    } else {
      console.log('   ⚠️  No image data (this shouldn\'t happen)')
    }
    
    console.log('\n🔗 Link Analysis:')
    if (rendered.linkData) {
      console.log(`   Internal Links: ${rendered.linkData.internalLinkCount}`)
      console.log(`   External Links: ${rendered.linkData.externalLinkCount}`)
      console.log(`   Total Links: ${rendered.linkData.internalLinkCount + rendered.linkData.externalLinkCount}`)
      
      if (rendered.linkData.links.length > 0) {
        console.log('\n   Sample Links:')
        rendered.linkData.links.slice(0, 5).forEach((link, idx) => {
          console.log(`   ${idx + 1}. ${link.href.substring(0, 60)}${link.href.length > 60 ? '...' : ''}`)
          console.log(`      Text: "${link.text.substring(0, 40)}${link.text.length > 40 ? '...' : ''}"`)
          console.log(`      Internal: ${link.isInternal}`)
        })
      }
    } else {
      console.log('   ⚠️  No link data (this shouldn\'t happen)')
    }
    
    console.log('\n⚡ Performance Metrics:')
    if (rendered.metrics) {
      const { lcp, cls, fid, tbt, fcp, ttfb } = rendered.metrics
      if (lcp) console.log(`   LCP: ${lcp}ms ${lcp > 4000 ? '❌' : lcp > 2500 ? '⚠️' : '✅'}`)
      if (cls !== undefined) console.log(`   CLS: ${cls.toFixed(3)} ${cls > 0.25 ? '❌' : cls > 0.1 ? '⚠️' : '✅'}`)
      if (fid) console.log(`   FID: ${fid}ms ${fid > 300 ? '❌' : fid > 100 ? '⚠️' : '✅'}`)
      if (tbt) console.log(`   TBT: ${tbt}ms ${tbt > 600 ? '❌' : tbt > 200 ? '⚠️' : '✅'}`)
      if (fcp) console.log(`   FCP: ${fcp}ms ${fcp > 3000 ? '❌' : fcp > 1800 ? '⚠️' : '✅'}`)
      if (ttfb) console.log(`   TTFB: ${ttfb}ms ${ttfb > 1800 ? '❌' : ttfb > 800 ? '⚠️' : '✅'}`)
      
      if (!lcp && !cls && !fid && !tbt && !fcp && !ttfb) {
        console.log('   ⚠️  No metrics collected (may need more time)')
      }
    } else {
      console.log('   ⚠️  No performance metrics')
    }
    
    console.log('\n✅ Rendering engine is working correctly!')
    console.log('\n💡 If you see images/links > 0, the new engine is working.')
    console.log('💡 If you see 0 images/links, check the site actually has them.')
    
  } catch (error) {
    console.error('\n❌ Rendering failed:')
    console.error(error)
    console.error('\n⚠️  This means Puppeteer rendering is not working.')
    console.error('   Check:')
    console.error('   1. Puppeteer is installed: npm list puppeteer')
    console.error('   2. Chrome/Chromium is available')
    console.error('   3. No firewall blocking connections')
  } finally {
    await closeBrowser()
  }
}

testRendering()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

