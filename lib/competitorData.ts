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
  'saas_design': {
    id: 'saas_design',
    name: 'Design & Creative Tools',
    keywords: ['design', 'graphic', 'creative', 'prototype', 'wireframe', 'ui', 'ux', 'illustration', 'vector'],
    competitors: ['https://figma.com', 'https://canva.com', 'https://sketch.com', 'https://adobe.com']
  },
  'saas_analytics': {
    id: 'saas_analytics',
    name: 'Analytics & Data',
    keywords: ['analytics', 'metrics', 'dashboard', 'data', 'insights', 'reporting', 'business intelligence', 'tracking'],
    competitors: ['https://amplitude.com', 'https://mixpanel.com', 'https://segment.com', 'https://heap.io']
  },
  'saas_hr': {
    id: 'saas_hr',
    name: 'HR & Recruiting',
    keywords: ['recruiting', 'hiring', 'hr', 'human resources', 'applicant tracking', 'talent', 'payroll', 'benefits'],
    competitors: ['https://greenhouse.io', 'https://lever.co', 'https://workday.com', 'https://bamboohr.com']
  },
  'saas_customer_support': {
    id: 'saas_customer_support',
    name: 'Customer Support',
    keywords: ['support', 'helpdesk', 'customer service', 'ticketing', 'chat', 'knowledge base', 'help center'],
    competitors: ['https://zendesk.com', 'https://intercom.com', 'https://freshdesk.com', 'https://helpscout.com']
  },
  'saas_accounting': {
    id: 'saas_accounting',
    name: 'Accounting & Invoicing',
    keywords: ['accounting', 'invoicing', 'bookkeeping', 'expenses', 'receipts', 'tax', 'financial', 'billing'],
    competitors: ['https://quickbooks.intuit.com', 'https://xero.com', 'https://freshbooks.com', 'https://wave.com']
  },
  'saas_video': {
    id: 'saas_video',
    name: 'Video & Streaming',
    keywords: ['video', 'streaming', 'webinar', 'conference', 'recording', 'live', 'broadcast', 'meeting'],
    competitors: ['https://zoom.us', 'https://vimeo.com', 'https://loom.com', 'https://streamyard.com']
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
  'ecommerce_beauty': {
    id: 'ecommerce_beauty',
    name: 'Beauty & Cosmetics',
    keywords: ['beauty', 'cosmetics', 'makeup', 'skincare', 'fragrance', 'hair', 'nails', 'spa'],
    competitors: ['https://sephora.com', 'https://ulta.com', 'https://glossier.com', 'https://beautybay.com']
  },
  'ecommerce_sports': {
    id: 'ecommerce_sports',
    name: 'Sports & Outdoor',
    keywords: ['sports', 'outdoor', 'athletic', 'running', 'gym', 'camping', 'hiking', 'gear', 'equipment'],
    competitors: ['https://nike.com', 'https://adidas.com', 'https://rei.com', 'https://dickssportinggoods.com']
  },
  'ecommerce_books': {
    id: 'ecommerce_books',
    name: 'Books & Publishing',
    keywords: ['books', 'ebook', 'reading', 'publishing', 'author', 'novel', 'literature', 'audiobook'],
    competitors: ['https://amazon.com/books', 'https://bookshop.org', 'https://barnesandnoble.com', 'https://goodreads.com']
  },
  'ecommerce_food': {
    id: 'ecommerce_food',
    name: 'Food & Beverage',
    keywords: ['food', 'grocery', 'meal', 'delivery', 'restaurant', 'dining', 'recipe', 'cooking'],
    competitors: ['https://instacart.com', 'https://doordash.com', 'https://ubereats.com', 'https://grubhub.com']
  },
  'ecommerce_pets': {
    id: 'ecommerce_pets',
    name: 'Pet Supplies',
    keywords: ['pet', 'dog', 'cat', 'animal', 'supplies', 'food', 'toys', 'veterinary'],
    competitors: ['https://chewy.com', 'https://petco.com', 'https://petsmart.com', 'https://petflow.com']
  },
  'ecommerce_automotive': {
    id: 'ecommerce_automotive',
    name: 'Automotive & Parts',
    keywords: ['automotive', 'car', 'vehicle', 'parts', 'accessories', 'tires', 'repair', 'maintenance'],
    competitors: ['https://autozone.com', 'https://rockauto.com', 'https://advanceautoparts.com', 'https://carparts.com']
  },
  'ecommerce_jewelry': {
    id: 'ecommerce_jewelry',
    name: 'Jewelry & Watches',
    keywords: ['jewelry', 'watches', 'rings', 'necklace', 'bracelet', 'diamond', 'gold', 'luxury'],
    competitors: ['https://bluenile.com', 'https://jamesallen.com', 'https://brilliant.earth', 'https://tiffany.com']
  },

  // Professional Services
  'agency_seo': {
    id: 'agency_seo',
    name: 'SEO & Marketing Agency',
    keywords: ['seo', 'search engine', 'ranking', 'audit', 'digital marketing', 'agency', 'consulting'],
    competitors: ['https://moz.com', 'https://ahrefs.com', 'https://semrush.com', 'https://searchengineland.com']
  },
  'agency_web_design': {
    id: 'agency_web_design',
    name: 'Web Design & Development',
    keywords: ['web design', 'website', 'development', 'agency', 'portfolio', 'responsive', 'wordpress', 'custom'],
    competitors: ['https://toptal.com', 'https://upwork.com', 'https://fiverr.com', 'https://99designs.com']
  },
  'agency_advertising': {
    id: 'agency_advertising',
    name: 'Advertising Agency',
    keywords: ['advertising', 'creative', 'campaign', 'brand', 'media', 'strategy', 'ads', 'commercial'],
    competitors: ['https://wpp.com', 'https://omnicomgroup.com', 'https://publicisgroupe.com', 'https://ipgnetwork.com']
  },
  'legal': {
    id: 'legal',
    name: 'Legal Services',
    keywords: ['legal', 'law', 'attorney', 'lawyer', 'firm', 'litigation', 'contract', 'counsel'],
    competitors: ['https://avvo.com', 'https://justia.com', 'https://findlaw.com', 'https://nolo.com']
  },
  'accounting_services': {
    id: 'accounting_services',
    name: 'Accounting & Tax Services',
    keywords: ['accounting', 'tax', 'cpa', 'audit', 'bookkeeping', 'financial', 'consulting', 'advisory'],
    competitors: ['https://deloitte.com', 'https://pwc.com', 'https://ey.com', 'https://kpmg.com']
  },
  'consulting': {
    id: 'consulting',
    name: 'Business Consulting',
    keywords: ['consulting', 'strategy', 'management', 'advisory', 'business', 'transformation', 'optimization'],
    competitors: ['https://mckinsey.com', 'https://bcg.com', 'https://bain.com', 'https://accenture.com']
  },

  // Finance & Insurance
  'finance': {
    id: 'finance',
    name: 'Finance & Fintech',
    keywords: ['finance', 'banking', 'investing', 'money', 'credit', 'loan', 'crypto', 'wealth', 'trading'],
    competitors: ['https://nerdwallet.com', 'https://investopedia.com', 'https://robinhood.com', 'https://coinbase.com']
  },
  'insurance': {
    id: 'insurance',
    name: 'Insurance',
    keywords: ['insurance', 'coverage', 'policy', 'premium', 'claim', 'auto', 'home', 'life', 'health'],
    competitors: ['https://progressive.com', 'https://geico.com', 'https://statefarm.com', 'https://allstate.com']
  },
  'real_estate': {
    id: 'real_estate',
    name: 'Real Estate',
    keywords: ['real estate', 'property', 'homes', 'houses', 'apartments', 'rent', 'buy', 'sell', 'listing'],
    competitors: ['https://zillow.com', 'https://redfin.com', 'https://realtor.com', 'https://trulia.com']
  },
  'mortgage': {
    id: 'mortgage',
    name: 'Mortgage & Lending',
    keywords: ['mortgage', 'loan', 'lending', 'refinance', 'rate', 'home loan', 'lender', 'approval'],
    competitors: ['https://quickenloans.com', 'https://lendingtree.com', 'https://bankrate.com', 'https://better.com']
  },

  // Healthcare & Medical
  'health': {
    id: 'health',
    name: 'Health & Wellness',
    keywords: ['health', 'wellness', 'medical', 'fitness', 'diet', 'nutrition', 'workout', 'mental health'],
    competitors: ['https://healthline.com', 'https://webmd.com', 'https://mayoclinic.org', 'https://menshealth.com']
  },
  'telemedicine': {
    id: 'telemedicine',
    name: 'Telemedicine',
    keywords: ['telemedicine', 'telehealth', 'online doctor', 'virtual care', 'consultation', 'prescription'],
    competitors: ['https://teladoc.com', 'https://mdlive.com', 'https://amwell.com', 'https://plushcare.com']
  },
  'dental': {
    id: 'dental',
    name: 'Dental Services',
    keywords: ['dental', 'dentist', 'teeth', 'orthodontics', 'braces', 'cleaning', 'oral', 'smile'],
    competitors: ['https://aspen-dental.com', 'https://1800dentist.com', 'https://deltadentalins.com', 'https://smile-direct-club.com']
  },
  'pharmacy': {
    id: 'pharmacy',
    name: 'Pharmacy & Prescriptions',
    keywords: ['pharmacy', 'prescription', 'medication', 'drugs', 'medicine', 'refill', 'rx'],
    competitors: ['https://cvs.com', 'https://walgreens.com', 'https://rite-aid.com', 'https://capsule.com']
  },
  'mental_health': {
    id: 'mental_health',
    name: 'Mental Health',
    keywords: ['therapy', 'counseling', 'mental health', 'psychologist', 'psychiatrist', 'anxiety', 'depression'],
    competitors: ['https://betterhelp.com', 'https://talkspace.com', 'https://cerebral.com', 'https://brightside.com']
  },

  // Education & Training
  'education': {
    id: 'education',
    name: 'Education & Learning',
    keywords: ['course', 'learn', 'tutorial', 'education', 'university', 'school', 'training', 'certification', 'bootcamp'],
    competitors: ['https://coursera.org', 'https://udemy.com', 'https://edx.org', 'https://khanacademy.org']
  },
  'k12_education': {
    id: 'k12_education',
    name: 'K-12 Education',
    keywords: ['elementary', 'middle school', 'high school', 'k-12', 'students', 'teachers', 'curriculum', 'homework'],
    competitors: ['https://ixl.com', 'https://abcmouse.com', 'https://education.com', 'https://scholastic.com']
  },
  'language_learning': {
    id: 'language_learning',
    name: 'Language Learning',
    keywords: ['language', 'learning', 'spanish', 'french', 'english', 'translation', 'fluency', 'vocabulary'],
    competitors: ['https://duolingo.com', 'https://babbel.com', 'https://rosettastone.com', 'https://busuu.com']
  },
  'test_prep': {
    id: 'test_prep',
    name: 'Test Preparation',
    keywords: ['test prep', 'sat', 'act', 'gmat', 'gre', 'exam', 'study', 'tutoring', 'practice'],
    competitors: ['https://kaplanstest.com', 'https://princetonreview.com', 'https://magoosh.com', 'https://prepscholar.com']
  },

  // Travel & Hospitality
  'travel': {
    id: 'travel',
    name: 'Travel & Tourism',
    keywords: ['travel', 'trip', 'vacation', 'hotel', 'flight', 'booking', 'destination', 'tourism', 'guide'],
    competitors: ['https://tripadvisor.com', 'https://expedia.com', 'https://lonelyplanet.com', 'https://booking.com']
  },
  'hotels': {
    id: 'hotels',
    name: 'Hotels & Accommodations',
    keywords: ['hotel', 'resort', 'accommodation', 'rooms', 'stay', 'lodging', 'inn', 'suite'],
    competitors: ['https://hotels.com', 'https://marriott.com', 'https://hilton.com', 'https://airbnb.com']
  },
  'airlines': {
    id: 'airlines',
    name: 'Airlines & Flights',
    keywords: ['airline', 'flight', 'tickets', 'airfare', 'airport', 'travel', 'booking', 'destinations'],
    competitors: ['https://southwest.com', 'https://delta.com', 'https://united.com', 'https://skyscanner.com']
  },
  'car_rental': {
    id: 'car_rental',
    name: 'Car Rental',
    keywords: ['car rental', 'rent a car', 'vehicle', 'reservation', 'pickup', 'airport'],
    competitors: ['https://enterprise.com', 'https://hertz.com', 'https://budget.com', 'https://avis.com']
  },

  // Media & Entertainment
  'news': {
    id: 'news',
    name: 'News & Media',
    keywords: ['news', 'magazine', 'blog', 'article', 'report', 'journalism', 'daily', 'times', 'post'],
    competitors: ['https://nytimes.com', 'https://cnn.com', 'https://bbc.com', 'https://theverge.com']
  },
  'streaming': {
    id: 'streaming',
    name: 'Streaming & Entertainment',
    keywords: ['streaming', 'movies', 'tv shows', 'series', 'watch', 'entertainment', 'video', 'content'],
    competitors: ['https://netflix.com', 'https://hulu.com', 'https://disneyplus.com', 'https://primevideo.com']
  },
  'music': {
    id: 'music',
    name: 'Music & Audio',
    keywords: ['music', 'streaming', 'songs', 'playlist', 'artist', 'album', 'audio', 'podcast'],
    competitors: ['https://spotify.com', 'https://apple.com/music', 'https://pandora.com', 'https://soundcloud.com']
  },
  'gaming': {
    id: 'gaming',
    name: 'Gaming',
    keywords: ['gaming', 'games', 'video games', 'console', 'pc', 'esports', 'multiplayer', 'stream'],
    competitors: ['https://steampowered.com', 'https://twitch.tv', 'https://ign.com', 'https://gamespot.com']
  },
  'podcasts': {
    id: 'podcasts',
    name: 'Podcasts',
    keywords: ['podcast', 'audio', 'episodes', 'listen', 'host', 'interview', 'show'],
    competitors: ['https://podcasts.apple.com', 'https://spotify.com/podcasts', 'https://stitcher.com', 'https://podbean.com']
  },

  // Government & Non-Profit
  'government': {
    id: 'government',
    name: 'Government & Public Sector',
    keywords: ['government', 'federal', 'state', 'public', 'department', 'agency', 'official', 'administration'],
    competitors: ['https://usa.gov', 'https://whitehouse.gov', 'https://congress.gov', 'https://state.gov']
  },
  'nonprofit': {
    id: 'nonprofit',
    name: 'Non-Profit & Charity',
    keywords: ['nonprofit', 'charity', 'donation', 'volunteer', 'foundation', 'cause', 'fundraising', 'impact'],
    competitors: ['https://redcross.org', 'https://unitedway.org', 'https://salvationarmyusa.org', 'https://feedingamerica.org']
  },
  'space_aerospace': {
    id: 'space_aerospace',
    name: 'Space & Aerospace',
    keywords: ['space', 'aerospace', 'nasa', 'rocket', 'satellite', 'mission', 'exploration', 'astronaut', 'launch'],
    competitors: ['https://spacex.com', 'https://blueorigin.com', 'https://esa.int', 'https://jaxa.jp']
  },
  'military': {
    id: 'military',
    name: 'Military & Defense',
    keywords: ['military', 'defense', 'army', 'navy', 'air force', 'marines', 'veterans', 'service'],
    competitors: ['https://army.mil', 'https://navy.mil', 'https://airforce.com', 'https://marines.mil']
  },

  // Food & Restaurants
  'restaurants': {
    id: 'restaurants',
    name: 'Restaurants & Dining',
    keywords: ['restaurant', 'dining', 'menu', 'reservation', 'food', 'chef', 'cuisine', 'delivery'],
    competitors: ['https://opentable.com', 'https://yelp.com', 'https://resy.com', 'https://eater.com']
  },
  'recipes': {
    id: 'recipes',
    name: 'Recipes & Cooking',
    keywords: ['recipe', 'cooking', 'ingredients', 'meal', 'kitchen', 'baking', 'chef', 'food blog'],
    competitors: ['https://allrecipes.com', 'https://foodnetwork.com', 'https://tasty.co', 'https://epicurious.com']
  },

  // Lifestyle & Personal
  'parenting': {
    id: 'parenting',
    name: 'Parenting & Family',
    keywords: ['parenting', 'baby', 'kids', 'family', 'children', 'pregnancy', 'toddler', 'mom', 'dad'],
    competitors: ['https://parents.com', 'https://babycenter.com', 'https://whattoexpect.com', 'https://thebump.com']
  },
  'wedding': {
    id: 'wedding',
    name: 'Wedding & Events',
    keywords: ['wedding', 'bride', 'groom', 'ceremony', 'venue', 'planning', 'registry', 'marriage'],
    competitors: ['https://theknot.com', 'https://weddingwire.com', 'https://zola.com', 'https://brides.com']
  },
  'photography': {
    id: 'photography',
    name: 'Photography',
    keywords: ['photography', 'photographer', 'photos', 'portraits', 'camera', 'shoot', 'studio', 'editing'],
    competitors: ['https://500px.com', 'https://flickr.com', 'https://smugmug.com', 'https://unsplash.com']
  },

  // Construction & Home Services
  'construction': {
    id: 'construction',
    name: 'Construction & Contractors',
    keywords: ['construction', 'contractor', 'building', 'renovation', 'remodeling', 'home improvement', 'repair'],
    competitors: ['https://homeadvisor.com', 'https://angi.com', 'https://thumbtack.com', 'https://houzz.com']
  },
  'hvac': {
    id: 'hvac',
    name: 'HVAC & Climate Control',
    keywords: ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace', 'ac', 'ventilation', 'temperature'],
    competitors: ['https://carrier.com', 'https://trane.com', 'https://lennox.com', 'https://rheem.com']
  },
  'plumbing': {
    id: 'plumbing',
    name: 'Plumbing Services',
    keywords: ['plumbing', 'plumber', 'pipes', 'water', 'drain', 'leak', 'repair', 'installation'],
    competitors: ['https://benjaminfranklinplumbing.com', 'https://mrrooter.com', 'https://rotorooter.com', 'https://ars.com']
  },

  // Manufacturing & Industrial
  'manufacturing': {
    id: 'manufacturing',
    name: 'Manufacturing & Industrial',
    keywords: ['manufacturing', 'industrial', 'factory', 'production', 'machinery', 'equipment', 'supply chain'],
    competitors: ['https://ge.com', 'https://siemens.com', 'https://honeywell.com', 'https://3m.com']
  },

  // Agriculture & Environment
  'agriculture': {
    id: 'agriculture',
    name: 'Agriculture & Farming',
    keywords: ['agriculture', 'farming', 'crops', 'livestock', 'harvest', 'farm', 'rural', 'organic'],
    competitors: ['https://usda.gov', 'https://agriculture.com', 'https://farmjournal.com', 'https://agweb.com']
  },
  'sustainability': {
    id: 'sustainability',
    name: 'Sustainability & Environment',
    keywords: ['sustainability', 'environment', 'green', 'eco', 'renewable', 'climate', 'conservation', 'recycling'],
    competitors: ['https://epa.gov', 'https://worldwildlife.org', 'https://greenpeace.org', 'https://sierraclub.org']
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

/**
 * Auto-fill missing competitor URLs based on industry classification
 * 
 * Logic:
 * - If 0 URLs provided → find 3-4 competitors
 * - If 1 URL provided → find 2 more
 * - If 2 URLs provided → find 1 more
 * - If 3+ URLs provided → use those (no auto-fill needed)
 * 
 * For Agency tier, ensures minimum 3 competitors
 */
export async function autoFillCompetitorUrls(
  targetUrl: string,
  providedUrls: string[],
  html: string,
  userAgent: string,
  tier: 'starter' | 'standard' | 'professional' | 'agency' = 'standard'
): Promise<{
  finalUrls: string[]
  autoDetected: string[]
  provided: string[]
  industry: string
  confidence: number
}> {
  const provided = providedUrls.filter(url => url && url.trim().length > 0)
  const targetDomain = new URL(targetUrl).hostname.replace(/^www\./, '')
  
  // Determine how many competitors we need
  const minCompetitors = tier === 'agency' ? 3 : 1
  const maxCompetitors = tier === 'agency' ? 4 : 3
  const needed = Math.max(0, minCompetitors - provided.length)
  
  // If we have enough, return as-is
  if (provided.length >= minCompetitors) {
    return {
      finalUrls: provided.slice(0, maxCompetitors),
      autoDetected: [],
      provided: provided.slice(0, maxCompetitors),
      industry: 'Unknown',
      confidence: 0
    }
  }
  
  // Classify the domain to find industry competitors
  const classification = await classifyDomain(targetUrl, html, userAgent)
  
  // Get available competitors from industry classification
  let availableCompetitors = classification.competitors || []
  
  // Filter out:
  // 1. The target site itself
  // 2. Already provided URLs
  // 3. Invalid URLs
  const providedDomains = new Set(
    provided.map(url => {
      try {
        return new URL(url).hostname.replace(/^www\./, '')
      } catch {
        return ''
      }
    })
  )
  
  availableCompetitors = availableCompetitors
    .filter(url => {
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '')
        return domain !== targetDomain && !providedDomains.has(domain)
      } catch {
        return false
      }
    })
    .slice(0, needed) // Take only what we need
  
  // Combine provided + auto-detected
  const finalUrls = [...provided, ...availableCompetitors].slice(0, maxCompetitors)
  
  return {
    finalUrls,
    autoDetected: availableCompetitors,
    provided,
    industry: classification.industry,
    confidence: classification.confidence
  }
}

