'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { Download, Mail, Copy, AlertCircle, CheckCircle, Info } from 'lucide-react'

interface AuditData {
  id: string
  url: string
  createdAt: string
  overallScore: number
  technicalScore: number
  onPageScore: number
  contentScore: number
  accessibilityScore: number
  shortSummary: string
  detailedSummary: string
  issues: Array<{
    id: string
    category: string
    severity: string
    message: string
    details: string | null
    affectedPages: string[]
  }>
  rawJson: any
}

export default function AuditDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [audit, setAudit] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailLoading, setEmailLoading] = useState(false)

  useEffect(() => {
    fetchAudit()
  }, [params.id])

  const fetchAudit = async () => {
    try {
      const res = await fetch(`/api/audits/${params.id}`)
      if (!res.ok) throw new Error('Failed to fetch audit')
      const data = await res.json()
      setAudit(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load audit',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = () => {
    window.open(`/api/audits/${params.id}/pdf`, '_blank')
  }

  const handleEmailReport = async () => {
    const email = prompt('Enter email address to send report to:')
    if (!email) return

    setEmailLoading(true)
    try {
      const res = await fetch(`/api/audits/${params.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailTo: email })
      })

      if (!res.ok) throw new Error('Failed to send email')

      toast({
        title: 'Success',
        description: 'Report sent successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send email',
        variant: 'destructive'
      })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleCopySummary = () => {
    if (!audit) return
    navigator.clipboard.writeText(audit.shortSummary)
    toast({
      title: 'Copied',
      description: 'Summary copied to clipboard'
    })
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!audit) {
    return <div className="min-h-screen flex items-center justify-center">Audit not found</div>
  }

  const allIssues = audit.issues
  const issuesByCategory = {
    Technical: allIssues.filter(i => i.category === 'Technical'),
    'On-page': allIssues.filter(i => i.category === 'On-page'),
    Content: allIssues.filter(i => i.category === 'Content'),
    Accessibility: allIssues.filter(i => i.category === 'Accessibility'),
    Performance: allIssues.filter(i => i.category === 'Performance')
  }

  const issuesBySeverity = {
    High: allIssues.filter(i => i.severity === 'High'),
    Medium: allIssues.filter(i => i.severity === 'Medium'),
    Low: allIssues.filter(i => i.severity === 'Low')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <Link href="/" className="text-blue-600 hover:underline">← Back to Dashboard</Link>
            <h1 className="text-2xl font-bold mt-2">{audit.url}</h1>
            {(audit.rawJson?.raw?.options?.tier || (audit.rawJson?.raw?.options?.addOns && Object.keys(audit.rawJson.raw.options.addOns).length > 0)) && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                {audit.rawJson?.raw?.options?.tier && (
                  <div className="mb-1">
                    <span className="font-medium">Tier: </span>
                    <span className="text-blue-600">{audit.rawJson.raw.options.tier.charAt(0).toUpperCase() + audit.rawJson.raw.options.tier.slice(1)}</span>
                    {audit.rawJson.raw.options.addOns?.fastDelivery && (
                      <span className="ml-3 px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-semibold">
                        ⚡ Fast Delivery (24h)
                      </span>
                    )}
                  </div>
                )}
                {audit.rawJson?.raw?.options?.addOns && Object.keys(audit.rawJson.raw.options.addOns).length > 0 && (
                  <div>
                    <span className="font-medium">Add-Ons: </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {audit.rawJson.raw.options.addOns.fastDelivery && (
                        <span className="px-2 py-0.5 bg-white rounded text-xs border">Fast Delivery</span>
                      )}
                      {audit.rawJson.raw.options.addOns.additionalPages && (
                        <span className="px-2 py-0.5 bg-white rounded text-xs border">
                          +{audit.rawJson.raw.options.addOns.additionalPages} Pages
                        </span>
                      )}
                      {audit.rawJson.raw.options.addOns.additionalKeywords && (
                        <span className="px-2 py-0.5 bg-white rounded text-xs border">
                          +{audit.rawJson.raw.options.addOns.additionalKeywords} Keywords
                        </span>
                      )}
                      {audit.rawJson.raw.options.addOns.imageAltTags && (
                        <span className="px-2 py-0.5 bg-white rounded text-xs border">Image Alt Tags</span>
                      )}
                      {audit.rawJson.raw.options.addOns.schemaMarkup && (
                        <span className="px-2 py-0.5 bg-white rounded text-xs border">Schema Markup</span>
                      )}
                      {audit.rawJson.raw.options.addOns.competitorAnalysis && (
                        <span className="px-2 py-0.5 bg-white rounded text-xs border">Competitor Analysis</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCopySummary} variant="outline" size="sm">
              <Copy className="mr-2 h-4 w-4" />
              Copy Summary
            </Button>
            <Button onClick={handleDownloadPDF} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button onClick={handleEmailReport} variant="outline" size="sm" disabled={emailLoading}>
              <Mail className="mr-2 h-4 w-4" />
              Email Report
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Scores */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Overall Score</CardDescription>
              <CardTitle className="text-3xl">{audit.overallScore}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Technical</CardDescription>
              <CardTitle className="text-2xl">{audit.technicalScore}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>On-Page</CardDescription>
              <CardTitle className="text-2xl">{audit.onPageScore}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Content</CardDescription>
              <CardTitle className="text-2xl">{audit.contentScore}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Accessibility</CardDescription>
              <CardTitle className="text-2xl">{audit.accessibilityScore}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList className={audit.rawJson?.imageAltAnalysis || audit.rawJson?.competitorAnalysis ? 'grid grid-cols-6' : ''}>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            {audit.rawJson?.imageAltAnalysis && <TabsTrigger value="alt-tags">Alt Tags</TabsTrigger>}
            {audit.rawJson?.competitorAnalysis && <TabsTrigger value="competitor">Competitor</TabsTrigger>}
            <TabsTrigger value="raw">Raw Data</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Executive Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-line text-sm leading-relaxed">
                  {audit.detailedSummary}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issues">
            <div className="space-y-4">
              {Object.entries(issuesBySeverity).map(([severity, issues]) => (
                issues.length > 0 && (
                  <Card key={severity}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {severity === 'High' && <AlertCircle className="h-5 w-5 text-red-600" />}
                        {severity === 'Medium' && <Info className="h-5 w-5 text-yellow-600" />}
                        {severity === 'Low' && <CheckCircle className="h-5 w-5 text-green-600" />}
                        {severity} Priority ({issues.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {issues.map((issue) => (
                          <div key={issue.id} className="border-l-4 border-gray-300 pl-4 py-2">
                            <div className="font-semibold">{issue.message}</div>
                            {issue.details && (
                              <div className="text-sm text-gray-600 mt-1">{issue.details}</div>
                            )}
                            {issue.affectedPages && issue.affectedPages.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Affected: {issue.affectedPages.length} page(s)
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              ))}
            </div>
          </TabsContent>

          <TabsContent value="pages">
            <Card>
              <CardHeader>
                <CardTitle>Scanned Pages ({audit.rawJson?.pages?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">URL</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Title</th>
                        <th className="text-left p-2">Words</th>
                        <th className="text-left p-2">H1</th>
                        <th className="text-left p-2">Images</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.rawJson?.pages?.slice(0, 50).map((page: any, idx: number) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2 max-w-xs truncate">{page.url}</td>
                          <td className="p-2">{page.statusCode}</td>
                          <td className="p-2 max-w-xs truncate">{page.title || 'Missing'}</td>
                          <td className="p-2">{page.wordCount}</td>
                          <td className="p-2">{page.h1Count}</td>
                          <td className="p-2">{page.imageCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {audit.rawJson?.imageAltAnalysis && audit.rawJson.imageAltAnalysis.length > 0 && (
            <TabsContent value="alt-tags">
              <Card>
                <CardHeader>
                  <CardTitle>Image Alt Tags Analysis</CardTitle>
                  <CardDescription>
                    Detailed analysis of image alt attributes with specific recommendations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {audit.rawJson.imageAltAnalysis.slice(0, 50).map((item: any, idx: number) => (
                      <div key={idx} className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50 rounded">
                        <div className="font-semibold text-sm">[{idx + 1}] {item.url}</div>
                        {item.imageUrl && (
                          <div className="text-xs text-gray-600 mt-1">
                            Image: <span className="font-mono">{item.imageUrl.substring(0, 60)}...</span>
                          </div>
                        )}
                        {item.currentAlt ? (
                          <div className="text-sm mt-2">
                            <span className="font-medium">Current Alt:</span> "{item.currentAlt}"
                          </div>
                        ) : (
                          <div className="text-sm mt-2 text-red-600 font-medium">Missing alt attribute</div>
                        )}
                        {item.recommendation && (
                          <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                            <div className="font-semibold text-sm text-blue-600 mb-1">Recommendation:</div>
                            <div className="text-sm text-gray-700">{item.recommendation}</div>
                          </div>
                        )}
                      </div>
                    ))}
                    {audit.rawJson.imageAltAnalysis.length > 50 && (
                      <p className="text-sm text-gray-500 text-center">
                        Showing top 50 of {audit.rawJson.imageAltAnalysis.length} images analyzed
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {audit.rawJson?.competitorAnalysis && (
            <TabsContent value="competitor">
              <Card>
                <CardHeader>
                  <CardTitle>Competitor Keyword Gap Analysis</CardTitle>
                  <CardDescription>
                    {audit.rawJson.competitorAnalysis.competitorUrl}. This analysis identifies niche-specific keyword opportunities by combining your site's core topics with common SEO patterns used by competitors in your industry.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-red-600">Keyword Gaps (Opportunities)</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        These keywords are commonly used by competitors but missing from your site:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {audit.rawJson.competitorAnalysis.keywordGaps.map((kw: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-green-600">Shared Keywords</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Keywords you're already targeting that competitors also use:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {audit.rawJson.competitorAnalysis.sharedKeywords.map((kw: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-3 text-blue-600">Competitor Keywords Analyzed</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Common keywords found in competitor analysis:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {audit.rawJson.competitorAnalysis.competitorKeywords.map((kw: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-blue-600 mb-2">Recommendations</h3>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li>Create content targeting the identified keyword gaps to capture additional search traffic</li>
                        <li>Optimize existing pages for shared keywords to improve rankings</li>
                        <li>Monitor competitor content strategies and adapt your approach accordingly</li>
                        <li>Focus on high-value keyword gaps that align with your business goals</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="raw">
            <Card>
              <CardHeader>
                <CardTitle>Raw Audit Data</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
                  {JSON.stringify(audit.rawJson, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

