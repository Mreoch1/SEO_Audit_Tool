// Industry classification and competitor data
// Maps content patterns to industries and provides known competitors for each niche

export interface IndustryDefinition {
  id: string
  name: string
  keywords: string[] // Keywords to match against target site content
  competitors: string[] // Known competitors in this space
}

export const INDUSTRY_DATA: Record<string, IndustryDefinition> = {
  // Technology & SaaS
  'saas_marketing': {
    id: 'saas_marketing',
    name: 'Marketing SaaS',
    keywords: ['marketing', 'automation', 'email', 'crm', 'campaign', 'newsletter', 'analytics', 'growth', 'sales'],
    competitors: ['https://hubspot.com', 'https://mailchimp.com', 'https://activecampaign.com', 'https://convertkit.com']
  },
  'saas_dev': {
    id: 'saas_dev',
    name: 'Developer Tools',
    keywords: ['api', 'sdk', 'documentation', 'deployment', 'cloud', 'serverless', 'database', 'hosting', 'frontend', 'backend'],
    competitors: ['https://vercel.com', 'https://netlify.com', 'https://heroku.com', 'https://digitalocean.com']
  },
  'saas_productivity': {
    id: 'saas_productivity',
    name: 'Productivity Software',
    keywords: ['project management', 'task', 'collaboration', 'team', 'workflow', 'kanban', 'scrum', 'remote work'],
    competitors: ['https://asana.com', 'https://trello.com', 'https://monday.com', 'https://notion.so']
  },

  // E-commerce
  'ecommerce_fashion': {
    id: 'ecommerce_fashion',
    name: 'Fashion & Apparel',
    keywords: ['clothing', 'apparel', 'wear', 'fashion', 'style', 'shop', 'store', 'mens', 'womens', 'accessories'],
    competitors: ['https://asos.com', 'https://zara.com', 'https://hm.com', 'https://uniqlo.com']
  },
  'ecommerce_electronics': {
    id: 'ecommerce_electronics',
    name: 'Consumer Electronics',
    keywords: ['electronics', 'gadgets', 'phone', 'laptop', 'computer', 'tech', 'device', 'audio', 'camera'],
    competitors: ['https://bestbuy.com', 'https://newegg.com', 'https://bhphotovideo.com', 'https://crutchfield.com']
  },
  'ecommerce_home': {
    id: 'ecommerce_home',
    name: 'Home & Garden',
    keywords: ['furniture', 'decor', 'home', 'living', 'garden', 'kitchen', 'interior', 'design'],
    competitors: ['https://wayfair.com', 'https://ikea.com', 'https://westelm.com', 'https://crateandbarrel.com']
  },

  // Services
  'agency_seo': {
    id: 'agency_seo',
    name: 'SEO & Marketing Agency',
    keywords: ['seo', 'search engine', 'ranking', 'audit', 'digital marketing', 'agency', 'consulting'],
    competitors: ['https://moz.com', 'https://ahrefs.com', 'https://semrush.com', 'https://searchengineland.com']
  },
  'finance': {
    id: 'finance',
    name: 'Finance & Fintech',
    keywords: ['finance', 'banking', 'investing', 'money', 'credit', 'loan', 'crypto', 'wealth', 'trading'],
    competitors: ['https://nerdwallet.com', 'https://investopedia.com', 'https://robinhood.com', 'https://coinbase.com']
  },
  'health': {
    id: 'health',
    name: 'Health & Wellness',
    keywords: ['health', 'wellness', 'medical', 'fitness', 'diet', 'nutrition', 'workout', 'mental health'],
    competitors: ['https://healthline.com', 'https://webmd.com', 'https://mayoclinic.org', 'https://menshealth.com']
  },
  'travel': {
    id: 'travel',
    name: 'Travel & Tourism',
    keywords: ['travel', 'trip', 'vacation', 'hotel', 'flight', 'booking', 'destination', 'tourism', 'guide'],
    competitors: ['https://tripadvisor.com', 'https://expedia.com', 'https://lonelyplanet.com', 'https://booking.com']
  },
  'education': {
    id: 'education',
    name: 'Education & Learning',
    keywords: ['course', 'learn', 'tutorial', 'education', 'university', 'school', 'training', 'certification', 'bootcamp'],
    competitors: ['https://coursera.org', 'https://udemy.com', 'https://edx.org', 'https://khanacademy.org']
  },
  'news': {
    id: 'news',
    name: 'News & Media',
    keywords: ['news', 'magazine', 'blog', 'article', 'report', 'journalism', 'daily', 'times', 'post'],
    competitors: ['https://nytimes.com', 'https://cnn.com', 'https://bbc.com', 'https://theverge.com']
  }
}

export interface IndustryClassification {
  industry: string
  confidence: number
  competitors: string[]
}

export async function classifyDomain(
  url: string,
  html: string,
  userAgent: string
): Promise<IndustryClassification> {
  // Extract title and description from HTML
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1] : ''
  
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
  const description = descMatch ? descMatch[1] : ''
  
  // Extract visible text content (simplified - just get text between tags)
  const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                          .replace(/<[^>]+>/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim()
                          .substring(0, 5000) // Limit to first 5000 chars for performance
  
  const text = `${title} ${description} ${textContent}`.toLowerCase()
  
  let bestMatch: IndustryDefinition | null = null
  let maxScore = 0

  for (const key in INDUSTRY_DATA) {
    const industry = INDUSTRY_DATA[key]
    let score = 0
    
    // Calculate score based on keyword matches
    industry.keywords.forEach(keyword => {
      // Regex to match whole words only for accuracy
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = (text.match(regex) || []).length
      score += matches
    })

    // Boost score if keyword is in title (strong signal)
    industry.keywords.forEach(keyword => {
      if (title.toLowerCase().includes(keyword)) {
        score += 5
      }
    })

    if (score > maxScore) {
      maxScore = score
      bestMatch = industry
    }
  }

  // Calculate confidence (0-1 scale)
  const confidence = maxScore > 0 ? Math.min(maxScore / 20, 1) : 0

  // Return classification
  if (bestMatch && maxScore > 2) {
    return {
      industry: bestMatch.name,
      confidence,
      competitors: bestMatch.competitors
    }
  }

  // Default fallback
  return {
    industry: 'General',
    confidence: 0,
    competitors: []
  }
}

