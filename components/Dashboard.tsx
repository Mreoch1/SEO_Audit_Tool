'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { 
  Plus, FileText, AlertCircle, LayoutDashboard, List, TrendingUp, TrendingDown, Minus, 
  Archive, ArchiveRestore, Trash2, Folder, FolderOpen, ArrowLeft, Download, Zap, 
  Globe, Shield, Search, Target, BarChart3, Gauge, CheckCircle2, XCircle, 
  Clock, Activity, Layers, FileCode, Users, Eye, Award, TrendingUp as TrendingUpIcon
} from 'lucide-react'

interface Audit {
  id: string
  url: string
  overallScore: number
  createdAt: string
  archived: boolean
  highSeverityIssues: number
  status?: 'running' | 'completed' | 'failed'
}

interface AuditDetail {
  id: string
  url: string
  overallScore: number
  technicalScore: number
  onPageScore: number
  contentScore: number
  accessibilityScore: number
  createdAt: string
  status?: 'running' | 'completed' | 'failed'
  issues: Array<{
    id: string
    category: string
    severity: string
    message: string
    details: string | null
    affectedPagesJson: string
  }>
  rawJson: any
}

export default function Dashboard() {
  const { toast } = useToast()
  const [audits, setAudits] = useState<Audit[]>([])
  const [latestAudit, setLatestAudit] = useState<AuditDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('dashboard') // Default to dashboard
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active')
  
  // Helper to get button variant
  const getButtonVariant = (mode: 'list' | 'dashboard'): 'default' | 'ghost' => {
    if (viewMode === mode) {
      return 'default'
    }
    return 'ghost'
  }

  useEffect(() => {
    fetchAudits()
  }, [filter, viewMode])

  // Auto-fetch latest audit when audits load (dashboard mode)
  useEffect(() => {
    if (viewMode === 'dashboard' && audits.length > 0 && !audits[0].archived && audits[0].status !== 'running') {
      fetchLatestAudit(audits[0].id)
    } else if (viewMode === 'dashboard' && audits.length === 0) {
      setLatestAudit(null)
      setLoading(false)
    }
  }, [viewMode, audits])

  const fetchAudits = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: viewMode === 'dashboard' ? '1' : '100', // Only 1 for dashboard, 100 for list
        filter: filter
      })
      const res = await fetch(`/api/audits?${params}`)
      
      if (!res.ok) {
        // Try to parse error message
        let errorMessage = `Failed to load audits: ${res.status} ${res.statusText}`
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // Response is not JSON, use status text
        }
        throw new Error(errorMessage)
      }
      
      const data = await res.json()
      
      // Handle both success and error responses
      if (data.error) {
        console.error('[Fetch Audits] API returned error:', data.error)
        toast({
          title: 'Error',
          description: data.error,
          variant: 'destructive'
        })
        setAudits([])
      } else {
        setAudits(data.audits || [])
      }
    } catch (error) {
      console.error('[Fetch Audits] Network/parse error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load audits. Please check your connection.',
        variant: 'destructive'
      })
      // Set empty array on error to prevent UI issues
      setAudits([])
    } finally {
      setLoading(false)
    }
  }

  const fetchLatestAudit = async (auditId: string) => {
    try {
      const res = await fetch(`/api/audits/${auditId}`)
      if (!res.ok) throw new Error('Failed to fetch audit')
      const data = await res.json()
      setLatestAudit(data)
      setLoading(false) // Ensure loading stops after fetching latest audit
    } catch (error) {
      console.error('Failed to fetch audit details:', error)
      setLoading(false) // Stop loading even on error
    }
  }

  const handleArchive = async (id: string, archived: boolean) => {
    try {
      const res = await fetch(`/api/audits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !archived })
      })

      if (!res.ok) throw new Error('Failed to update audit')

      toast({
        title: 'Success',
        description: archived ? 'Audit unarchived' : 'Audit archived'
      })
      fetchAudits()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update audit',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async (id: string, url: string) => {
    if (!confirm(`Are you sure you want to delete the audit for "${url}"? This action cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/audits/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete audit')

      toast({
        title: 'Success',
        description: 'Audit deleted'
      })
      fetchAudits()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete audit',
        variant: 'destructive'
      })
    }
  }

  const getPageSpeedMetrics = () => {
    if (!latestAudit?.rawJson?.pages) return null
    const mainPage = latestAudit.rawJson.pages[0]
    return {
      mobile: mainPage?.pageSpeedMobile,
      desktop: mainPage?.pageSpeedDesktop
    }
  }

  const getCoreWebVitals = () => {
    const pageSpeed = getPageSpeedMetrics()
    const mobile = pageSpeed?.mobile
    const desktop = pageSpeed?.desktop
    
    return {
      mobile: {
        lcp: mobile?.lcp ? Math.round(mobile.lcp) : null,
        inp: mobile?.inp ? Math.round(mobile.inp) : null,
        cls: mobile?.cls ? parseFloat(mobile.cls.toFixed(3)) : null,
        fcp: mobile?.fcp ? Math.round(mobile.fcp) : null,
        ttfb: mobile?.ttfb ? Math.round(mobile.ttfb) : null
      },
      desktop: {
        lcp: desktop?.lcp ? Math.round(desktop.lcp) : null,
        inp: desktop?.inp ? Math.round(desktop.inp) : null,
        cls: desktop?.cls ? parseFloat(desktop.cls.toFixed(3)) : null,
        fcp: desktop?.fcp ? Math.round(desktop.fcp) : null,
        ttfb: desktop?.ttfb ? Math.round(desktop.ttfb) : null
      }
    }
  }

  const getPerformanceOpportunities = () => {
    const pageSpeed = getPageSpeedMetrics()
    const mobile = pageSpeed?.mobile?.opportunities || []
    const desktop = pageSpeed?.desktop?.opportunities || []
    return { mobile, desktop }
  }

  const getTechnicalMetrics = () => {
    if (!latestAudit?.rawJson?.pages) return null
    const mainPage = latestAudit.rawJson.pages[0]
    return {
      httpVersion: mainPage?.httpVersion || 'Unknown',
      compression: mainPage?.compression || { gzip: false, brotli: false },
      hasSchema: mainPage?.hasSchemaMarkup || false,
      schemaTypes: mainPage?.schemaTypes || []
    }
  }

  const getKeywords = () => {
    return latestAudit?.rawJson?.summary?.extractedKeywords || []
  }

  const getCompetitorAnalysis = () => {
    return latestAudit?.rawJson?.competitorAnalysis || null
  }

  const getImageAltAnalysis = () => {
    return latestAudit?.rawJson?.imageAltAnalysis || []
  }

  const getSiteWideData = () => {
    return latestAudit?.rawJson?.siteWide || {}
  }

  const getLLMReadability = () => {
    if (!latestAudit?.rawJson?.pages) return null
    const pages = latestAudit.rawJson.pages.filter((p: any) => p.llmReadability)
    if (pages.length === 0) return null
    
    const avgRendering = pages.reduce((sum: number, p: any) => sum + (p.llmReadability?.renderingPercentage || 0), 0) / pages.length
    return {
      avgRendering: Math.round(avgRendering),
      highRenderingPages: pages.filter((p: any) => p.llmReadability?.hasHighRendering).length,
      totalPages: pages.length
    }
  }

  const issueCounts = latestAudit ? {
    technical: latestAudit.issues.filter(i => i.category === 'Technical').length,
    onPage: latestAudit.issues.filter(i => i.category === 'On-page').length,
    content: latestAudit.issues.filter(i => i.category === 'Content').length,
    accessibility: latestAudit.issues.filter(i => i.category === 'Accessibility').length,
    performance: latestAudit.issues.filter(i => i.category === 'Performance').length,
    high: latestAudit.issues.filter(i => i.severity === 'High').length,
    medium: latestAudit.issues.filter(i => i.severity === 'Medium').length,
    low: latestAudit.issues.filter(i => i.severity === 'Low').length
  } : null

  const coreWebVitals = getCoreWebVitals()
  const performanceOps = getPerformanceOpportunities()
  const technicalMetrics = getTechnicalMetrics()
  const keywords = getKeywords()
  const competitorAnalysis = getCompetitorAnalysis()
  const imageAltAnalysis = getImageAltAnalysis()
  const siteWide = getSiteWideData()
  const llmReadability = getLLMReadability()

  const getVitalScore = (value: number | null, thresholds: { good: number; poor: number }, lowerIsBetter: boolean = true) => {
    if (value === null) return { label: 'N/A', color: 'gray', icon: Minus }
    if (lowerIsBetter) {
      if (value <= thresholds.good) return { label: 'Good', color: 'green', icon: CheckCircle2 }
      if (value <= thresholds.poor) return { label: 'Needs Improvement', color: 'yellow', icon: AlertCircle }
      return { label: 'Poor', color: 'red', icon: XCircle }
    } else {
      if (value >= thresholds.good) return { label: 'Good', color: 'green', icon: CheckCircle2 }
      if (value >= thresholds.poor) return { label: 'Needs Improvement', color: 'yellow', icon: AlertCircle }
      return { label: 'Poor', color: 'red', icon: XCircle }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading latest audit...</div>
      </div>
    )
  }

  // Default to dashboard view showing latest audit
  if (viewMode === 'dashboard') {
    if (!latestAudit && audits.length === 0) {
      return (
        <div className="min-h-screen bg-gray-900">
          <div className="border-b bg-gray-800 border-gray-700">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">SEO Audit Dashboard</h1>
              <div className="flex gap-2">
                <div className="flex gap-1 bg-gray-700 rounded-lg p-1">
                  <Button
                    variant={getButtonVariant('list')}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={(viewMode as string) === 'list' ? '' : 'text-gray-300'}
                  >
                    <List className="mr-2 h-4 w-4" />
                    List
                  </Button>
                  <Button
                    variant={getButtonVariant('dashboard')}
                    size="sm"
                    className={(viewMode as string) === 'dashboard' ? '' : 'text-gray-300'}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </div>
                <Link href="/audits/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Audit
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                    Settings
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <div className="container mx-auto px-4 py-12">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2 text-white">No audits yet</h3>
                <p className="mb-6 text-gray-400">Create your first SEO audit to see detailed insights and metrics</p>
                <Link href="/audits/new">
                  <Button size="lg">
                    <Plus className="mr-2 h-5 w-5" />
                    Create First Audit
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    if (!latestAudit) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="text-white">Loading audit details...</div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-900">
        {/* Header */}
        <div className="border-b bg-gray-800 border-gray-700 sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-white">SEO Audit Dashboard</h1>
              <div className="flex gap-2">
                <div className="flex gap-1 bg-gray-700 rounded-lg p-1">
                  <Button
                    variant={getButtonVariant('list')}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={(viewMode as string) === 'list' ? '' : 'text-gray-300'}
                  >
                    <List className="mr-2 h-4 w-4" />
                    List
                  </Button>
                  <Button
                    variant={getButtonVariant('dashboard')}
                    size="sm"
                    className={(viewMode as string) === 'dashboard' ? '' : 'text-gray-300'}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </div>
                <Link href={`/api/audits/${latestAudit.id}/pdf`} target="_blank">
                  <Button variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                    <Download className="mr-2 h-4 w-4" />
                    PDF Report
                  </Button>
                </Link>
                <Link href="/audits/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Audit
                  </Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                    Settings
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Website URL Banner */}
            <div className="flex items-center gap-4 pb-2">
              <div className="flex items-center gap-3 px-4 py-2 bg-blue-600 rounded-lg">
                <Globe className="h-5 w-5 text-white" />
                <span className="font-semibold text-white text-lg">{latestAudit.url}</span>
              </div>
              <Link href={`/audits/${latestAudit.id}`}>
                <Button variant="outline" size="sm" className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                  View Full Report
                </Button>
              </Link>
              <div className="text-sm text-gray-400 ml-auto">
                {new Date(latestAudit.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Overall Score - Hero Section */}
          <Card className="bg-gradient-to-br from-blue-600 to-blue-800 border-0">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white/80 text-sm mb-2">Overall SEO Score</div>
                  <div className="text-6xl font-bold text-white mb-2">{latestAudit.overallScore}</div>
                  <div className="text-white/80 text-sm">Based on technical, on-page, content, and accessibility metrics</div>
                </div>
                <div className="text-right">
                  <div className="text-white/80 text-sm mb-2">Pages Analyzed</div>
                  <div className="text-4xl font-bold text-white mb-2">{latestAudit.rawJson?.pages?.length || 0}</div>
                  <div className="text-white/80 text-sm">Comprehensive crawl</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Technical
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white mb-1">{latestAudit.technicalScore}</div>
                <div className="text-xs text-gray-400">{issueCounts?.technical || 0} issues found</div>
                <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${latestAudit.technicalScore}%` }}></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  On-Page
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white mb-1">{latestAudit.onPageScore}</div>
                <div className="text-xs text-gray-400">{issueCounts?.onPage || 0} issues found</div>
                <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${latestAudit.onPageScore}%` }}></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white mb-1">{latestAudit.contentScore}</div>
                <div className="text-xs text-gray-400">{issueCounts?.content || 0} issues found</div>
                <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${latestAudit.contentScore}%` }}></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Accessibility
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white mb-1">{latestAudit.accessibilityScore}</div>
                <div className="text-xs text-gray-400">{issueCounts?.accessibility || 0} issues found</div>
                <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${latestAudit.accessibilityScore}%` }}></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Core Web Vitals & Performance */}
          {coreWebVitals && (coreWebVitals.mobile.lcp || coreWebVitals.desktop.lcp) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Gauge className="h-5 w-5" />
                    Core Web Vitals - Mobile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {coreWebVitals.mobile.lcp !== null && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400">LCP (Largest Contentful Paint)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{coreWebVitals.mobile.lcp} ms</span>
                          {(() => {
                            const score = getVitalScore(coreWebVitals.mobile.lcp, { good: 2500, poor: 4000 })
                            const Icon = score.icon
                            return <Icon className={`h-4 w-4 text-${score.color}-500`} />
                          })()}
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            coreWebVitals.mobile.lcp <= 2500 ? 'bg-green-500' :
                            coreWebVitals.mobile.lcp <= 4000 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min((coreWebVitals.mobile.lcp / 5000) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {coreWebVitals.mobile.inp !== null && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400">INP (Interaction to Next Paint)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{coreWebVitals.mobile.inp} ms</span>
                          {(() => {
                            const score = getVitalScore(coreWebVitals.mobile.inp, { good: 200, poor: 500 })
                            const Icon = score.icon
                            return <Icon className={`h-4 w-4 text-${score.color}-500`} />
                          })()}
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            coreWebVitals.mobile.inp <= 200 ? 'bg-green-500' :
                            coreWebVitals.mobile.inp <= 500 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min((coreWebVitals.mobile.inp / 800) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {coreWebVitals.mobile.cls !== null && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400">CLS (Cumulative Layout Shift)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{coreWebVitals.mobile.cls}</span>
                          {(() => {
                            const score = getVitalScore(coreWebVitals.mobile.cls, { good: 0.1, poor: 0.25 }, false)
                            const Icon = score.icon
                            return <Icon className={`h-4 w-4 text-${score.color}-500`} />
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                  {coreWebVitals.mobile.fcp !== null && (
                    <div className="text-sm text-gray-400">
                      <span>FCP: {coreWebVitals.mobile.fcp} ms</span>
                      {coreWebVitals.mobile.ttfb !== null && <span className="ml-4">TTFB: {coreWebVitals.mobile.ttfb} ms</span>}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Core Web Vitals - Desktop
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {coreWebVitals.desktop.lcp !== null && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400">LCP (Largest Contentful Paint)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{coreWebVitals.desktop.lcp} ms</span>
                          {(() => {
                            const score = getVitalScore(coreWebVitals.desktop.lcp, { good: 2500, poor: 4000 })
                            const Icon = score.icon
                            return <Icon className={`h-4 w-4 text-${score.color}-500`} />
                          })()}
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            coreWebVitals.desktop.lcp <= 2500 ? 'bg-green-500' :
                            coreWebVitals.desktop.lcp <= 4000 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min((coreWebVitals.desktop.lcp / 5000) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {coreWebVitals.desktop.inp !== null && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400">INP (Interaction to Next Paint)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{coreWebVitals.desktop.inp} ms</span>
                          {(() => {
                            const score = getVitalScore(coreWebVitals.desktop.inp, { good: 200, poor: 500 })
                            const Icon = score.icon
                            return <Icon className={`h-4 w-4 text-${score.color}-500`} />
                          })()}
                        </div>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            coreWebVitals.desktop.inp <= 200 ? 'bg-green-500' :
                            coreWebVitals.desktop.inp <= 500 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min((coreWebVitals.desktop.inp / 800) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {coreWebVitals.desktop.cls !== null && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400">CLS (Cumulative Layout Shift)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{coreWebVitals.desktop.cls}</span>
                          {(() => {
                            const score = getVitalScore(coreWebVitals.desktop.cls, { good: 0.1, poor: 0.25 }, false)
                            const Icon = score.icon
                            return <Icon className={`h-4 w-4 text-${score.color}-500`} />
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                  {coreWebVitals.desktop.fcp !== null && (
                    <div className="text-sm text-gray-400">
                      <span>FCP: {coreWebVitals.desktop.fcp} ms</span>
                      {coreWebVitals.desktop.ttfb !== null && <span className="ml-4">TTFB: {coreWebVitals.desktop.ttfb} ms</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Performance Opportunities */}
          {(performanceOps.mobile.length > 0 || performanceOps.desktop.length > 0) && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Performance Optimization Opportunities
                </CardTitle>
                <CardDescription className="text-gray-400">Based on Google PageSpeed Insights analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {performanceOps.mobile.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-gray-300 mb-2">Mobile ({performanceOps.mobile.length} opportunities)</div>
                      <div className="space-y-2">
                        {performanceOps.mobile.slice(0, 5).map((op: any, idx: number) => (
                          <div key={idx} className="p-3 bg-gray-700 rounded-lg">
                            <div className="text-white text-sm font-medium mb-1">{op.title}</div>
                            {op.savings && <div className="text-yellow-400 text-xs">Potential savings: {op.savings}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {performanceOps.desktop.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-gray-300 mb-2">Desktop ({performanceOps.desktop.length} opportunities)</div>
                      <div className="space-y-2">
                        {performanceOps.desktop.slice(0, 5).map((op: any, idx: number) => (
                          <div key={idx} className="p-3 bg-gray-700 rounded-lg">
                            <div className="text-white text-sm font-medium mb-1">{op.title}</div>
                            {op.savings && <div className="text-yellow-400 text-xs">Potential savings: {op.savings}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Technical Features Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {technicalMetrics && (
              <>
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      HTTP Protocol
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white mb-1">{technicalMetrics.httpVersion.toUpperCase()}</div>
                    <div className="text-xs text-gray-400">
                      {technicalMetrics.httpVersion === 'http/2' || technicalMetrics.httpVersion === 'http/3' ? (
                        <span className="text-green-400">✓ Optimized</span>
                      ) : (
                        <span className="text-yellow-400">Consider upgrading</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Compression
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {technicalMetrics.compression.gzip && (
                        <div className="text-sm text-white">✓ GZIP</div>
                      )}
                      {technicalMetrics.compression.brotli && (
                        <div className="text-sm text-white">✓ Brotli</div>
                      )}
                      {!technicalMetrics.compression.gzip && !technicalMetrics.compression.brotli && (
                        <div className="text-sm text-yellow-400">No compression enabled</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white text-sm flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      Schema Markup
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {technicalMetrics.hasSchema ? (
                      <>
                        <div className="text-sm text-green-400 mb-1">✓ Schema detected</div>
                        {technicalMetrics.schemaTypes.length > 0 && (
                          <div className="text-xs text-gray-400">
                            Types: {technicalMetrics.schemaTypes.slice(0, 3).join(', ')}
                            {technicalMetrics.schemaTypes.length > 3 && ` +${technicalMetrics.schemaTypes.length - 3} more`}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-yellow-400">Not detected</div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {llmReadability && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    LLM Readability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white mb-1">{llmReadability.avgRendering}%</div>
                  <div className="text-xs text-gray-400">
                    {llmReadability.highRenderingPages} of {llmReadability.totalPages} pages optimized for AI parsing
                  </div>
                </CardContent>
              </Card>
            )}

            {keywords.length > 0 && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Keywords Found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white mb-1">{keywords.length}</div>
                  <div className="text-xs text-gray-400">
                    {keywords.slice(0, 3).join(', ')}
                    {keywords.length > 3 && ` +${keywords.length - 3} more`}
                  </div>
                </CardContent>
              </Card>
            )}

            {competitorAnalysis && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Competitor Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-white mb-1">{competitorAnalysis.keywordGaps?.length || 0} keyword gaps</div>
                  <div className="text-xs text-gray-400">{competitorAnalysis.sharedKeywords?.length || 0} shared keywords</div>
                </CardContent>
              </Card>
            )}

            {siteWide.robotsTxtExists && (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Site Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-xs">
                    {siteWide.robotsTxtExists && <div className="text-green-400">✓ robots.txt</div>}
                    {siteWide.sitemapExists && <div className="text-green-400">✓ Sitemap</div>}
                    {siteWide.socialMedia && <div className="text-green-400">✓ Social Media</div>}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Issues Summary */}
          {issueCounts && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Issues Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-400 mb-1">{issueCounts.high}</div>
                    <div className="text-xs text-gray-400">High Priority</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-400 mb-1">{issueCounts.medium}</div>
                    <div className="text-xs text-gray-400">Medium Priority</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400 mb-1">{issueCounts.low}</div>
                    <div className="text-xs text-gray-400">Low Priority</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-1">{issueCounts.technical}</div>
                    <div className="text-xs text-gray-400">Technical</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white mb-1">{issueCounts.onPage}</div>
                    <div className="text-xs text-gray-400">On-Page</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Link href={`/audits/${latestAudit.id}`}>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                View Full Report
              </Button>
            </Link>
            <Link href={`/api/audits/${latestAudit.id}/pdf`} target="_blank">
              <Button size="lg" variant="outline" className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
                <Download className="mr-2 h-5 w-5" />
                Download PDF
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // List view (for managing multiple audits)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">SEO Audit Dashboard</h1>
          <div className="flex gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant={getButtonVariant('list')}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="mr-2 h-4 w-4" />
                List
              </Button>
              <Button
                variant={getButtonVariant('dashboard')}
                size="sm"
                onClick={() => setViewMode('dashboard')}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </div>
            <Link href="/audits/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Audit
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline">Settings</Button>
            </Link>
          </div>
        </div>
        
        {/* Filter Buttons */}
        <div className="container mx-auto px-4 pb-4">
          <div className="flex gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant={filter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'active' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={filter === 'archived' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('archived')}
              >
                Archived
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">Loading audits...</div>
        ) : audits.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No audits found</h3>
              <p className="mb-4 text-gray-600">
                {filter === 'archived' 
                  ? 'No archived audits. Switch to "Active" or "All" to see your audits.'
                  : 'Get started by creating your first SEO audit'}
              </p>
              <Link href="/audits/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Audit
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {audits.map((audit) => (
              <Card key={audit.id} className={audit.archived ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        <Link href={`/audits/${audit.id}`} className="hover:underline">
                          {audit.url}
                        </Link>
                        {audit.archived && (
                          <span className="ml-2 text-xs px-2 py-1 bg-gray-600 text-gray-200 rounded">Archived</span>
                        )}
                        {audit.status === 'running' && (
                          <span className="ml-2 text-xs px-2 py-1 bg-blue-600 text-white rounded">Running</span>
                        )}
                        {audit.status === 'failed' && (
                          <span className="ml-2 text-xs px-2 py-1 bg-red-600 text-white rounded">Failed</span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {new Date(audit.createdAt).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold">{audit.overallScore}</div>
                        <div className="text-xs text-gray-500">Score</div>
                      </div>
                      {audit.highSeverityIssues > 0 && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-semibold">{audit.highSeverityIssues}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Link href={`/audits/${audit.id}`}>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchive(audit.id, audit.archived)}
                      title={audit.archived ? 'Unarchive' : 'Archive'}
                    >
                      {audit.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(audit.id, audit.url)}
                      className="hover:bg-red-50 hover:border-red-300"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
