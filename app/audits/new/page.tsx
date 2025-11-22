'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Check, Plus, Minus } from 'lucide-react'
import type { AuditTier, AuditAddOns } from '@/lib/types'

export default function NewAuditPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [url, setUrl] = useState('')
  const [selectedTier, setSelectedTier] = useState<AuditTier | null>(null)
  const [loading, setLoading] = useState(false)
  const [addOns, setAddOns] = useState<AuditAddOns>({})
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([])
  const [competitorInput, setCompetitorInput] = useState('')
  const [urlError, setUrlError] = useState('')
  
  const tierInfo = {
    starter: { 
      maxPages: 3, 
      maxDepth: 2, 
      price: '$19', 
      name: 'Starter: Mini SEO Audit', 
      description: 'Quick scan of 1–3 pages with key SEO issues and fixes.',
      deliveryDays: 1,
      keywords: 0,
      includes: {
        titleOptimization: true,
        h1H2H3Tags: true,
        metaDescription: true,
        imageAltTags: true,
        schemaMarkup: false,
        pageAudit: false
      }
    },
    standard: { 
      maxPages: 20, 
      maxDepth: 3, 
      price: '$29', 
      name: 'Standard: Full SEO Audit', 
      description: 'Full site audit with technical, on-page, and performance checks.',
      deliveryDays: 2,
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
    advanced: { 
      maxPages: 50, 
      maxDepth: 5, 
      price: '$39', 
      name: 'Advanced: SEO Audit+Competitor', 
      description: 'Complete audit plus competitor analysis and action plan.',
      deliveryDays: 2,
      keywords: 10,
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
    fastDelivery: {
      name: 'Fast Delivery',
      getPrice: (tier: AuditTier | null) => {
        if (tier === 'standard') return 10
        if (tier === 'advanced') return 15
        return 0 // Not available for starter
      },
      getDays: () => 1,
      description: 'Faster delivery'
    },
    additionalPages: {
      name: 'Additional Page Optimized',
      price: 5,
      description: 'Per page',
      unit: 'pages'
    },
    additionalKeywords: {
      name: 'Additional Keyword Researched',
      price: 1,
      description: 'Per keyword',
      unit: 'keywords'
    },
    schemaMarkup: {
      name: 'Schema Markup',
      price: 15,
      description: 'Schema markup analysis'
    },
    competitorAnalysis: { 
      name: 'Competitor Keyword Gap Report', 
      price: 15, 
      description: 'Full keyword gap analysis for your top competitors.' 
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

  const addCompetitorUrl = () => {
    if (!competitorInput.trim()) return
    
    try {
      const formatted = formatUrl(competitorInput)
      new URL(formatted)
      setCompetitorUrls([...competitorUrls, formatted])
      setCompetitorInput('')
    } catch {
      // Ignore invalid URLs for now or show a toast
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL for the competitor',
        variant: 'destructive'
      })
    }
  }

  const removeCompetitorUrl = (index: number) => {
    const newUrls = [...competitorUrls]
    newUrls.splice(index, 1)
    setCompetitorUrls(newUrls)
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
    if (addOns.fastDelivery && selectedTier) {
      total += addOnInfo.fastDelivery.getPrice(selectedTier)
    }
    if (addOns.additionalPages) {
      total += addOnInfo.additionalPages.price * (addOns.additionalPages as number)
    }
    if (addOns.additionalKeywords) {
      total += addOnInfo.additionalKeywords.price * (addOns.additionalKeywords as number)
    }
    if (addOns.schemaMarkup) total += addOnInfo.schemaMarkup.price
    if (addOns.competitorAnalysis) total += addOnInfo.competitorAnalysis.price
    return total
  }

  const handleSubmit = async (e: React.FormEvent, tier?: AuditTier) => {
    e.preventDefault()
    
    const auditTier = tier || selectedTier
    if (!auditTier) {
      toast({
        title: 'Select a tier',
        description: 'Please select an audit tier (Starter, Standard, or Advanced)',
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
          competitorUrls: addOns.competitorAnalysis ? competitorUrls : undefined
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
        <div className="container mx-auto px-4 py-4">
          <Link href="/" className="text-blue-600 hover:underline">← Back to Dashboard</Link>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['starter', 'standard', 'advanced'] as AuditTier[]).map((tier) => {
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
                          <div>{info.keywords} keywords • {info.deliveryDays} {info.deliveryDays === 1 ? 'day' : 'days'} delivery</div>
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
                    {/* Fast Delivery */}
                    {selectedTier !== 'starter' && (
                      <div className={`flex items-center justify-between p-3 border rounded-lg ${addOns.fastDelivery ? 'bg-blue-50 border-blue-200' : ''}`}>
                        <div>
                          <div className="font-medium">{addOnInfo.fastDelivery.name}</div>
                          <div className="text-sm text-gray-500">{addOnInfo.fastDelivery.description} ({addOnInfo.fastDelivery.getDays()} delivery day)</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">+${addOnInfo.fastDelivery.getPrice(selectedTier)}.00</span>
                          <Button
                            type="button"
                            size="sm"
                            variant={addOns.fastDelivery ? "default" : "outline"}
                            onClick={() => toggleAddOn('fastDelivery')}
                            disabled={loading}
                          >
                            {addOns.fastDelivery ? 'Added' : 'Add'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Additional Page Optimized */}
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

                    {/* Additional Keyword Researched */}
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

                    {/* Schema Markup */}
                    <div className={`flex items-center justify-between p-3 border rounded-lg ${addOns.schemaMarkup ? 'bg-blue-50 border-blue-200' : ''}`}>
                      <div>
                        <div className="font-medium">{addOnInfo.schemaMarkup.name}</div>
                        <div className="text-sm text-gray-500">{addOnInfo.schemaMarkup.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">+${addOnInfo.schemaMarkup.price}.00</span>
                        <Button
                          type="button"
                          size="sm"
                          variant={addOns.schemaMarkup ? "default" : "outline"}
                          onClick={() => toggleAddOn('schemaMarkup')}
                          disabled={loading}
                        >
                          {addOns.schemaMarkup ? 'Added' : 'Add'}
                        </Button>
                      </div>
                    </div>

                    {/* Competitor Keyword Gap Report */}
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
                      
                      {/* Competitor URL Inputs */}
                      {addOns.competitorAnalysis && (
                        <div className="mt-3 pl-2 border-l-2 border-blue-200 space-y-3">
                          <Label className="text-xs text-gray-600">Optional: Add specific competitor URLs (leave empty to auto-detect)</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="https://competitor.com"
                              value={competitorInput}
                              onChange={(e) => setCompetitorInput(e.target.value)}
                              className="bg-white h-8 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  addCompetitorUrl()
                                }
                              }}
                            />
                            <Button 
                              type="button" 
                              size="sm" 
                              variant="secondary"
                              onClick={addCompetitorUrl}
                              disabled={loading || !competitorInput}
                            >
                              Add
                            </Button>
                          </div>
                          
                          {competitorUrls.length > 0 && (
                            <div className="space-y-2">
                              {competitorUrls.map((compUrl, index) => (
                                <div key={index} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
                                  <span className="truncate max-w-[200px]">{compUrl}</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => removeCompetitorUrl(index)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{selectedTier ? tierInfo[selectedTier].name : ''} Audit</span>
                        <span className="font-medium">${selectedTier ? parseInt(tierInfo[selectedTier].price.replace('$', '')) : 0}.00</span>
                      </div>
                      {addOns.fastDelivery && selectedTier && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.fastDelivery.name}</span>
                          <span className="font-medium">+${addOnInfo.fastDelivery.getPrice(selectedTier)}.00</span>
                        </div>
                      )}
                      {addOns.additionalPages && (addOns.additionalPages as number) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.additionalPages.name} ({(addOns.additionalPages as number)} {addOns.additionalPages === 1 ? 'page' : 'pages'})</span>
                          <span className="font-medium">+${addOnInfo.additionalPages.price * (addOns.additionalPages as number)}.00</span>
                        </div>
                      )}
                      {addOns.additionalKeywords && (addOns.additionalKeywords as number) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.additionalKeywords.name} ({(addOns.additionalKeywords as number)} {addOns.additionalKeywords === 1 ? 'keyword' : 'keywords'})</span>
                          <span className="font-medium">+${addOnInfo.additionalKeywords.price * (addOns.additionalKeywords as number)}.00</span>
                        </div>
                      )}
                      {addOns.schemaMarkup && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.schemaMarkup.name}</span>
                          <span className="font-medium">+${addOnInfo.schemaMarkup.price}.00</span>
                        </div>
                      )}
                      {addOns.competitorAnalysis && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{addOnInfo.competitorAnalysis.name}</span>
                          <span className="font-medium">+${addOnInfo.competitorAnalysis.price}.00</span>
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
                <Link href="/">
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

