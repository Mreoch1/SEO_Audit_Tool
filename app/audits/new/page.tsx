'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Check, Plus, Minus } from 'lucide-react'
import type { AuditTier, AuditAddOns } from '@/lib/types'

function NewAuditPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [selectedTier, setSelectedTier] = useState<AuditTier | null>(null)
  const [loading, setLoading] = useState(false)
  const [addOns, setAddOns] = useState<AuditAddOns>({})
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([]) // Competitor URLs array
  const [urlError, setUrlError] = useState('')
  
  // Pre-fill form from query params (for "Run Again" functionality)
  useEffect(() => {
    const urlParam = searchParams.get('url')
    const tierParam = searchParams.get('tier') as AuditTier | null
    const competitorUrl0 = searchParams.get('competitorUrl0')
    const competitorUrl1 = searchParams.get('competitorUrl1')
    const competitorUrl2 = searchParams.get('competitorUrl2')
    const competitorUrl3 = searchParams.get('competitorUrl3')
    
    if (urlParam) {
      setUrl(urlParam)
    }
    
    if (tierParam && ['starter', 'standard', 'professional', 'agency'].includes(tierParam)) {
      setSelectedTier(tierParam)
    }
    
    // Parse add-ons from query params
    const parsedAddOns: AuditAddOns = {}
    searchParams.forEach((value, key) => {
      if (key.startsWith('addOns.')) {
        const addOnKey = key.replace('addOns.', '') as keyof AuditAddOns
        // Type guard: check if this is a boolean property
        const booleanAddOns: (keyof AuditAddOns)[] = ['blankReport', 'competitorAnalysis', 'schemaDeepDive', 'extraCrawlDepth', 'expedited']
        const numberAddOns: (keyof AuditAddOns)[] = ['additionalPages', 'additionalKeywords', 'additionalCompetitors']
        
        if (value === 'true' && booleanAddOns.includes(addOnKey)) {
          (parsedAddOns[addOnKey] as boolean) = true
        } else if (!isNaN(Number(value)) && numberAddOns.includes(addOnKey)) {
          (parsedAddOns[addOnKey] as number) = Number(value)
        }
      }
    })
    if (Object.keys(parsedAddOns).length > 0) {
      setAddOns(parsedAddOns)
    }
    
    // Parse competitor URLs (support up to 10)
    const competitorUrlsList: string[] = []
    for (let i = 0; i < 10; i++) {
      const url = searchParams.get(`competitorUrl${i}`)
      if (url && url.trim()) {
        competitorUrlsList.push(url)
      }
    }
    if (competitorUrlsList.length > 0) {
      setCompetitorUrls(competitorUrlsList)
    }
  }, [searchParams])
  
  const tierInfo = {
    starter: { 
      maxPages: 5, 
      maxDepth: 2, 
      price: '$19', 
      name: 'Starter', 
      description: 'Deep crawl (up to 5 pages), JavaScript rendering, Core Web Vitals, Technical SEO, On-Page SEO, Content Quality, Accessibility, Local SEO signals, Schema detection, Broken links, Internal linking overview.',
      deliveryDays: 2, // 2 business days
      keywords: 0,
      includes: {
        titleOptimization: true,
        h1H2H3Tags: true,
        metaDescription: true,
        imageAltTags: true,
        schemaMarkup: true,
        pageAudit: true
      }
    },
    standard: { 
      maxPages: 20, 
      maxDepth: 3, 
      price: '$39', 
      name: 'Standard', 
      description: 'Everything in Starter + Larger crawl (up to 20 pages), Advanced Local SEO, Full Schema Validation, Mobile Responsiveness, Thin Content Detection, Keyword Extraction (NLP), Readability Diagnostics, Security Checks, Platform Detection, Automated Fix Recommendations.',
      deliveryDays: 3, // 3 business days
      keywords: 5,
      includes: {
        titleOptimization: true,
        h1H2H3Tags: true,
        metaDescription: true,
        imageAltTags: true,
        schemaMarkup: true,
        pageAudit: true
      }
    },
    professional: { 
      maxPages: 50, 
      maxDepth: 5, 
      price: '$59', 
      name: 'Professional', 
      description: 'Everything in Standard + Deep crawl (up to 50 pages), Multi-level Internal Link Mapping, Crawl Diagnostics, Enhanced Accessibility, Full Keyword Opportunity Mapping, Content Structure Map, JS/CSS Payload Analysis, Core Web Vitals Opportunity Report, Priority Fix Action Plan.',
      deliveryDays: 4, // 4 business days
      keywords: 10,
      includes: {
        titleOptimization: true,
        h1H2H3Tags: true,
        metaDescription: true,
        imageAltTags: true,
        schemaMarkup: true,
        pageAudit: true
      }
    },
    agency: { 
      maxPages: 200, 
      maxDepth: 10, 
      price: '$99', 
      name: 'Agency / Enterprise', 
      description: 'Everything in Professional + Large crawl (up to 200 pages), 3 Competitor Crawls + Keyword Gap Analysis, Full Local SEO Suite, Social Signals Audit, JS Rendering Diagnostics, Full Internal Link Graph, Crawl Error Exclusion, Duplicate URL Cleaning, Blank Report included (free).',
      deliveryDays: 5, // 5 business days
      keywords: 1000, // Effectively unlimited
      includes: {
        titleOptimization: true,
        h1H2H3Tags: true,
        metaDescription: true,
        imageAltTags: true,
        schemaMarkup: true,
        pageAudit: true
      }
    }
  }

  const serviceOptions = [
    { key: 'titleOptimization', label: 'Title Optimization' },
    { key: 'h1H2H3Tags', label: 'H1, H2, H3 Tags' },
    { key: 'metaDescription', label: 'Meta Description' },
    { key: 'imageAltTags', label: 'Image Alt Tags' },
    { key: 'schemaMarkup', label: 'Schema Markup' },
    { key: 'pageAudit', label: 'Page Audit' }
  ]
  
  const addOnInfo = {
    blankReport: {
      name: 'Blank Report (Unbranded)',
      getPrice: (tier: AuditTier | null) => {
        if (tier === 'agency') return 0 // Free for Agency tier
        return 10
      },
      description: 'Unbranded white-label PDF report (free for Agency tier)'
    },
    additionalPages: {
      name: 'Additional Pages',
      price: 5,
      description: 'Per 50 pages',
      unit: '50-page blocks'
    },
    additionalKeywords: {
      name: 'Extra Keywords',
      price: 1,
      description: 'Per keyword',
      unit: 'keywords'
    },
    competitorAnalysis: { 
      name: 'Competitor Gap Analysis', 
      price: 15, 
      description: 'Keyword gap analysis comparing your site to competitors.' 
    },
    schemaDeepDive: {
      name: 'Schema Deep-Dive',
      price: 15,
      description: 'Deep-dive schema markup analysis (Starter tier add-on)'
    },
    additionalCompetitors: {
      name: 'Additional Competitors',
      price: 10,
      description: 'Per additional competitor crawl (Agency tier)',
      unit: 'competitors'
    },
    extraCrawlDepth: {
      name: 'Extra Crawl Depth',
      price: 15,
      description: 'Increased crawl depth for deeper site analysis (Agency tier)'
    },
    expedited: {
      name: '24-Hour Expedited Report',
      price: 15,
      description: 'Get your report delivered within 24 hours (expedited delivery)'
    }
  }
  
  const formatUrl = (input: string): string => {
    const trimmed = input.trim()
    if (!trimmed) return trimmed
    
    // If it already starts with http:// or https://, return as-is
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    
    // Otherwise, add https://
    return `https://${trimmed}`
  }

  const validateUrl = (input: string): boolean => {
    if (!input.trim()) {
      setUrlError('URL is required')
      return false
    }
    
    try {
      const formatted = formatUrl(input)
      new URL(formatted)
      setUrlError('')
      return true
    } catch {
      setUrlError('Please enter a valid URL (e.g., example.com or https://example.com)')
      return false
    }
  }

  const handleUrlChange = (value: string) => {
    setUrl(value)
    if (urlError) {
      setUrlError('')
    }
  }

  const updateCompetitorUrl = (index: number, value: string) => {
    const newUrls = [...competitorUrls]
    // Ensure array is large enough
    while (newUrls.length <= index) {
      newUrls.push('')
    }
    newUrls[index] = value
    // Remove trailing empty strings (but keep at least the slots we need)
    const maxSlots = getMaxCompetitorSlots()
    while (newUrls.length > maxSlots && newUrls[newUrls.length - 1] === '') {
      newUrls.pop()
    }
    setCompetitorUrls(newUrls)
  }

  const getMaxCompetitorSlots = (): number => {
    if (selectedTier === 'agency') {
      // Agency tier: base 3 + additional competitors add-on
      const additionalCount = addOns.additionalCompetitors ? (addOns.additionalCompetitors as number) : 0
      return Math.min(4, 3 + additionalCount) // Max 4 total
    }
    // For other tiers with competitor analysis add-on, show 3 slots
    if (addOns.competitorAnalysis) {
      return 3
    }
    return 0
  }

  const getCompetitorUrlValue = (index: number): string => {
    return competitorUrls[index] || ''
  }

  const toggleAddOn = (key: keyof AuditAddOns, isNumeric = false) => {
    if (isNumeric) {
      const current = (addOns[key] as number) || 0
      setAddOns({ ...addOns, [key]: current + 1 })
    } else {
      setAddOns({ ...addOns, [key]: !addOns[key] })
    }
  }
  
  const removeAddOn = (key: keyof AuditAddOns) => {
    const newAddOns = { ...addOns }
    if (typeof newAddOns[key] === 'number' && (newAddOns[key] as number) > 0) {
      newAddOns[key] = ((newAddOns[key] as number) - 1) as any
      if ((newAddOns[key] as number) === 0) {
        delete newAddOns[key]
      }
    } else {
      delete newAddOns[key]
    }
    setAddOns(newAddOns)
  }
  
  const calculateTotal = () => {
    let total = selectedTier ? parseInt(tierInfo[selectedTier].price.replace('$', '')) : 0
    
    // Blank Report (free for Agency tier)
    if (addOns.blankReport && selectedTier) {
      total += addOnInfo.blankReport.getPrice(selectedTier)
    }
    
    // Additional Pages (per 50 pages)
    if (addOns.additionalPages) {
      total += addOnInfo.additionalPages.price * (addOns.additionalPages as number)
    }
    
    // Additional Keywords (per keyword)
    if (addOns.additionalKeywords) {
      total += addOnInfo.additionalKeywords.price * (addOns.additionalKeywords as number)
    }
    
    // Competitor Analysis
    if (addOns.competitorAnalysis) {
      total += addOnInfo.competitorAnalysis.price
    }
    
    // Schema Deep-Dive
    if (addOns.schemaDeepDive) {
      total += addOnInfo.schemaDeepDive.price
    }
    
    // Additional Competitors (Agency tier)
    if (addOns.additionalCompetitors) {
      total += addOnInfo.additionalCompetitors.price * (addOns.additionalCompetitors as number)
    }
    
    // Extra Crawl Depth (Agency tier)
    if (addOns.extraCrawlDepth) {
      total += addOnInfo.extraCrawlDepth.price
    }
    
    // Expedited Delivery (all tiers)
    if (addOns.expedited) {
      total += addOnInfo.expedited.price
    }
    
    return total
  }
  
  const getExpectedDelivery = (): string => {
    if (!selectedTier) return ''
    if (addOns.expedited) {
      return '24 hours (expedited)'
    }
    const days = tierInfo[selectedTier].deliveryDays
    return `${days} business day${days > 1 ? 's' : ''}`
  }

  const handleSubmit = async (e: React.FormEvent, tier?: AuditTier) => {
    e.preventDefault()
    
    const auditTier = tier || selectedTier
    if (!auditTier) {
      toast({
        title: 'Select a tier',
        description: 'Please select an audit tier (Starter, Standard, Professional, or Agency)',
        variant: 'destructive'
      })
      return
    }
    
    // Validate and format URL
    if (!validateUrl(url)) {
      return
    }
    
    const formattedUrl = formatUrl(url)
    
    setLoading(true)

    try {
      const tierData = tierInfo[auditTier]
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formattedUrl,
          tier: auditTier,
          maxPages: tierData.maxPages,
          maxDepth: tierData.maxDepth,
          addOns: Object.keys(addOns).length > 0 ? addOns : undefined,
          competitorUrls: (addOns.competitorAnalysis || selectedTier === 'agency')
            ? competitorUrls.filter(url => url && url.trim().length > 0) // Only send non-empty URLs
            : undefined
        })
      })

      if (!res.ok) {
        // Try to parse error message, but handle HTML responses
        let errorMessage = 'Failed to create audit'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response is not JSON (e.g., 404 HTML page), use status text
          errorMessage = `Server error: ${res.status} ${res.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      toast({
        title: 'Audit started',
        description: 'The audit is running. You will be redirected to the audit page.'
      })
      
      // Redirect immediately to audit page (it will poll for completion)
      router.push(`/audits/${data.id}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create audit',
        variant: 'destructive'
      })
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/audits" className="text-blue-600 hover:underline">← Back to Audits</Link>
          <Link href="/audits" className="text-blue-600 hover:underline text-sm">View All Audits</Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Create New SEO Audit</CardTitle>
            <CardDescription>
              Enter the website URL to audit. The crawler will analyze technical SEO, on-page optimization, content quality, and accessibility.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onBlur={() => url && validateUrl(url)}
                  placeholder="example.com or https://example.com"
                  required
                  disabled={loading}
                  className={urlError ? 'border-red-500' : ''}
                />
                {urlError ? (
                  <p className="text-sm text-red-600">{urlError}</p>
                ) : (
                  <p className="text-sm text-gray-500">
                    Enter the root domain or any page URL to start crawling
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label>Select Audit Tier</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(['starter', 'standard', 'professional', 'agency'] as AuditTier[]).map((tier) => {
                    const info = tierInfo[tier]
                    const isSelected = selectedTier === tier
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setSelectedTier(tier)}
                        disabled={loading}
                        className={`relative p-4 border-2 rounded-lg text-left transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <Check className="h-5 w-5 text-blue-600" />
                          </div>
                        )}
                        <div className="font-semibold text-lg">{info.name}</div>
                        <div className="text-2xl font-bold text-blue-600 mt-1">{info.price}</div>
                        <div className="text-sm text-gray-600 mt-2">{info.description}</div>
                        <div className="text-xs text-gray-500 mt-2 space-y-1">
                          <div>Up to {info.maxPages} pages • Depth {info.maxDepth}</div>
                          <div>{info.keywords} keywords • Expected: {info.deliveryDays} business {info.deliveryDays === 1 ? 'day' : 'days'}</div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs font-medium text-gray-700 mb-2">Includes:</div>
                          <div className="space-y-1">
                            {serviceOptions.map(service => (
                              <div key={service.key} className="flex items-center text-xs">
                                {info.includes[service.key as keyof typeof info.includes] ? (
                                  <Check className="h-3 w-3 text-green-600 mr-1.5 flex-shrink-0" />
                                ) : (
                                  <div className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                )}
                                <span className={info.includes[service.key as keyof typeof info.includes] ? 'text-gray-700' : 'text-gray-400'}>
                                  {service.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedTier && (
                <div className="space-y-3 border-t pt-4">
                  <Label>Optional Add-Ons</Label>
                  <div className="grid grid-cols-1 gap-3">
                    {/* Blank Report (Unbranded) - Free for Agency, paid for others */}
                    {selectedTier === 'agency' ? (
                      <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50 border-green-200">
                        <div>
                          <div className="font-medium">{addOnInfo.blankReport.name} (Included)</div>
                          <div className="text-sm text-gray-500">Unbranded white-label PDF report (free with Agency tier)</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-green-600">Free</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={() => toggleAddOn('blankReport')}
                            disabled={loading}
                          >
                            {addOns.blankReport ? 'Included' : 'Include'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex items-center justify-between p-3 border rounded-lg ${addOns.blankReport ? 'bg-blue-50 border-blue-200' : ''}`}>
                        <div>
                          <div className="font-medium">{addOnInfo.blankReport.name}</div>
                          <div className="text-sm text-gray-500">{addOnInfo.blankReport.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">+${addOnInfo.blankReport.getPrice(selectedTier)}.00</span>
                          <Button
                            type="button"
                            size="sm"
                            variant={addOns.blankReport ? "default" : "outline"}
                            onClick={() => toggleAddOn('blankReport')}
                            disabled={loading}
                          >
                            {addOns.blankReport ? 'Added' : 'Add'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Additional Pages (per 50) - NOT available for Agency tier */}
                    {selectedTier !== 'agency' && (
                      <div className={`flex items-center justify-between p-3 border rounded-lg ${addOns.additionalPages && (addOns.additionalPages as number) > 0 ? 'bg-blue-50 border-blue-200' : ''}`}>
                        <div>
                          <div className="font-medium">{addOnInfo.additionalPages.name}</div>
                          <div className="text-sm text-gray-500">{addOnInfo.additionalPages.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">+${addOnInfo.additionalPages.price}.00/{addOnInfo.additionalPages.unit}</span>
                          <div className="flex items-center gap-2">
                            {addOns.additionalPages && (addOns.additionalPages as number) > 0 ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeAddOn('additionalPages')}
                                  disabled={loading}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-semibold w-8 text-center">{addOns.additionalPages}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleAddOn('additionalPages', true)}
                                  disabled={loading}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <span className="text-xs text-gray-600">(+${addOnInfo.additionalPages.price * (addOns.additionalPages as number)}.00)</span>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => toggleAddOn('additionalPages', true)}
                                disabled={loading}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Extra Keywords - NOT available for Agency tier */}
                    {selectedTier !== 'agency' && (
                      <div className={`flex items-center justify-between p-3 border rounded-lg ${addOns.additionalKeywords && (addOns.additionalKeywords as number) > 0 ? 'bg-blue-50 border-blue-200' : ''}`}>
                        <div>
                          <div className="font-medium">{addOnInfo.additionalKeywords.name}</div>
                          <div className="text-sm text-gray-500">{addOnInfo.additionalKeywords.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">+${addOnInfo.additionalKeywords.price}.00/{addOnInfo.additionalKeywords.unit}</span>
                          <div className="flex items-center gap-2">
                            {addOns.additionalKeywords && (addOns.additionalKeywords as number) > 0 ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeAddOn('additionalKeywords')}
                                  disabled={loading}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-semibold w-8 text-center">{addOns.additionalKeywords}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleAddOn('additionalKeywords', true)}
                                  disabled={loading}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <span className="text-xs text-gray-600">(+${addOnInfo.additionalKeywords.price * (addOns.additionalKeywords as number)}.00)</span>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => toggleAddOn('additionalKeywords', true)}
                                disabled={loading}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Schema Deep-Dive (Starter tier only) */}
                    {selectedTier === 'starter' && (
                      <div className={`flex items-center justify-between p-3 border rounded-lg ${addOns.schemaDeepDive ? 'bg-blue-50 border-blue-200' : ''}`}>
                        <div>
                          <div className="font-medium">{addOnInfo.schemaDeepDive.name}</div>
                          <div className="text-sm text-gray-500">{addOnInfo.schemaDeepDive.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">+${addOnInfo.schemaDeepDive.price}.00</span>
                          <Button
                            type="button"
                            size="sm"
                            variant={addOns.schemaDeepDive ? "default" : "outline"}
                            onClick={() => toggleAddOn('schemaDeepDive')}
                            disabled={loading}
                          >
                            {addOns.schemaDeepDive ? 'Added' : 'Add'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Competitor Keyword Gap Report - Only for Starter/Standard tiers */}
                    {selectedTier !== 'professional' && selectedTier !== 'agency' && (
                      <div className={`flex flex-col p-3 border rounded-lg ${addOns.competitorAnalysis ? 'bg-blue-50 border-blue-200' : ''}`}>
                        <div className="flex items-center justify-between w-full mb-2">
                          <div>
                            <div className="font-medium">{addOnInfo.competitorAnalysis.name}</div>
                            <div className="text-sm text-gray-500">{addOnInfo.competitorAnalysis.description}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">+${addOnInfo.competitorAnalysis.price}.00</span>
                            <Button
                              type="button"
                              size="sm"
                              variant={addOns.competitorAnalysis ? "default" : "outline"}
                              onClick={() => toggleAddOn('competitorAnalysis')}
                              disabled={loading}
                            >
                              {addOns.competitorAnalysis ? 'Added' : 'Add'}
                            </Button>
                          </div>
                        </div>
                        
                        {/* Competitor URL Inputs for Starter/Standard */}
                        {addOns.competitorAnalysis && (
                          <div className="mt-3 pl-2 border-l-2 border-blue-200 space-y-3">
                            <Label className="text-xs text-gray-600">
                              Optional: Add specific competitor URLs (leave empty to auto-detect)
                            </Label>
                            <div className="space-y-2">
                              {Array.from({ length: 3 }).map((_, index) => {
                                const urlValue = getCompetitorUrlValue(index)
                                return (
                                  <div key={index} className="flex items-center gap-2">
                                    <Input
                                      placeholder={`Competitor ${index + 1} URL (optional)`}
                                      value={urlValue}
                                      onChange={(e) => updateCompetitorUrl(index, e.target.value)}
                                      onBlur={(e) => {
                                        // Auto-format URL on blur
                                        if (e.target.value.trim()) {
                                          try {
                                            const formatted = formatUrl(e.target.value)
                                            new URL(formatted)
                                            updateCompetitorUrl(index, formatted)
                                          } catch {
                                            // Invalid URL, show error toast
                                            toast({
                                              title: 'Invalid URL',
                                              description: 'Please enter a valid URL (e.g., example.com or https://example.com)',
                                              variant: 'destructive'
                                            })
                                          }
                                        }
                                      }}
                                      className="bg-white h-9 text-sm flex-1"
                                      disabled={loading}
                                    />
                                    {urlValue && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => updateCompetitorUrl(index, '')}
                                        disabled={loading}
                                      >
                                        <Minus className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Leave empty to auto-detect competitors based on your industry.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Agency Tier: Competitor URLs (included, always shown) */}
                    {selectedTier === 'agency' && (
                      <div className="flex flex-col p-3 border rounded-lg bg-blue-50 border-blue-200">
                        <div className="flex items-center justify-between w-full mb-2">
                          <div>
                            <div className="font-medium">Competitor Analysis (Included)</div>
                            <div className="text-sm text-gray-500">3 competitor crawls + keyword gap analysis (included with Agency tier)</div>
                          </div>
                        </div>
                        
                        {/* Competitor URL Inputs for Agency tier */}
                        <div className="mt-3 pl-2 border-l-2 border-blue-200 space-y-3">
                          <Label className="text-xs text-gray-600">
                            Add competitor URLs (leave empty to auto-detect)
                            {(() => {
                              const maxSlots = getMaxCompetitorSlots()
                              return (
                                <span className="text-gray-500 ml-1">
                                  ({maxSlots} {maxSlots === 1 ? 'slot' : 'slots'} available)
                                </span>
                              )
                            })()}
                          </Label>
                          <div className="space-y-2">
                            {Array.from({ length: getMaxCompetitorSlots() }).map((_, index) => {
                              const urlValue = getCompetitorUrlValue(index)
                              return (
                                <div key={index} className="flex items-center gap-2">
                                  <Input
                                    placeholder={`Competitor ${index + 1} URL (optional)`}
                                    value={urlValue}
                                    onChange={(e) => updateCompetitorUrl(index, e.target.value)}
                                    onBlur={(e) => {
                                      // Auto-format URL on blur
                                      if (e.target.value.trim()) {
                                        try {
                                          const formatted = formatUrl(e.target.value)
                                          new URL(formatted)
                                          updateCompetitorUrl(index, formatted)
                                        } catch {
                                          // Invalid URL, show error toast
                                          toast({
                                            title: 'Invalid URL',
                                            description: 'Please enter a valid URL (e.g., example.com or https://example.com)',
                                            variant: 'destructive'
                                          })
                                        }
                                      }
                                    }}
                                    className="bg-white h-9 text-sm flex-1"
                                    disabled={loading}
                                  />
                                  {urlValue && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => updateCompetitorUrl(index, '')}
                                      disabled={loading}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Agency tier includes {getMaxCompetitorSlots()} competitor crawls. Leave empty to auto-detect.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Additional Competitors (Agency tier only) */}
                    {selectedTier === 'agency' && (
                      <div className={`flex items-center justify-between p-3 border rounded-lg ${addOns.additionalCompetitors && (addOns.additionalCompetitors as number) > 0 ? 'bg-blue-50 border-blue-200' : ''}`}>
                        <div>
                          <div className="font-medium">{addOnInfo.additionalCompetitors.name}</div>
                          <div className="text-sm text-gray-500">{addOnInfo.additionalCompetitors.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">+${addOnInfo.additionalCompetitors.price}.00/{addOnInfo.additionalCompetitors.unit}</span>
                          <div className="flex items-center gap-2">
                            {addOns.additionalCompetitors && (addOns.additionalCompetitors as number) > 0 ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeAddOn('additionalCompetitors')}
                                  disabled={loading}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-semibold w-8 text-center">{addOns.additionalCompetitors}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleAddOn('additionalCompetitors', true)}
                                  disabled={loading}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <span className="text-xs text-gray-600">(+${addOnInfo.additionalCompetitors.price * (addOns.additionalCompetitors as number)}.00)</span>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => toggleAddOn('additionalCompetitors', true)}
                                disabled={loading}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Extra Crawl Depth (Agency tier only) */}
                    {selectedTier === 'agency' && (
                      <div className={`flex items-center justify-between p-3 border rounded-lg ${addOns.extraCrawlDepth ? 'bg-blue-50 border-blue-200' : ''}`}>
                        <div>
                          <div className="font-medium">{addOnInfo.extraCrawlDepth.name}</div>
                          <div className="text-sm text-gray-500">{addOnInfo.extraCrawlDepth.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">+${addOnInfo.extraCrawlDepth.price}.00</span>
                          <Button
                            type="button"
                            size="sm"
                            variant={addOns.extraCrawlDepth ? "default" : "outline"}
                            onClick={() => toggleAddOn('extraCrawlDepth')}
                            disabled={loading}
                          >
                            {addOns.extraCrawlDepth ? 'Added' : 'Add'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Expedited Delivery (all tiers) */}
                    {selectedTier && (
                      <div className={`flex items-center justify-between p-3 border rounded-lg ${addOns.expedited ? 'bg-blue-50 border-blue-200' : ''}`}>
                        <div>
                          <div className="font-medium">{addOnInfo.expedited.name}</div>
                          <div className="text-sm text-gray-500">{addOnInfo.expedited.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">+${addOnInfo.expedited.price}.00</span>
                          <Button
                            type="button"
                            size="sm"
                            variant={addOns.expedited ? "default" : "outline"}
                            onClick={() => toggleAddOn('expedited')}
                            disabled={loading}
                          >
                            {addOns.expedited ? 'Added' : 'Add'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{selectedTier ? tierInfo[selectedTier].name : ''} Audit</span>
                        <span className="font-medium">${selectedTier ? parseInt(tierInfo[selectedTier].price.replace('$', '')) : 0}.00</span>
                      </div>
                      {addOns.blankReport && selectedTier && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.blankReport.name}</span>
                          <span className="font-medium">
                            {selectedTier === 'agency' ? 'Free' : `+$${addOnInfo.blankReport.getPrice(selectedTier)}.00`}
                          </span>
                        </div>
                      )}
                      {selectedTier === 'agency' && !addOns.blankReport && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.blankReport.name}</span>
                          <span className="font-medium text-green-600">Included (Free)</span>
                        </div>
                      )}
                      {addOns.additionalPages && (addOns.additionalPages as number) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.additionalPages.name} ({(addOns.additionalPages as number)} {addOnInfo.additionalPages.unit})</span>
                          <span className="font-medium">+${addOnInfo.additionalPages.price * (addOns.additionalPages as number)}.00</span>
                        </div>
                      )}
                      {addOns.additionalKeywords && (addOns.additionalKeywords as number) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.additionalKeywords.name} ({(addOns.additionalKeywords as number)} {addOns.additionalKeywords === 1 ? 'keyword' : 'keywords'})</span>
                          <span className="font-medium">+${addOnInfo.additionalKeywords.price * (addOns.additionalKeywords as number)}.00</span>
                        </div>
                      )}
                      {(addOns.competitorAnalysis || selectedTier === 'agency') && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {selectedTier === 'agency' 
                              ? 'Competitor Analysis (Included)' 
                              : addOnInfo.competitorAnalysis.name}
                          </span>
                          <span className="font-medium">
                            {selectedTier === 'agency' ? 'Included' : `+$${addOnInfo.competitorAnalysis.price}.00`}
                          </span>
                        </div>
                      )}
                      {addOns.schemaDeepDive && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.schemaDeepDive.name}</span>
                          <span className="font-medium">+${addOnInfo.schemaDeepDive.price}.00</span>
                        </div>
                      )}
                      {addOns.additionalCompetitors && (addOns.additionalCompetitors as number) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.additionalCompetitors.name} ({(addOns.additionalCompetitors as number)} {addOns.additionalCompetitors === 1 ? 'competitor' : 'competitors'})</span>
                          <span className="font-medium">+${addOnInfo.additionalCompetitors.price * (addOns.additionalCompetitors as number)}.00</span>
                        </div>
                      )}
                      {addOns.extraCrawlDepth && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.extraCrawlDepth.name}</span>
                          <span className="font-medium">+${addOnInfo.extraCrawlDepth.price}.00</span>
                        </div>
                      )}
                      {addOns.expedited && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.expedited.name}</span>
                          <span className="font-medium">+${addOnInfo.expedited.price}.00</span>
                        </div>
                      )}
                      {selectedTier && (
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between items-center text-sm mb-2">
                            <span className="text-gray-600">Expected Delivery:</span>
                            <span className="font-medium text-blue-600">{getExpectedDelivery()}</span>
                          </div>
                        </div>
                      )}
                      <div className="border-t pt-2 mt-2 flex justify-between items-center">
                        <span className="font-semibold text-gray-900">Total</span>
                        <span className="text-2xl font-bold text-blue-600">${calculateTotal()}.00</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  onClick={(e) => handleSubmit(e as any)}
                  disabled={loading || !selectedTier || !url}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Audit...
                    </>
                  ) : (
                    `Run ${selectedTier ? tierInfo[selectedTier].name : ''} Audit`
                  )}
                </Button>
                <Link href="/audits">
                  <Button type="button" variant="outline" disabled={loading}>
                    Cancel
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function NewAuditPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <NewAuditPageContent />
    </Suspense>
  )
}

