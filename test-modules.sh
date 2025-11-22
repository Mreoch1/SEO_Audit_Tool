#!/bin/bash
# SEO Audit Engine - Quick Integration Test
# Tests new modules independently before full integration

echo "🔍 SEO Audit Engine - Module Tests"
echo "=================================="
echo ""

# Test 1: URL Normalizer
echo "✓ Testing URL Normalizer..."
cat > /tmp/test-url-normalizer.ts << 'EOF'
import { normalizeUrl, getRootDomain, isSameDomain, canonicalizeUrl } from './lib/urlNormalizer'

// Test URL normalization
console.log('Test 1: URL Normalization')
console.log('  Input: nasa.gov')
console.log('  Output:', normalizeUrl('nasa.gov'))
console.log('')

// Test root domain extraction
console.log('Test 2: Root Domain')
console.log('  www.nasa.gov →', getRootDomain('www.nasa.gov'))
console.log('  subdomain.nasa.gov →', getRootDomain('subdomain.nasa.gov'))
console.log('')

// Test domain matching
console.log('Test 3: Domain Matching')
console.log('  nasa.gov == www.nasa.gov?', isSameDomain('nasa.gov', 'www.nasa.gov'))
console.log('  nasa.gov == google.com?', isSameDomain('nasa.gov', 'google.com'))
console.log('')

// Test canonicalization
const context = {
  preferredHostname: 'www.nasa.gov',
  preferredProtocol: 'https:',
  rootDomain: 'nasa.gov'
}
console.log('Test 4: Canonicalization')
console.log('  http://nasa.gov/page/ →')
console.log('  ', canonicalizeUrl('http://nasa.gov/page/', context))
EOF

echo "  Created test file"
echo ""

# Test 2: Title/Meta Extractor
echo "✓ Testing Title/Meta Extractor..."
cat > /tmp/test-title-extractor.ts << 'EOF'
import { extractTitle, extractMetaDescription, isTitleTooShort } from './lib/titleMetaExtractor'

const html = `
<!DOCTYPE html>
<html>
<head>
  <title>NASA - National Aeronautics and Space Administration</title>
  <meta name="description" content="NASA.gov brings you the latest news, images and videos from America's space agency, pioneering the future in space exploration, scientific discovery and aeronautics research.">
</head>
<body>
  <h1>Welcome to NASA</h1>
</body>
</html>
`

console.log('Test: Title Extraction')
const titleData = extractTitle(html)
if (titleData) {
  console.log('  Title:', titleData.title)
  console.log('  Length:', titleData.length, 'characters')
  console.log('  Pixel Width:', titleData.pixelWidth, 'px')
  console.log('  Too Short?', isTitleTooShort(titleData))
} else {
  console.log('  ERROR: No title found')
}
console.log('')

console.log('Test: Meta Description')
const metaData = extractMetaDescription(html)
if (metaData) {
  console.log('  Length:', metaData.length, 'characters')
  console.log('  Preview:', metaData.description.substring(0, 50) + '...')
} else {
  console.log('  ERROR: No meta description found')
}
EOF

echo "  Created test file"
echo ""

# Test 3: Performance Validator
echo "✓ Testing Performance Validator..."
cat > /tmp/test-performance.ts << 'EOF'
import { validatePerformanceMetrics, getPerformanceRating } from './lib/performanceValidator'

console.log('Test 1: Valid Metrics')
const valid = validatePerformanceMetrics({
  lcp: 2400,
  fcp: 1800,
  cls: 0.05,
  ttfb: 600
})
console.log('  Warnings:', valid.warnings.length)
console.log('  LCP Rating:', getPerformanceRating('lcp', valid.lcp!).label)
console.log('')

console.log('Test 2: Invalid Metrics (LCP 30s, FCP 2.5s)')
const invalid = validatePerformanceMetrics({
  lcp: 30000,
  fcp: 2500,
  cls: 0.1,
  ttfb: 500
})
console.log('  Original LCP:', 30000, 'ms')
console.log('  Validated LCP:', invalid.lcp, 'ms')
console.log('  Warnings:', invalid.warnings)
console.log('')

console.log('Test 3: Inconsistent Order (LCP < FCP)')
const inconsistent = validatePerformanceMetrics({
  lcp: 1500,
  fcp: 2000,
  ttfb: 300
})
console.log('  Original LCP:', 1500, '< FCP:', 2000)
console.log('  Corrected LCP:', inconsistent.lcp)
console.log('  Warnings:', inconsistent.warnings)
EOF

echo "  Created test file"
echo ""

# Test 4: Scoring
echo "✓ Testing Scoring Engine..."
cat > /tmp/test-scoring.ts << 'EOF'
import { calculateContentScore, calculateAllScores } from './lib/scoring'

// Mock data with poor readability
const mockPages = [
  {
    url: 'https://example.com',
    wordCount: 1500,
    h1Text: ['Main Heading'],
    h2Count: 5,
    readability: {
      fleschScore: 10, // Very difficult
      averageSentenceLength: 120 // Way too long
    }
  }
]

const mockIssues: any[] = []
const mockSiteWide = { robotsTxtExists: true, sitemapExists: true }

console.log('Test: Content Score with Poor Readability')
console.log('  Flesch Score: 10 (Very Difficult)')
console.log('  Avg Sentence: 120 words')
console.log('')

const contentScore = calculateContentScore(mockIssues, mockPages as any)
console.log('  Content Score:', contentScore, '/ 100')
console.log('  Expected: 50-70 (readability penalty applied)')
console.log('')

const allScores = calculateAllScores(mockIssues, mockPages as any, mockSiteWide)
console.log('  All Category Scores:')
console.log('    Technical:', allScores.technical)
console.log('    On-Page:', allScores.onPage)
console.log('    Content:', allScores.content, '← Should reflect readability')
console.log('    Performance:', allScores.performance)
console.log('    Accessibility:', allScores.accessibility)
EOF

echo "  Created test file"
echo ""

# Test 5: Real Competitor Analysis
echo "✓ Testing Competitor Analysis..."
cat > /tmp/test-competitor.ts << 'EOF'
import { analyzeCompetitors, generateFallbackKeywordSuggestions } from './lib/realCompetitorAnalysis'

console.log('Test 1: Fallback Keyword Suggestions')
const siteKeywords = ['space exploration', 'mars mission', 'rocket launch']
const fallback = generateFallbackKeywordSuggestions(siteKeywords)
console.log('  Site Keywords:', siteKeywords)
console.log('  Suggestions:', fallback.slice(0, 5))
console.log('  Note: These are pattern-based fallbacks only')
console.log('')

console.log('Test 2: Real Competitor Analysis')
console.log('  To test real analysis, provide competitor URLs:')
console.log('  Example: https://www.esa.int, https://www.jaxa.jp')
console.log('  This will fetch and extract real keywords')
EOF

echo "  Created test file"
echo ""

# Summary
echo "=================================="
echo "✅ All test files created in /tmp/"
echo ""
echo "To run tests:"
echo "  1. Copy test files to your project"
echo "  2. Run: npx tsx /tmp/test-url-normalizer.ts"
echo "  3. Run: npx tsx /tmp/test-title-extractor.ts"
echo "  4. Run: npx tsx /tmp/test-performance.ts"
echo "  5. Run: npx tsx /tmp/test-scoring.ts"
echo "  6. Run: npx tsx /tmp/test-competitor.ts"
echo ""
echo "Or run all at once:"
echo "  npm test (if configured)"
echo ""
echo "Next: Integrate modules into lib/seoAudit.ts"
echo "See: IMPLEMENTATION_FIXES.md for integration checklist"

