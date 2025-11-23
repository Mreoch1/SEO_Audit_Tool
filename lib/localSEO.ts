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
 * Local schema analysis (Enhanced for Agency tier)
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
  hasReviewMarkup: boolean // NEW: Review schema detection
  hasDrivingDirections: boolean // NEW: Driving directions schema
  geoCoordinates?: { latitude?: number; longitude?: number } // NEW: Actual geo coordinates
  openingHoursSchema?: string[] // NEW: Parsed opening hours from schema
  reviewCount?: number // NEW: Number of reviews found
  reviewRating?: number // NEW: Average rating if available
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
  hasOpeningHours: boolean
  openingHours?: string
  recommendations: string[]
}

/**
 * Local citation data
 */
export interface LocalCitation {
  platform: string // e.g., 'Yelp', 'Yellow Pages', 'Google Business Profile'
  url?: string
  hasNAP: boolean
  isConsistent: boolean
}

/**
 * NAP consistency analysis
 */
export interface NAPConsistency {
  consistencyScore: number // 0-100
  nameVariations: string[]
  addressVariations: string[]
  phoneVariations: string[]
  inconsistentPages: string[]
  recommendations: string[]
}

/**
 * Complete local SEO analysis result
 */
export interface LocalSEOAnalysis {
  nap: NAPData
  napConsistency: NAPConsistency // NEW: Agency tier - NAP consistency analysis
  schema: LocalSchemaAnalysis
  serviceAreaPages: ServiceAreaPage[]
  keywords: LocalKeywordAnalysis
  gbp: GBPIndicators
  citations: LocalCitation[] // NEW: Agency tier - Local citations audit
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
  
  // NEW: Agency tier - NAP consistency analysis
  const napConsistency = analyzeNAPConsistency(pages, nap)
  
  // Analyze local schema
  const schema = analyzeLocalSchema(pages)
  
  // Detect service area pages
  const serviceAreaPages = detectServiceAreaPages(pages)
  
  // Analyze local keywords
  const keywords = analyzeLocalKeywords(pages)
  
  // Check for GBP indicators (enhanced for Agency tier)
  const gbp = detectGBPIndicators(pages)
  
  // NEW: Agency tier - Local citations audit
  const citations = await auditLocalCitations(pages, rootUrl)
  
  // Calculate overall score
  const overallScore = calculateLocalSEOScore(nap, napConsistency, schema, serviceAreaPages, keywords, gbp, citations)
  
  // Generate issues
  const issues = generateLocalSEOIssues(nap, napConsistency, schema, serviceAreaPages, keywords, gbp, citations)
  
  // Generate recommendations
  const recommendations = generateLocalSEORecommendations(nap, napConsistency, schema, serviceAreaPages, keywords, gbp, citations)
  
  console.log(`[Local SEO] Analysis complete. Score: ${overallScore}/100, Issues: ${issues.length}`)
  
  return {
    nap,
    napConsistency,
    schema,
    serviceAreaPages,
    keywords,
    gbp,
    citations,
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
    // Combine available text fields for NAP extraction
    const pageText = `${page.title || ''} ${page.metaDescription || ''} ${(page.h1Text || []).join(' ')}`.toLowerCase()
    
    if (!pageText.trim()) continue
    
    // Extract phone numbers (US format)
    const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
    const phones = pageText.match(phoneRegex)
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
    const emails = pageText.match(emailRegex)
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
    const addresses = pageText.match(addressRegex)
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
 * Analyze local schema markup (Enhanced for Agency tier)
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
    hasReviewMarkup: false,
    hasDrivingDirections: false,
    openingHoursSchema: [],
    missingFields: [],
    recommendations: []
  }
  
  const allSchemaTypes = new Set<string>()
  const reviewRatings: number[] = []
  let reviewCount = 0
  
  for (const page of pages) {
    if (!page.schemaTypes || page.schemaTypes.length === 0) continue
    
    // Check for LocalBusiness or its subtypes
    const localBusinessTypes = [
      'LocalBusiness', 'Restaurant', 'Store', 'AutoRepair', 'HomeAndConstructionBusiness',
      'LodgingBusiness', 'MedicalBusiness', 'ProfessionalService', 'FoodEstablishment',
      'Plumber', 'Electrician', 'GeneralContractor', 'HVACBusiness', 'RoofingContractor'
    ]
    
    for (const type of page.schemaTypes) {
      allSchemaTypes.add(type)
      
      if (localBusinessTypes.some(lbt => type.includes(lbt))) {
        analysis.hasLocalBusiness = true
      }
      if (type.includes('Organization')) {
        analysis.hasOrganization = true
      }
      
      // NEW: Detect Review schema (Agency tier)
      if (type.includes('Review') || type.includes('AggregateRating')) {
        analysis.hasReviewMarkup = true
        reviewCount++
      }
    }
    
    // Check for specific fields in schema (using schemaAnalysis if available)
    if (page.schemaAnalysis) {
      const identityData = (page.schemaAnalysis as any).identityData
      
      // Check for address in identity data
      if (identityData?.address) {
        analysis.hasAddress = true
      }
      
      // Check for phone in identity data
      if (identityData?.phone || identityData?.telephone) {
        analysis.hasPhone = true
      }
      
      // NEW: Check for geo coordinates in identity data (Agency tier)
      if (identityData?.geo) {
        analysis.hasGeo = true
        // Try to extract coordinates
        if (typeof identityData.geo === 'object') {
          if (identityData.geo.latitude && identityData.geo.longitude) {
            analysis.geoCoordinates = {
              latitude: parseFloat(identityData.geo.latitude),
              longitude: parseFloat(identityData.geo.longitude)
            }
          } else if (identityData.geo['@type'] === 'GeoCoordinates') {
            analysis.geoCoordinates = {
              latitude: parseFloat(identityData.geo.latitude || '0'),
              longitude: parseFloat(identityData.geo.longitude || '0')
            }
          }
        }
      }
    }
    
    // Check page text for additional indicators
    const pageText = `${page.title || ''} ${page.metaDescription || ''} ${(page.h1Text || []).join(' ')}`.toLowerCase()
    
    // Check for address indicators in text
    if (pageText.includes('address') || pageText.includes('street') || pageText.includes('avenue') || pageText.includes('road')) {
      analysis.hasAddress = true
    }
    
    // Check for phone indicators in text
    if (pageText.includes('phone') || pageText.includes('telephone') || pageText.includes('call us')) {
      analysis.hasPhone = true
    }
    
    // NEW: Enhanced opening hours detection (Agency tier)
    if (pageText.includes('hours') || pageText.includes('open') || pageText.includes('monday') || pageText.includes('tuesday')) {
      analysis.hasOpeningHours = true
    }
    
    // NEW: Detect driving directions (Agency tier)
    if (pageText.includes('directions') || pageText.includes('how to get here') || pageText.includes('find us') || page.url.includes('directions')) {
      analysis.hasDrivingDirections = true
    }
    
    // NEW: Check for price range indicators
    if (pageText.includes('price') || pageText.includes('$') || pageText.includes('cost')) {
      // Price range might be present, but we'd need schema to confirm
    }
  }
  
  analysis.schemaTypes = Array.from(allSchemaTypes)
  analysis.reviewCount = reviewCount
  
  // Calculate average rating if reviews found
  if (reviewRatings.length > 0) {
    analysis.reviewRating = reviewRatings.reduce((sum, r) => sum + r, 0) / reviewRatings.length
  }
  
  // Determine missing fields
  if (analysis.hasLocalBusiness) {
    if (!analysis.hasAddress) analysis.missingFields.push('address')
    if (!analysis.hasPhone) analysis.missingFields.push('telephone')
    if (!analysis.hasOpeningHours) analysis.missingFields.push('openingHours')
    if (!analysis.hasGeo) analysis.missingFields.push('geo (latitude/longitude)')
    if (!analysis.hasPriceRange) analysis.missingFields.push('priceRange')
    if (!analysis.hasReviewMarkup) analysis.missingFields.push('review markup (AggregateRating)')
    if (!analysis.hasDrivingDirections) analysis.missingFields.push('driving directions')
  }
  
  // Generate recommendations
  if (!analysis.hasLocalBusiness && !analysis.hasOrganization) {
    analysis.recommendations.push('Add LocalBusiness schema markup to your homepage')
  }
  if (analysis.hasLocalBusiness && analysis.missingFields.length > 0) {
    analysis.recommendations.push(`Complete your LocalBusiness schema with: ${analysis.missingFields.join(', ')}`)
  }
  if (!analysis.hasGeo) {
    analysis.recommendations.push('Add geo coordinates (latitude/longitude) to your LocalBusiness schema to help with local search')
  }
  if (!analysis.hasReviewMarkup) {
    analysis.recommendations.push('Add AggregateRating schema markup to display review ratings in search results')
  }
  if (!analysis.hasDrivingDirections) {
    analysis.recommendations.push('Add a "Get Directions" link or driving directions schema to help customers find you')
  }
  if (!analysis.hasOpeningHours || (analysis.openingHoursSchema && analysis.openingHoursSchema.length === 0)) {
    analysis.recommendations.push('Add openingHours to your LocalBusiness schema in the proper format (e.g., "Mo-Fr 09:00-17:00")')
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
 * Detect Google Business Profile indicators (Enhanced for Agency tier)
 */
function detectGBPIndicators(pages: PageData[]): GBPIndicators {
  const indicators: GBPIndicators = {
    hasGoogleMapsEmbed: false,
    hasGoogleReviewsWidget: false,
    hasGBPLink: false,
    hasOpeningHours: false,
    recommendations: []
  }
  
  for (const page of pages) {
    // Combine available text fields for GBP detection
    const pageText = `${page.title || ''} ${page.metaDescription || ''} ${(page.h1Text || []).join(' ')} ${page.url}`.toLowerCase()
    
    if (!pageText.trim()) continue
    
    // Check for Google Maps embed (check URL and text)
    if (pageText.includes('google.com/maps/embed') || pageText.includes('maps.google.com') || page.url.includes('maps')) {
      indicators.hasGoogleMapsEmbed = true
    }
    
    // Check for Google reviews widget
    if (pageText.includes('google.com/maps/place') && pageText.includes('reviews')) {
      indicators.hasGoogleReviewsWidget = true
    }
    
    // Check for GBP link
    const gbpLinkMatch = pageText.match(/https?:\/\/(?:www\.)?google\.com\/maps\/place\/([^"'\s]+)/i)
    if (gbpLinkMatch) {
      indicators.hasGBPLink = true
      indicators.gbpUrl = gbpLinkMatch[0]
    }
    
    // NEW: Check for opening hours (in text)
    if (pageText.includes('opening hours') || pageText.includes('hours:') || (pageText.includes('open') && pageText.includes('monday'))) {
      indicators.hasOpeningHours = true
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
  if (!indicators.hasOpeningHours) {
    indicators.recommendations.push('Display your business hours prominently on your website and in schema markup')
  }
  
  return indicators
}

/**
 * Calculate overall local SEO score (Enhanced for Agency tier)
 * CRITICAL FIX: NAP consistency must be 0 if phone/address missing
 */
function calculateLocalSEOScore(
  nap: NAPData,
  napConsistency: NAPConsistency,
  schema: LocalSchemaAnalysis,
  serviceAreaPages: ServiceAreaPage[],
  keywords: LocalKeywordAnalysis,
  gbp: GBPIndicators,
  citations: LocalCitation[]
): number {
  let score = 0
  
  // CRITICAL: NAP consistency (25 points) - Cannot be consistent if missing
  // If phone OR address is missing, NAP score = 0
  if (!nap.phone || !nap.address) {
    // Missing NAP data = 0 points for NAP section
    score += 0
  } else {
    // Both exist - check consistency
    if (nap.phone) score += 8
    if (nap.address) score += 8
    // Only apply consistency score if NAP data exists
    if (napConsistency.consistencyScore > 0) {
      score += (napConsistency.consistencyScore / 100) * 9 // Weighted by consistency
    }
  }
  
  // Local schema (35 points) - Enhanced for Agency tier
  if (schema.hasLocalBusiness) score += 15
  if (schema.hasAddress) score += 5
  if (schema.hasPhone) score += 5
  if (schema.hasGeo) score += 5
  // NEW: Review markup (3 points)
  if (schema.hasReviewMarkup) score += 3
  // NEW: Driving directions (2 points)
  if (schema.hasDrivingDirections) score += 2
  
  // Service area pages (20 points)
  if (serviceAreaPages.length > 0) score += 10
  if (serviceAreaPages.length >= 3) score += 5
  if (serviceAreaPages.length >= 5) score += 5
  
  // Local keywords (15 points)
  if (keywords.hasLocationKeywords) score += 8
  if (keywords.hasServiceKeywords) score += 7
  
  // GBP indicators (10 points) - Enhanced
  if (gbp.hasGoogleMapsEmbed) score += 3
  if (gbp.hasGBPLink) score += 3
  if (gbp.hasGoogleReviewsWidget) score += 2
  if (gbp.hasOpeningHours) score += 2
  
  // NEW: Local citations (5 points for Agency tier)
  const consistentCitations = citations.filter(c => c.isConsistent).length
  if (citations.length > 0) {
    score += Math.min(5, (consistentCitations / citations.length) * 5)
  }
  
  return Math.min(score, 100)
}

/**
 * Generate local SEO issues (Enhanced for Agency tier)
 */
function generateLocalSEOIssues(
  nap: NAPData,
  napConsistency: NAPConsistency,
  schema: LocalSchemaAnalysis,
  serviceAreaPages: ServiceAreaPage[],
  keywords: LocalKeywordAnalysis,
  gbp: GBPIndicators,
  citations: LocalCitation[]
): LocalSEOIssue[] {
  const issues: LocalSEOIssue[] = []
  
  // NAP issues
  if (!nap.phone) {
    issues.push({
      severity: 'High',
      title: 'Missing phone number',
      description: 'No phone number found on your website. Phone numbers are critical for local SEO and customer contact. Note: This check is most relevant for local businesses. If your site is not location-based, you can ignore this.',
      howToFix: '1. Add your phone number to your header or footer\n2. Include it on your contact page\n3. Add it to your LocalBusiness schema markup\n4. Make it clickable (tel: link) for mobile users'
    })
  }
  
  if (!nap.address) {
    issues.push({
      severity: 'High',
      title: 'Missing business address',
      description: 'No physical address found on your website. Addresses help with local search rankings. Note: This check is most relevant for local businesses. If your site is not location-based, you can ignore this.',
      howToFix: '1. Add your full business address to your footer\n2. Include it on your contact page\n3. Add it to your LocalBusiness schema markup\n4. Embed a Google Map showing your location'
    })
  }
  
  // Enhanced NAP consistency issue (Agency tier)
  if (napConsistency.consistencyScore < 80) {
    issues.push({
      severity: 'High',
      title: 'Inconsistent NAP data across pages',
      description: `Found ${napConsistency.phoneVariations.length} phone variations and ${napConsistency.addressVariations.length} address variations. NAP consistency score: ${napConsistency.consistencyScore}/100.`,
      howToFix: '1. Standardize your business name, address, and phone number\n2. Use the exact same format everywhere\n3. Update all pages to match your Google Business Profile\n4. Check footer, contact page, and schema markup for consistency\n5. Remove any old or incorrect NAP data',
      affectedPages: napConsistency.inconsistentPages.slice(0, 10)
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
  
  // NEW: Review markup issue (Agency tier)
  if (schema.hasLocalBusiness && !schema.hasReviewMarkup) {
    issues.push({
      severity: 'Medium',
      title: 'Missing review markup',
      description: 'No AggregateRating or Review schema markup found. Review markup helps display star ratings in search results.',
      howToFix: '1. Add AggregateRating schema to your LocalBusiness schema\n2. Include ratingValue (1-5) and reviewCount\n3. Optionally add individual Review items\n4. Example: { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "120" }'
    })
  }
  
  // NEW: Driving directions issue (Agency tier)
  if (schema.hasLocalBusiness && !schema.hasDrivingDirections) {
    issues.push({
      severity: 'Low',
      title: 'Missing driving directions',
      description: 'No driving directions link or schema found. This helps customers find your location.',
      howToFix: '1. Add a "Get Directions" link to your contact page\n2. Link to Google Maps with your address\n3. Consider adding directions schema markup\n4. Make directions easily accessible from your homepage'
    })
  }
  
  // NEW: Geo coordinates issue (Agency tier)
  if (schema.hasLocalBusiness && !schema.hasGeo) {
    issues.push({
      severity: 'Medium',
      title: 'Missing geo coordinates in schema',
      description: 'No latitude/longitude coordinates found in your LocalBusiness schema. Geo coordinates improve local search accuracy.',
      howToFix: '1. Add geo coordinates to your LocalBusiness schema\n2. Format: { "@type": "GeoCoordinates", "latitude": "40.7128", "longitude": "-74.0060" }\n3. Use your exact business location\n4. Validate using Google\'s Structured Data Testing Tool'
    })
  }
  
  // NEW: Opening hours validation issue (Agency tier)
  if (schema.hasLocalBusiness && (!schema.hasOpeningHours || (schema.openingHoursSchema && schema.openingHoursSchema.length === 0))) {
    issues.push({
      severity: 'Medium',
      title: 'Missing or invalid opening hours in schema',
      description: 'Opening hours not found in LocalBusiness schema or not properly formatted.',
      howToFix: '1. Add openingHours to your LocalBusiness schema\n2. Use proper format: "Mo-Fr 09:00-17:00" or ISO 8601 format\n3. Include all days your business is open\n4. Update hours during holidays and special events'
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
  
  // GBP issues (Enhanced)
  if (!gbp.hasGoogleMapsEmbed) {
    issues.push({
      severity: 'Low',
      title: 'No Google Maps embed',
      description: 'No Google Maps embed found on your website. Maps help visitors find you and improve local SEO.',
      howToFix: '1. Go to Google Maps and search for your business\n2. Click "Share" → "Embed a map"\n3. Copy the iframe code\n4. Add it to your contact page\n5. Make sure it shows your exact business location'
    })
  }
  
  if (!gbp.hasOpeningHours) {
    issues.push({
      severity: 'Medium',
      title: 'Missing opening hours',
      description: 'No business hours found on your website. Opening hours help with local search and user experience.',
      howToFix: '1. Add your business hours to your contact page\n2. Include them in your LocalBusiness schema markup\n3. Display hours prominently in your header or footer\n4. Keep hours updated, especially during holidays'
    })
  }
  
  // NEW: Citation issues (Agency tier)
  if (citations.length === 0) {
    issues.push({
      severity: 'Medium',
      title: 'No local citations detected',
      description: 'No links to local directory listings found on your website. Citations help with local search rankings.',
      howToFix: '1. Create listings on Google Business Profile, Yelp, Yellow Pages\n2. Add links to your citations from your website\n3. Ensure NAP data is consistent across all citations\n4. Claim and optimize your listings on major platforms'
    })
  } else {
    const inconsistentCitations = citations.filter(c => !c.isConsistent)
    if (inconsistentCitations.length > 0) {
      issues.push({
        severity: 'High',
        title: 'Inconsistent citation data',
        description: `Found ${inconsistentCitations.length} citation(s) with inconsistent NAP data.`,
        howToFix: '1. Review all your local directory listings\n2. Update NAP data to match your primary business information\n3. Use the exact same format (name, address, phone) everywhere\n4. Verify consistency using a citation management tool'
      })
    }
  }
  
  return issues
}

/**
 * Generate local SEO recommendations (Enhanced for Agency tier)
 */
function generateLocalSEORecommendations(
  nap: NAPData,
  napConsistency: NAPConsistency,
  schema: LocalSchemaAnalysis,
  serviceAreaPages: ServiceAreaPage[],
  keywords: LocalKeywordAnalysis,
  gbp: GBPIndicators,
  citations: LocalCitation[]
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
  
  // Add NAP consistency recommendations
  if (napConsistency.consistencyScore < 80) {
    recommendations.push(`Standardize your NAP data across all pages. Found ${napConsistency.nameVariations.length} name variations, ${napConsistency.addressVariations.length} address variations.`)
  }
  
  // Add citation recommendations
  if (citations.length === 0) {
    recommendations.push('Create listings on major local directories (Google Business Profile, Yelp, Yellow Pages, Bing Places)')
  } else {
    const inconsistentCitations = citations.filter(c => !c.isConsistent).length
    if (inconsistentCitations > 0) {
      recommendations.push(`Update ${inconsistentCitations} inconsistent citation(s) to match your primary NAP`)
    }
  }
  
  return recommendations
}

/**
 * Analyze NAP consistency across all pages (Agency tier)
 */
function analyzeNAPConsistency(pages: PageData[], nap: NAPData): NAPConsistency {
  const consistency: NAPConsistency = {
    consistencyScore: 100,
    nameVariations: [],
    addressVariations: [],
    phoneVariations: [],
    inconsistentPages: [],
    recommendations: []
  }
  
  // Collect all NAP variations from pages
  const nameSet = new Set<string>()
  const addressSet = new Set<string>()
  const phoneSet = new Set<string>()
  
  for (const page of pages) {
    // Combine available text fields for NAP consistency check
    const pageText = `${page.title || ''} ${page.metaDescription || ''} ${(page.h1Text || []).join(' ')}`
    
    if (!pageText.trim()) continue
    
    // Extract phone numbers
    const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
    const phones = pageText.match(phoneRegex)
    if (phones) {
      phones.forEach(phone => {
        const normalized = phone.replace(/[^\d]/g, '')
        if (normalized.length === 10 || normalized.length === 11) {
          phoneSet.add(normalized)
        }
      })
    }
    
    // Extract addresses
    const addressRegex = /\d{1,5}\s+[a-z0-9\s,.-]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|boulevard|blvd|circle|cir|place|pl)/gi
    const addresses = pageText.match(addressRegex)
    if (addresses) {
      addresses.forEach(addr => {
        addressSet.add(addr.trim().toLowerCase())
      })
    }
  }
  
  consistency.phoneVariations = Array.from(phoneSet)
  consistency.addressVariations = Array.from(addressSet)
  
  // Calculate consistency score
  // CRITICAL: If no phone or address found, consistency = 0
  if (phoneSet.size === 0 && addressSet.size === 0) {
    consistency.consistencyScore = 0
  } else {
    let deductions = 0
    
    if (consistency.phoneVariations.length > 1) {
      deductions += 20 * (consistency.phoneVariations.length - 1)
    }
    if (consistency.addressVariations.length > 1) {
      deductions += 20 * (consistency.addressVariations.length - 1)
    }
    
    consistency.consistencyScore = Math.max(0, 100 - deductions)
  }
  
  // Find inconsistent pages
  if (consistency.phoneVariations.length > 1 || consistency.addressVariations.length > 1) {
    // Mark pages with different NAP data as inconsistent
    pages.forEach(page => {
      const pageText = `${page.title || ''} ${page.metaDescription || ''} ${(page.h1Text || []).join(' ')}`
      if (pageText.trim()) {
        const hasDifferentPhone = consistency.phoneVariations.some(phone => 
          pageText.includes(phone) && phone !== nap.phone
        )
        const hasDifferentAddress = consistency.addressVariations.some(addr => 
          pageText.toLowerCase().includes(addr) && addr !== nap.address?.toLowerCase()
        )
        
        if (hasDifferentPhone || hasDifferentAddress) {
          consistency.inconsistentPages.push(page.url)
        }
      }
    })
  }
  
  // Generate recommendations
  if (consistency.consistencyScore < 80) {
    consistency.recommendations.push(
      `Found ${consistency.phoneVariations.length} phone number variations and ${consistency.addressVariations.length} address variations. ` +
      `Standardize your NAP data across all pages to match your Google Business Profile.`
    )
  }
  
  return consistency
}

/**
 * Audit local citations (Agency tier)
 * Checks for common local directory listings
 */
async function auditLocalCitations(
  pages: PageData[],
  rootUrl: string
): Promise<LocalCitation[]> {
  const citations: LocalCitation[] = []
  
  // Common local citation platforms
  const citationPlatforms = [
    'Google Business Profile',
    'Yelp',
    'Yellow Pages',
    'Bing Places',
    'Facebook Business',
    'Apple Maps',
    'Foursquare'
  ]
  
  // Check for links to citation platforms in page data
  for (const page of pages) {
    // Combine available text fields and URL for citation detection
    const pageText = `${page.title || ''} ${page.metaDescription || ''} ${page.url}`.toLowerCase()
    
    if (!pageText.trim()) continue
    
    // Check for Google Business Profile
    if (pageText.includes('google.com/maps/place') || pageText.includes('google.com/business')) {
      citations.push({
        platform: 'Google Business Profile',
        hasNAP: true, // Assume NAP is present if link exists
        isConsistent: true // Would need to verify against site NAP
      })
    }
    
    // Check for Yelp
    if (pageText.includes('yelp.com/biz')) {
      citations.push({
        platform: 'Yelp',
        hasNAP: true,
        isConsistent: true
      })
    }
    
    // Check for Yellow Pages
    if (pageText.includes('yellowpages.com') || pageText.includes('yp.com')) {
      citations.push({
        platform: 'Yellow Pages',
        hasNAP: true,
        isConsistent: true
      })
    }
    
    // Check for Facebook Business
    if (pageText.includes('facebook.com/pages') || pageText.includes('facebook.com/business')) {
      citations.push({
        platform: 'Facebook Business',
        hasNAP: true,
        isConsistent: true
      })
    }
  }
  
  // Note: Full citation audit would require checking external directories
  // This is a basic on-site detection. For full audit, would need to:
  // 1. Search for business name + location on each platform
  // 2. Verify NAP consistency
  // 3. Check listing completeness
  
  return citations
}

