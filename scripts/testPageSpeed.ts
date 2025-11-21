/**
 * Test script to verify PageSpeed Insights API key is configured correctly
 * 
 * Usage: npm run test-pagespeed
 * or: tsx scripts/testPageSpeed.ts
 */

import { loadEnvConfig } from '@next/env'
import { fetchPageSpeedInsights } from '../lib/pagespeed'

// Load environment variables from .env.local
const projectDir = process.cwd()
loadEnvConfig(projectDir)

async function testPageSpeed() {
  console.log('🧪 Testing PageSpeed Insights API...\n')

  // Check if API key is configured
  const apiKey = process.env.PAGESPEED_INSIGHTS_API_KEY

  if (!apiKey) {
    console.error('❌ Error: PAGESPEED_INSIGHTS_API_KEY not found in environment variables')
    console.log('\n💡 Solution:')
    console.log('1. Create or edit .env.local in your project root')
    console.log('2. Add: PAGESPEED_INSIGHTS_API_KEY=your_key_here')
    console.log('3. Restart your dev server')
    console.log('\n📚 See PAGESPEED_API_SETUP.md for detailed setup instructions')
    process.exit(1)
  }

  if (apiKey.length < 30) {
    console.error('❌ Error: API key looks invalid (too short)')
    console.log('   Make sure you copied the full API key from Google Cloud Console')
    process.exit(1)
  }

  console.log('✅ API key found in environment')
  console.log(`   Key preview: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`)

  // Test with a simple URL
  const testUrl = 'https://example.com'
  console.log(`📡 Fetching PageSpeed data for: ${testUrl}`)
  console.log('   This may take 10-30 seconds...\n')

  try {
    const result = await fetchPageSpeedInsights(testUrl)

    if (!result) {
      console.error('❌ Error: PageSpeed API returned no data')
      console.log('\n💡 Possible issues:')
      console.log('1. API key is invalid or restricted incorrectly')
      console.log('2. PageSpeed Insights API is not enabled in Google Cloud Console')
      console.log('3. API quota exceeded (check Google Cloud Console)')
      process.exit(1)
    }

    console.log('✅ PageSpeed API is working!\n')
    console.log('📊 Mobile Metrics:')
    console.log(`   LCP: ${Math.round(result.mobile.lcp)}ms`)
    console.log(`   FCP: ${Math.round(result.mobile.fcp)}ms`)
    console.log(`   CLS: ${result.mobile.cls.toFixed(3)}`)
    console.log(`   INP: ${Math.round(result.mobile.inp)}ms`)
    console.log(`   TTFB: ${Math.round(result.mobile.ttfb)}ms`)
    console.log(`   Opportunities: ${result.mobile.opportunities.length}`)

    console.log('\n📊 Desktop Metrics:')
    console.log(`   LCP: ${Math.round(result.desktop.lcp)}ms`)
    console.log(`   FCP: ${Math.round(result.desktop.fcp)}ms`)
    console.log(`   CLS: ${result.desktop.cls.toFixed(3)}`)
    console.log(`   INP: ${Math.round(result.desktop.inp)}ms`)
    console.log(`   TTFB: ${Math.round(result.desktop.ttfb)}ms`)
    console.log(`   Opportunities: ${result.desktop.opportunities.length}`)

    if (result.mobile.opportunities.length > 0) {
      console.log('\n🎯 Top Mobile Opportunity:')
      const topOpp = result.mobile.opportunities[0]
      console.log(`   ${topOpp.title}`)
      console.log(`   Potential savings: ${Math.round(topOpp.savings)}ms`)
    }

    console.log('\n✅ All tests passed! Your PageSpeed API is configured correctly.')
    console.log('   You can now run full audits with PageSpeed Insights data.\n')
  } catch (error) {
    console.error('❌ Error testing PageSpeed API:')
    if (error instanceof Error) {
      console.error(`   ${error.message}`)
    } else {
      console.error(`   ${error}`)
    }
    console.log('\n💡 Troubleshooting:')
    console.log('1. Check API key is correct in .env.local')
    console.log('2. Verify PageSpeed Insights API is enabled in Google Cloud Console')
    console.log('3. Check API restrictions allow your usage')
    console.log('4. See PAGESPEED_API_SETUP.md for detailed setup')
    process.exit(1)
  }
}

// Run test
testPageSpeed()

