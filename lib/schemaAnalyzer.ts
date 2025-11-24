/**
 * Enhanced Schema Analysis
 * 
 * Detects Identity Schema (Organization/Person) and validates schema completeness
 */

import { Issue } from './types'

export interface SchemaAnalysis {
  hasSchema: boolean
  schemaTypes: string[]
  hasIdentitySchema: boolean
  identityType?: 'Organization' | 'Person'
  identityData?: {
    name?: string
    url?: string
    logo?: string
    email?: string
    phone?: string
    address?: any
  }
  missingFields?: string[]
  schemaIssues: Issue[]
}

/**
 * Analyze schema markup in HTML
 * 
 * @param html - HTML string to analyze (can be initial or rendered HTML)
 * @param url - URL of the page
 * @param renderedDomScripts - Optional: Array of script tag contents extracted from rendered DOM (for JS-injected schema)
 */
export function analyzeSchema(html: string, url: string, renderedDomScripts?: string[]): SchemaAnalysis {
  const analysis: SchemaAnalysis = {
    hasSchema: false,
    schemaTypes: [],
    hasIdentitySchema: false,
    schemaIssues: []
  }
  
  const allSchemaTypes = new Set<string>()
  let identitySchema: any = null
  
  // Parse JSON-LD schema - be more flexible with whitespace and attributes
  // Match script tags with type="application/ld+json" or type='application/ld+json'
  const jsonLdMatches = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  
  // CRITICAL FIX: Also check rendered DOM scripts (for JS-injected schema)
  // This catches schema that's added dynamically after page load
  const allJsonLdContent: string[] = [...jsonLdMatches]
  if (renderedDomScripts && renderedDomScripts.length > 0) {
    // Check if any rendered DOM scripts contain JSON-LD
    renderedDomScripts.forEach(scriptContent => {
      // Check if this script content looks like JSON-LD (starts with { or [)
      const trimmed = scriptContent.trim()
      if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && !allJsonLdContent.includes(scriptContent)) {
        allJsonLdContent.push(scriptContent)
      }
    })
  }
  
  allJsonLdContent.forEach(script => {
    try {
      // Extract JSON content more carefully
      // If it's from rendered DOM, it's already JSON string (not wrapped in script tags)
      // If it's from initial HTML, it may be wrapped in script tags
      let jsonContent: string
      if (script.includes('<script')) {
        // From initial HTML - extract from script tag
        jsonContent = script.replace(/<script[^>]*>([\s\S]*?)<\/script>/i, '$1').trim()
      } else {
        // From rendered DOM - already JSON string
        jsonContent = script.trim()
      }
      // Remove any leading/trailing whitespace and comments
      const cleanedJson = jsonContent.replace(/\/\*[\s\S]*?\*\//g, '').trim()
      if (!cleanedJson) return // Skip empty scripts
      
      const parsed = JSON.parse(cleanedJson)
      const schemas = Array.isArray(parsed) ? parsed : [parsed]
      
      schemas.forEach((schema: any) => {
        if (schema['@type']) {
          analysis.hasSchema = true
          const schemaType = schema['@type']
          allSchemaTypes.add(schemaType)
          
          // Check for Identity Schema
          if (schemaType === 'Organization' || schemaType === 'Person') {
            analysis.hasIdentitySchema = true
            analysis.identityType = schemaType
            
            // Store identity data
            identitySchema = schema
            analysis.identityData = {
              name: schema.name,
              url: schema.url || schema.sameAs?.[0],
              logo: schema.logo?.url || schema.logo,
              email: schema.email,
              phone: schema.telephone || schema.phone,
              address: schema.address
            }
            
            // Validate required fields
            const requiredFields = schemaType === 'Organization' 
              ? ['name', 'url']
              : ['name']
            
            analysis.missingFields = requiredFields.filter(field => {
              if (field === 'url' && schemaType === 'Organization') {
                // URL is required for Organization, but can be in sameAs
                return !schema.url && !schema.sameAs?.[0]
              }
              return !schema[field]
            })
          }
        }
      })
    } catch (error) {
      // Invalid JSON, skip
      analysis.schemaIssues.push({
        category: 'Technical',
        severity: 'Low',
        message: 'Invalid JSON-LD schema markup',
        details: 'Found malformed JSON-LD script tag. Check syntax.',
        affectedPages: [url]
      })
    }
  })
  
  // Parse microdata schema
  const microdataMatches = html.match(/itemtype=["']https?:\/\/schema\.org\/([^"']+)["']/gi) || []
  microdataMatches.forEach(match => {
    const typeMatch = match.match(/schema\.org\/([^"']+)/i)
    if (typeMatch) {
      analysis.hasSchema = true
      allSchemaTypes.add(typeMatch[1])
      
      // Check for Identity Schema in microdata
      if (typeMatch[1] === 'Organization' || typeMatch[1] === 'Person') {
        analysis.hasIdentitySchema = true
        if (!analysis.identityType) {
          analysis.identityType = typeMatch[1] as 'Organization' | 'Person'
        }
      }
    }
  })
  
  analysis.schemaTypes = Array.from(allSchemaTypes)
  
  // Generate issues
  if (!analysis.hasSchema) {
    analysis.schemaIssues.push({
      category: 'Technical',
      severity: 'Medium',
      message: 'Missing schema markup',
      details: 'No Schema.org structured data detected. Add JSON-LD or microdata to help search engines understand your content.',
      affectedPages: [url]
    })
  } else if (!analysis.hasIdentitySchema) {
    analysis.schemaIssues.push({
      category: 'Technical',
      severity: 'Medium',
      message: 'Missing Identity Schema',
      details: 'No Organization or Person Schema identified on the page. The absence of Organization or Person Schema can make it harder for Search Engines and LLMs to identify the ownership of a website and confidently answer brand, company or person queries.',
      affectedPages: [url]
    })
  } else if (analysis.missingFields && analysis.missingFields.length > 0) {
    analysis.schemaIssues.push({
      category: 'Technical',
      severity: 'Low',
      message: `Incomplete ${analysis.identityType} Schema`,
      details: `Missing required fields: ${analysis.missingFields.join(', ')}. Complete your Identity Schema for better search engine understanding.`,
      affectedPages: [url]
    })
  }
  
  return analysis
}

/**
 * Generate schema recommendations
 */
export function generateSchemaRecommendations(analysis: SchemaAnalysis, url: string): string[] {
  const recommendations: string[] = []
  
  if (!analysis.hasSchema) {
    recommendations.push('Add Schema.org structured data (JSON-LD recommended) to help search engines understand your content.')
  }
  
  if (!analysis.hasIdentitySchema) {
    recommendations.push(`Add ${analysis.identityType || 'Organization or Person'} Schema to identify your brand/company. This helps search engines and LLMs understand who owns the website.`)
  }
  
  if (analysis.missingFields && analysis.missingFields.length > 0) {
    recommendations.push(`Complete your ${analysis.identityType} Schema by adding: ${analysis.missingFields.join(', ')}.`)
  }
  
  if (analysis.hasIdentitySchema && !analysis.identityData?.logo) {
    recommendations.push('Add a logo to your Identity Schema for rich results in search.')
  }
  
  return recommendations
}

