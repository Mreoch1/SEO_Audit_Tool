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
  
  const tierInfo = {
    starter: { maxPages: 3, maxDepth: 2, price: '$39', name: 'Starter', description: 'Quick scan of 1-3 pages' },
    standard: { maxPages: 20, maxDepth: 3, price: '$89', name: 'Standard', description: 'Full site audit (up to 20 pages)' },
    advanced: { maxPages: 50, maxDepth: 5, price: '$149', name: 'Advanced', description: 'Complete audit (up to 50 pages)' }
  }
  
  const addOnInfo = {
    fastDelivery: { name: 'Fast Delivery', price: 25, description: '24-hour delivery' },
    additionalPages: { name: 'Additional Pages', price: 10, description: 'Per page', unit: 'pages' },
    additionalKeywords: { name: 'Additional Keywords', price: 5, description: 'Per keyword', unit: 'keywords' },
    imageAltTags: { name: 'Image Alt Tags', price: 15, description: 'Alt tag optimization' },
    schemaMarkup: { name: 'Schema Markup', price: 30, description: 'Schema markup analysis' },
    competitorAnalysis: { name: 'Competitor Keyword Gap', price: 39, description: 'Competitor analysis report' }
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
    if (addOns.fastDelivery) total += addOnInfo.fastDelivery.price
    if (addOns.additionalPages) total += addOnInfo.additionalPages.price * (addOns.additionalPages as number)
    if (addOns.additionalKeywords) total += addOnInfo.additionalKeywords.price * (addOns.additionalKeywords as number)
    if (addOns.imageAltTags) total += addOnInfo.imageAltTags.price
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
    
    if (!url) {
      toast({
        title: 'URL required',
        description: 'Please enter a website URL',
        variant: 'destructive'
      })
      return
    }
    
    setLoading(true)

    try {
      const tierData = tierInfo[auditTier]
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          tier: auditTier,
          maxPages: tierData.maxPages,
          maxDepth: tierData.maxDepth,
          addOns: Object.keys(addOns).length > 0 ? addOns : undefined
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create audit')
      }

      const data = await res.json()
      toast({
        title: 'Audit started',
        description: 'The audit is running. You will be redirected when complete.'
      })
      
      // Poll for completion (simple approach - in production, use websockets or better polling)
      setTimeout(() => {
        router.push(`/audits/${data.id}`)
      }, 2000)
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
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                  disabled={loading}
                />
                <p className="text-sm text-gray-500">
                  Enter the root domain or any page URL to start crawling
                </p>
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
                        <div className="text-xs text-gray-500 mt-2">
                          Up to {info.maxPages} pages • Depth {info.maxDepth}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedTier && (
                <div className="space-y-3 border-t pt-4">
                  <Label>Optional Add-Ons</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Fast Delivery */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{addOnInfo.fastDelivery.name}</div>
                        <div className="text-sm text-gray-500">{addOnInfo.fastDelivery.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">+${addOnInfo.fastDelivery.price}</span>
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

                    {/* Additional Pages */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{addOnInfo.additionalPages.name}</div>
                        <div className="text-sm text-gray-500">{addOnInfo.additionalPages.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">+${addOnInfo.additionalPages.price}/{addOnInfo.additionalPages.unit}</span>
                        <div className="flex items-center gap-1">
                          {addOns.additionalPages && (addOns.additionalPages as number) > 0 && (
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
                              <span className="text-sm w-8 text-center">{addOns.additionalPages}</span>
                            </>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => toggleAddOn('additionalPages', true)}
                            disabled={loading}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Additional Keywords */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{addOnInfo.additionalKeywords.name}</div>
                        <div className="text-sm text-gray-500">{addOnInfo.additionalKeywords.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">+${addOnInfo.additionalKeywords.price}/{addOnInfo.additionalKeywords.unit}</span>
                        <div className="flex items-center gap-1">
                          {addOns.additionalKeywords && (addOns.additionalKeywords as number) > 0 && (
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
                              <span className="text-sm w-8 text-center">{addOns.additionalKeywords}</span>
                            </>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => toggleAddOn('additionalKeywords', true)}
                            disabled={loading}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Image Alt Tags */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{addOnInfo.imageAltTags.name}</div>
                        <div className="text-sm text-gray-500">{addOnInfo.imageAltTags.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">+${addOnInfo.imageAltTags.price}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant={addOns.imageAltTags ? "default" : "outline"}
                          onClick={() => toggleAddOn('imageAltTags')}
                          disabled={loading}
                        >
                          {addOns.imageAltTags ? 'Added' : 'Add'}
                        </Button>
                      </div>
                    </div>

                    {/* Schema Markup */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{addOnInfo.schemaMarkup.name}</div>
                        <div className="text-sm text-gray-500">{addOnInfo.schemaMarkup.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">+${addOnInfo.schemaMarkup.price}</span>
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

                    {/* Competitor Analysis */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{addOnInfo.competitorAnalysis.name}</div>
                        <div className="text-sm text-gray-500">{addOnInfo.competitorAnalysis.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">+${addOnInfo.competitorAnalysis.price}</span>
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
                  </div>
                  
                  <div className="flex justify-end pt-2 border-t">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Total</div>
                      <div className="text-2xl font-bold text-blue-600">${calculateTotal()}</div>
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

