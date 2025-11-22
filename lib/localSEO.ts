/**
 * Local SEO Analysis Module
 * 
 * Analyzes local business SEO factors including:
 * - NAP (Name, Address, Phone) consistency
 * - Local schema markup (LocalBusiness, Organization)
 * - City/service-area landing pages
 * - Local keywords
 * - Google Business Profile indicators
 */

import { PageData } from './types'

/**
 * NAP (Name, Address, Phone) data
 */
export interface NAPData {
  name?: string
  address?: string
  phone?: string
  email?: string
  foundOn: string[] // URLs where NAP was found
  isConsistent: boolean
  variations?: string[] // Different versions found
}

/**
 * Local schema analysis
 */
export interface LocalSchemaAnalysis {
  hasLocalBusiness: boolean
  hasOrganization: boolean
  schemaTypes: string[] // e.g., ['LocalBusiness', 'Restaurant', 'Organization']
  hasAddress: boolean
  hasPhone: boolean
  hasOpeningHours: boolean
  hasGeo: boolean
  hasPriceRange: boolean
  missingFields: string[]
  recommendations: string[]
}

/**
 * City/service-area page detection
 */
export interface ServiceAreaPage {
  url: string
  title?: string
  city?: string
  service?: string
  hasLocalKeywords: boolean
  wordCount: number
}

/**
 * Local keyword analysis
 */
export interface LocalKeywordAnalysis {
  hasLocationKeywords: boolean
  detectedLocations: string[] // Cities, states, neighborhoods
  hasServiceKeywords: boolean
  detectedServices: string[]
  localKeywordCount: number
  recommendations: string[]
}

/**
 * Google Business Profile indicators
 */
export interface GBPIndicators {
  hasGoogleMapsEmbed: boolean
  hasGoogleReviewsWidget: boolean
  hasGBPLink: boolean
  gbpUrl?: string
  recommendations: string[]
}

/**
 * Complete local SEO analysis result
 */
export interface LocalSEOAnalysis {
  nap: NAPData
  schema: LocalSchemaAnalysis
  serviceAreaPages: ServiceAreaPage[]
  keywords: LocalKeywordAnalysis
  gbp: GBPIndicators
  overallScore: number // 0-100
  issues: LocalSEOIssue[]
  recommendations: string[]
}

/**
 * Local SEO issue
 */
export interface LocalSEOIssue {
  severity: 'High' | 'Medium' | 'Low'
  title: string
  description: string
  howToFix: string
  affectedPages?: string[]
}

/**
 * Analyze local SEO for a website
 */
export async function analyzeLocalSEO(
  pages: PageData[],
  rootUrl: string
): Promise<LocalSEOAnalysis> {
  console.log(`[Local SEO] Analyzing ${pages.length} pages for local SEO factors`)
  
  // Extract NAP data
  const nap = extractNAP(pages)
  
  // Analyze local schema
  const schema = analyzeLocalSchema(pages)
  
  // Detect service area pages
  const serviceAreaPages = detectServiceAreaPages(pages)
  
  // Analyze local keywords
  const keywords = analyzeLocalKeywords(pages)
  
  // Check for GBP indicators
  const gbp = detectGBPIndicators(pages)
  
  // Calculate overall score
  const overallScore = calculateLocalSEOScore(nap, schema, serviceAreaPages, keywords, gbp)
  
  // Generate issues
  const issues = generateLocalSEOIssues(nap, schema, serviceAreaPages, keywords, gbp)
  
  // Generate recommendations
  const recommendations = generateLocalSEORecommendations(nap, schema, serviceAreaPages, keywords, gbp)
  
  console.log(`[Local SEO] Analysis complete. Score: ${overallScore}/100, Issues: ${issues.length}`)
  
  return {
    nap,
    schema,
    serviceAreaPages,
    keywords,
    gbp,
    overallScore,
    issues,
    recommendations
  }
}

/**
 * Extract NAP (Name, Address, Phone) from pages
 */
function extractNAP(pages: PageData[]): NAPData {
  const napData: NAPData = {
    foundOn: [],
    isConsistent: true,
    variations: []
  }
  
  const nameVariations = new Set<string>()
  const addressVariations = new Set<string>()
  const phoneVariations = new Set<string>()
  const emailVariations = new Set<string>()
  
  for (const page of pages) {
    if (!page.html) continue
    
    const html = page.html.toLowerCase()
    
    // Extract phone numbers (US format)
    const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
    const phones = html.match(phoneRegex)
    if (phones) {
      phones.forEach(phone => {
        const normalized = phone.replace(/[^\d]/g, '')
        if (normalized.length === 10 || normalized.length === 11) {
          phoneVariations.add(normalized)
          napData.foundOn.push(page.url)
        }
      })
    }
    
    // Extract email addresses
    const emailRegex = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g
    const emails = html.match(emailRegex)
    if (emails) {
      emails.forEach(email => {
        if (!email.includes('example.com') && !email.includes('test.com')) {
          emailVariations.add(email)
          if (!napData.foundOn.includes(page.url)) {
            napData.foundOn.push(page.url)
          }
        }
      })
    }
    
    // Extract addresses (basic pattern - street number + street name)
    const addressRegex = /\d{1,5}\s+[a-z0-9\s,.-]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|boulevard|blvd|circle|cir|place|pl)/gi
    const addresses = html.match(addressRegex)
    if (addresses) {
      addresses.forEach(addr => {
        addressVariations.add(addr.trim())
        if (!napData.foundOn.includes(page.url)) {
          napData.foundOn.push(page.url)
        }
      })
    }
  }
  
  // Set most common values
  if (phoneVariations.size > 0) {
    napData.phone = Array.from(phoneVariations)[0]
    napData.isConsistent = phoneVariations.size === 1
    if (phoneVariations.size > 1) {
      napData.variations = Array.from(phoneVariations)
    }
  }
  
  if (emailVariations.size > 0) {
    napData.email = Array.from(emailVariations)[0]
  }
  
  if (addressVariations.size > 0) {
    napData.address = Array.from(addressVariations)[0]
    if (addressVariations.size > 1 && napData.isConsistent) {
      napData.isConsistent = false
      napData.variations = [...(napData.variations || []), ...Array.from(addressVariations)]
    }
  }
  
  return napData
}

/**
 * Analyze local schema markup
 */
function analyzeLocalSchema(pages: PageData[]): LocalSchemaAnalysis {
  const analysis: LocalSchemaAnalysis = {
    hasLocalBusiness: false,
    hasOrganization: false,
    schemaTypes: [],
    hasAddress: false,
    hasPhone: false,
    hasOpeningHours: false,
    hasGeo: false,
    hasPriceRange: false,
    missingFields: [],
    recommendations: []
  }
  
  for (const page of pages) {
    if (!page.schemaTypes || page.schemaTypes.length === 0) continue
    
    // Check for LocalBusiness or its subtypes
    const localBusinessTypes = [
      'LocalBusiness', 'Restaurant', 'Store', 'AutoRepair', 'HomeAndConstructionBusiness',
      'LodgingBusiness', 'MedicalBusiness', 'ProfessionalService', 'FoodEstablishment'
    ]
    
    for (const type of page.schemaTypes) {
      if (localBusinessTypes.some(lbt => type.includes(lbt))) {
        analysis.hasLocalBusiness = true
        if (!analysis.schemaTypes.includes(type)) {
          analysis.schemaTypes.push(type)
        }
      }
      if (type.includes('Organization')) {
        analysis.hasOrganization = true
        if (!analysis.schemaTypes.includes(type)) {
          analysis.schemaTypes.push(type)
        }
      }
    }
    
    // Check for specific fields in schema (would need to parse JSON-LD)
    if (page.html) {
      const html = page.html.toLowerCase()
      if (html.includes('"address"') || html.includes('"streetaddress"')) {
        analysis.hasAddress = true
      }
      if (html.includes('"telephone"') || html.includes('"phone"')) {
        analysis.hasPhone = true
      }
      if (html.includes('"openinghours"') || html.includes('"hoursavailable"')) {
        analysis.hasOpeningHours = true
      }
      if (html.includes('"geo"') || html.includes('"latitude"')) {
        analysis.hasGeo = true
      }
      if (html.includes('"pricerange"')) {
        analysis.hasPriceRange = true
      }
    }
  }
  
  // Determine missing fields
  if (analysis.hasLocalBusiness) {
    if (!analysis.hasAddress) analysis.missingFields.push('address')
    if (!analysis.hasPhone) analysis.missingFields.push('telephone')
    if (!analysis.hasOpeningHours) analysis.missingFields.push('openingHours')
    if (!analysis.hasGeo) analysis.missingFields.push('geo (latitude/longitude)')
    if (!analysis.hasPriceRange) analysis.missingFields.push('priceRange')
  }
  
  // Generate recommendations
  if (!analysis.hasLocalBusiness && !analysis.hasOrganization) {
    analysis.recommendations.push('Add LocalBusiness schema markup to your homepage')
  }
  if (analysis.hasLocalBusiness && analysis.missingFields.length > 0) {
    analysis.recommendations.push(`Complete your LocalBusiness schema with: ${analysis.missingFields.join(', ')}`)
  }
  if (!analysis.hasGeo) {
    analysis.recommendations.push('Add geo coordinates (latitude/longitude) to help with local search')
  }
  
  return analysis
}

/**
 * Detect service area / city landing pages
 */
function detectServiceAreaPages(pages: PageData[]): ServiceAreaPage[] {
  const servicePages: ServiceAreaPage[] = []
  
  // Common city/location indicators in URLs
  const locationPatterns = [
    /\/(city|location|area|region|neighborhood|district)\//i,
    /\/(cities|locations|areas|regions|neighborhoods|districts)\//i,
    /\/[a-z]+-[a-z]+-(city|location|area)/i, // e.g., /san-francisco-area/
  ]
  
  // Common service keywords
  const serviceKeywords = [
    'service', 'services', 'repair', 'installation', 'maintenance', 'consultation',
    'contractor', 'remodeling', 'renovation', 'construction', 'plumbing', 'electrical',
    'hvac', 'roofing', 'flooring', 'painting', 'landscaping', 'cleaning'
  ]
  
  for (const page of pages) {
    const url = page.url.toLowerCase()
    const title = (page.title || '').toLowerCase()
    
    // Check if URL contains location patterns
    const hasLocationPattern = locationPatterns.some(pattern => pattern.test(url))
    
    // Check if title contains city + service pattern
    const hasServiceKeyword = serviceKeywords.some(keyword => 
      title.includes(keyword) || url.includes(keyword)
    )
    
    // Extract potential city name from title or URL
    let city: string | undefined
    let service: string | undefined
    
    // Simple city detection (would need more sophisticated NLP in production)
    const cityMatch = title.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/)
    if (cityMatch) {
      city = cityMatch[1]
    }
    
    // Service detection
    for (const keyword of serviceKeywords) {
      if (title.includes(keyword) || url.includes(keyword)) {
        service = keyword
        break
      }
    }
    
    if (hasLocationPattern || (city && hasServiceKeyword)) {
      servicePages.push({
        url: page.url,
        title: page.title,
        city,
        service,
        hasLocalKeywords: true,
        wordCount: page.wordCount
      })
    }
  }
  
  return servicePages
}

/**
 * Analyze local keywords
 */
function analyzeLocalKeywords(pages: PageData[]): LocalKeywordAnalysis {
  const analysis: LocalKeywordAnalysis = {
    hasLocationKeywords: false,
    detectedLocations: [],
    hasServiceKeywords: false,
    detectedServices: [],
    localKeywordCount: 0,
    recommendations: []
  }
  
  const locationKeywords = new Set<string>()
  const serviceKeywords = new Set<string>()
  
  // Common location modifiers
  const locationModifiers = ['near me', 'in', 'near', 'around', 'local', 'nearby']
  
  // Common service types
  const commonServices = [
    'plumber', 'electrician', 'contractor', 'roofer', 'painter', 'landscaper',
    'hvac', 'repair', 'installation', 'maintenance', 'remodeling', 'renovation'
  ]
  
  for (const page of pages) {
    const title = (page.title || '').toLowerCase()
    const meta = (page.metaDescription || '').toLowerCase()
    const keywords = page.extractedKeywords || []
    
    // Check for location modifiers
    for (const modifier of locationModifiers) {
      if (title.includes(modifier) || meta.includes(modifier)) {
        analysis.hasLocationKeywords = true
        analysis.localKeywordCount++
      }
    }
    
    // Check for service keywords
    for (const service of commonServices) {
      if (title.includes(service) || meta.includes(service)) {
        analysis.hasServiceKeywords = true
        serviceKeywords.add(service)
        analysis.localKeywordCount++
      }
    }
    
    // Extract city names from keywords (basic pattern)
    for (const keyword of keywords) {
      const words = keyword.split(' ')
      for (const word of words) {
        // Simple capitalized word detection (would need city database in production)
        if (word.length > 3 && word[0] === word[0].toUpperCase()) {
          locationKeywords.add(word)
        }
      }
    }
  }
  
  analysis.detectedLocations = Array.from(locationKeywords)
  analysis.detectedServices = Array.from(serviceKeywords)
  
  // Generate recommendations
  if (!analysis.hasLocationKeywords) {
    analysis.recommendations.push('Add location-based keywords to your titles and meta descriptions (e.g., "in [City]", "near [Neighborhood]")')
  }
  if (!analysis.hasServiceKeywords) {
    analysis.recommendations.push('Include specific service keywords in your content (e.g., "plumber", "electrician", "contractor")')
  }
  if (analysis.detectedLocations.length === 0) {
    analysis.recommendations.push('Create city-specific landing pages for your service areas')
  }
  
  return analysis
}

/**
 * Detect Google Business Profile indicators
 */
function detectGBPIndicators(pages: PageData[]): GBPIndicators {
  const indicators: GBPIndicators = {
    hasGoogleMapsEmbed: false,
    hasGoogleReviewsWidget: false,
    hasGBPLink: false,
    recommendations: []
  }
  
  for (const page of pages) {
    if (!page.html) continue
    
    const html = page.html.toLowerCase()
    
    // Check for Google Maps embed
    if (html.includes('google.com/maps/embed') || html.includes('maps.google.com')) {
      indicators.hasGoogleMapsEmbed = true
    }
    
    // Check for Google reviews widget
    if (html.includes('google.com/maps/place') && html.includes('reviews')) {
      indicators.hasGoogleReviewsWidget = true
    }
    
    // Check for GBP link
    const gbpLinkMatch = html.match(/https?:\/\/(?:www\.)?google\.com\/maps\/place\/([^"'\s]+)/i)
    if (gbpLinkMatch) {
      indicators.hasGBPLink = true
      indicators.gbpUrl = gbpLinkMatch[0]
    }
  }
  
  // Generate recommendations
  if (!indicators.hasGoogleMapsEmbed) {
    indicators.recommendations.push('Embed a Google Map on your contact page to improve local SEO')
  }
  if (!indicators.hasGBPLink) {
    indicators.recommendations.push('Link to your Google Business Profile from your website')
  }
  if (!indicators.hasGoogleReviewsWidget) {
    indicators.recommendations.push('Display Google reviews on your website to build trust and improve local SEO')
  }
  
  return indicators
}

/**
 * Calculate overall local SEO score
 */
function calculateLocalSEOScore(
  nap: NAPData,
  schema: LocalSchemaAnalysis,
  serviceAreaPages: ServiceAreaPage[],
  keywords: LocalKeywordAnalysis,
  gbp: GBPIndicators
): number {
  let score = 0
  
  // NAP consistency (25 points)
  if (nap.phone) score += 10
  if (nap.address) score += 10
  if (nap.isConsistent) score += 5
  
  // Local schema (30 points)
  if (schema.hasLocalBusiness) score += 15
  if (schema.hasAddress) score += 5
  if (schema.hasPhone) score += 5
  if (schema.hasGeo) score += 5
  
  // Service area pages (20 points)
  if (serviceAreaPages.length > 0) score += 10
  if (serviceAreaPages.length >= 3) score += 5
  if (serviceAreaPages.length >= 5) score += 5
  
  // Local keywords (15 points)
  if (keywords.hasLocationKeywords) score += 8
  if (keywords.hasServiceKeywords) score += 7
  
  // GBP indicators (10 points)
  if (gbp.hasGoogleMapsEmbed) score += 4
  if (gbp.hasGBPLink) score += 3
  if (gbp.hasGoogleReviewsWidget) score += 3
  
  return Math.min(score, 100)
}

/**
 * Generate local SEO issues
 */
function generateLocalSEOIssues(
  nap: NAPData,
  schema: LocalSchemaAnalysis,
  serviceAreaPages: ServiceAreaPage[],
  keywords: LocalKeywordAnalysis,
  gbp: GBPIndicators
): LocalSEOIssue[] {
  const issues: LocalSEOIssue[] = []
  
  // NAP issues
  if (!nap.phone) {
    issues.push({
      severity: 'High',
      title: 'Missing phone number',
      description: 'No phone number found on your website. Phone numbers are critical for local SEO and customer contact.',
      howToFix: '1. Add your phone number to your header or footer\n2. Include it on your contact page\n3. Add it to your LocalBusiness schema markup\n4. Make it clickable (tel: link) for mobile users'
    })
  }
  
  if (!nap.address) {
    issues.push({
      severity: 'High',
      title: 'Missing business address',
      description: 'No physical address found on your website. Addresses help with local search rankings.',
      howToFix: '1. Add your full business address to your footer\n2. Include it on your contact page\n3. Add it to your LocalBusiness schema markup\n4. Embed a Google Map showing your location'
    })
  }
  
  if (!nap.isConsistent && nap.variations && nap.variations.length > 1) {
    issues.push({
      severity: 'Medium',
      title: 'Inconsistent NAP data',
      description: `Found ${nap.variations.length} different versions of your business information across your website.`,
      howToFix: '1. Standardize your business name, address, and phone number\n2. Use the exact same format everywhere\n3. Update all pages to match your Google Business Profile\n4. Check footer, contact page, and schema markup for consistency',
      affectedPages: nap.foundOn
    })
  }
  
  // Schema issues
  if (!schema.hasLocalBusiness && !schema.hasOrganization) {
    issues.push({
      severity: 'High',
      title: 'Missing LocalBusiness schema markup',
      description: 'No LocalBusiness or Organization schema found. Schema markup helps search engines understand your business.',
      howToFix: '1. Add LocalBusiness JSON-LD schema to your homepage\n2. Include: name, address, phone, openingHours, geo coordinates\n3. Use Google\'s Structured Data Testing Tool to validate\n4. Consider using a more specific type (e.g., Restaurant, AutoRepair)'
    })
  }
  
  if (schema.hasLocalBusiness && schema.missingFields.length > 0) {
    issues.push({
      severity: 'Medium',
      title: 'Incomplete LocalBusiness schema',
      description: `Your LocalBusiness schema is missing: ${schema.missingFields.join(', ')}`,
      howToFix: `1. Add the missing fields to your schema markup\n2. Essential fields: ${schema.missingFields.join(', ')}\n3. Use Google's Structured Data Testing Tool to validate\n4. Match your schema data with your Google Business Profile`
    })
  }
  
  // Service area pages
  if (serviceAreaPages.length === 0) {
    issues.push({
      severity: 'Medium',
      title: 'No city/service-area landing pages',
      description: 'No dedicated pages found for specific cities or service areas. These pages help rank for local searches.',
      howToFix: '1. Create dedicated pages for each city you serve\n2. Include city name in title, H1, and throughout content\n3. Add local landmarks, neighborhoods, and service details\n4. Aim for 500+ words of unique content per page'
    })
  }
  
  // Keyword issues
  if (!keywords.hasLocationKeywords) {
    issues.push({
      severity: 'Medium',
      title: 'Missing location keywords',
      description: 'Your titles and meta descriptions don\'t include location-based keywords.',
      howToFix: '1. Add city/region names to your page titles\n2. Include "in [City]" or "near [Neighborhood]" in meta descriptions\n3. Use location modifiers like "local", "near me", "nearby"\n4. Example: "Best Plumber in Denver | 24/7 Emergency Service"'
    })
  }
  
  // GBP issues
  if (!gbp.hasGoogleMapsEmbed) {
    issues.push({
      severity: 'Low',
      title: 'No Google Maps embed',
      description: 'No Google Maps embed found on your website. Maps help visitors find you and improve local SEO.',
      howToFix: '1. Go to Google Maps and search for your business\n2. Click "Share" → "Embed a map"\n3. Copy the iframe code\n4. Add it to your contact page\n5. Make sure it shows your exact business location'
    })
  }
  
  return issues
}

/**
 * Generate local SEO recommendations
 */
function generateLocalSEORecommendations(
  nap: NAPData,
  schema: LocalSchemaAnalysis,
  serviceAreaPages: ServiceAreaPage[],
  keywords: LocalKeywordAnalysis,
  gbp: GBPIndicators
): string[] {
  const recommendations: string[] = []
  
  // Combine all recommendations from sub-analyses
  recommendations.push(...schema.recommendations)
  recommendations.push(...keywords.recommendations)
  recommendations.push(...gbp.recommendations)
  
  // Add general recommendations
  if (serviceAreaPages.length < 3) {
    recommendations.push('Create more city-specific landing pages to capture local search traffic')
  }
  
  if (!gbp.hasGBPLink) {
    recommendations.push('Claim and optimize your Google Business Profile listing')
  }
  
  recommendations.push('Ensure your NAP (Name, Address, Phone) is consistent across all online directories')
  recommendations.push('Encourage customers to leave Google reviews to improve local rankings')
  recommendations.push('Add your business to local directories (Yelp, Yellow Pages, industry-specific directories)')
  
  return recommendations
}

