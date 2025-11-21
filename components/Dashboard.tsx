'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Plus, FileText, AlertCircle, LayoutDashboard, List, TrendingUp, TrendingDown, Minus, Archive, ArchiveRestore, Trash2, Folder, FolderOpen, ArrowLeft } from 'lucide-react'

interface Audit {
  id: string
  url: string
  overallScore: number
  createdAt: string
  archived: boolean
  highSeverityIssues: number
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
  const [groupedAudits, setGroupedAudits] = useState<Array<{
    url: string
    latestAudit: Audit | null
    allAudits: Audit[]
  }>>([])
  const [latestAudit, setLatestAudit] = useState<AuditDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('list')
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active')
  const [groupBy, setGroupBy] = useState(false)

  useEffect(() => {
    fetchAudits()
  }, [filter, groupBy])

  useEffect(() => {
    if (viewMode === 'dashboard' && audits.length > 0 && !audits[0].archived) {
      fetchLatestAudit(audits[0].id)
    }
  }, [viewMode, audits])

  const fetchAudits = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: '100',
        filter: filter
      })
      if (groupBy) {
        params.append('groupBy', 'website')
      }
      const res = await fetch(`/api/audits?${params}`)
      const data = await res.json()
      
      if (groupBy && data.groupedAudits) {
        setGroupedAudits(data.groupedAudits || [])
        setAudits([])
      } else {
        setAudits(data.audits || [])
        setGroupedAudits([])
      }
    } catch (error) {
      console.error('Failed to fetch audits:', error)
      toast({
        title: 'Error',
        description: 'Failed to load audits',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchLatestAudit = async (auditId: string) => {
    try {
      const res = await fetch(`/api/audits/${auditId}`)
      const data = await res.json()
      setLatestAudit(data)
    } catch (error) {
      console.error('Failed to fetch audit details:', error)
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

  const getIssueCounts = () => {
    if (!latestAudit) return { technical: 0, onPage: 0, content: 0, accessibility: 0, meta: 0 }
    
    const issues = latestAudit.issues || []
    return {
      technical: issues.filter(i => i.category === 'Technical').length,
      onPage: issues.filter(i => i.category === 'On-page').length,
      content: issues.filter(i => i.category === 'Content').length,
      accessibility: issues.filter(i => i.category === 'Accessibility').length,
      meta: issues.filter(i => i.message.toLowerCase().includes('meta') || i.message.toLowerCase().includes('title') || i.message.toLowerCase().includes('description')).length
    }
  }

  const getSchemaHealth = () => {
    if (!latestAudit?.rawJson?.pages) return { success: 0, warning: 0, error: 0 }
    
    const pages = latestAudit.rawJson.pages
    const total = pages.length
    const withSchema = pages.filter((p: any) => p.hasSchemaMarkup).length
    const withoutSchema = total - withSchema
    
    return {
      success: Math.round((withSchema / total) * 100),
      warning: 0,
      error: Math.round((withoutSchema / total) * 100)
    }
  }

  const getOnPageIssues = () => {
    if (!latestAudit) return []
    
    const issues = latestAudit.issues || []
    const onPageIssues = issues
      .filter(i => i.category === 'On-page' || i.message.toLowerCase().includes('alt') || i.message.toLowerCase().includes('meta') || i.message.toLowerCase().includes('title'))
      .slice(0, 10)
      .map(i => ({
        name: i.message,
        priority: i.severity,
        count: i.affectedPagesJson ? JSON.parse(i.affectedPagesJson).length : 1
      }))
    
    return onPageIssues
  }

  const issueCounts = getIssueCounts()
  const schemaHealth = getSchemaHealth()
  const onPageIssues = getOnPageIssues()

  const renderAuditCard = (audit: Audit) => (
    <Card key={audit.id} className={viewMode === 'dashboard' ? 'bg-gray-800 border-gray-700' : audit.archived ? 'opacity-60' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className={`text-lg ${viewMode === 'dashboard' ? 'text-white' : ''}`}>
              <Link href={`/audits/${audit.id}`} className="hover:underline">
                {audit.url}
              </Link>
              {audit.archived && (
                <span className="ml-2 text-xs px-2 py-1 bg-gray-600 text-gray-200 rounded">Archived</span>
              )}
            </CardTitle>
            <CardDescription className={viewMode === 'dashboard' ? 'text-gray-400' : ''}>
              {new Date(audit.createdAt).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-2xl font-bold ${viewMode === 'dashboard' ? 'text-white' : ''}`}>{audit.overallScore}</div>
              <div className={`text-xs ${viewMode === 'dashboard' ? 'text-gray-400' : 'text-gray-500'}`}>Score</div>
            </div>
            {audit.highSeverityIssues > 0 && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  {audit.highSeverityIssues}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Link href={`/audits/${audit.id}`}>
            <Button variant="outline" size="sm" className={viewMode === 'dashboard' ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : ''}>
              View Details
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleArchive(audit.id, audit.archived)}
            className={viewMode === 'dashboard' ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : ''}
            title={audit.archived ? 'Unarchive' : 'Archive'}
          >
            {audit.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDelete(audit.id, audit.url)}
            className={`${viewMode === 'dashboard' ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : ''} hover:bg-red-50 hover:border-red-300`}
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className={`min-h-screen ${viewMode === 'dashboard' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`border-b ${viewMode === 'dashboard' ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {filter === 'archived' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilter('active')}
                className={viewMode === 'dashboard' ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600' : ''}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            )}
            <h1 className={`text-2xl font-bold ${viewMode === 'dashboard' ? 'text-white' : ''}`}>
              {filter === 'archived' ? 'Archived Audits' : 'SEO Audit Dashboard'}
            </h1>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? '' : 'text-gray-600'}
              >
                <List className="mr-2 h-4 w-4" />
                List
              </Button>
              <Button
                variant={viewMode === 'dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('dashboard')}
                className={viewMode === 'dashboard' ? '' : 'text-gray-600'}
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
            <Link href="/scheduled-audits">
              <Button variant="outline">Scheduled</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className={`text-center py-12 ${viewMode === 'dashboard' ? 'text-white' : ''}`}>Loading...</div>
        ) : (audits.length === 0 && groupedAudits.length === 0) ? (
          <Card className={viewMode === 'dashboard' ? 'bg-gray-800 border-gray-700' : ''}>
            <CardContent className="py-12 text-center">
              <FileText className={`mx-auto h-12 w-12 ${viewMode === 'dashboard' ? 'text-gray-400' : 'text-gray-400'} mb-4`} />
              <h3 className={`text-lg font-semibold mb-2 ${viewMode === 'dashboard' ? 'text-white' : ''}`}>No audits yet</h3>
              <p className={`mb-4 ${viewMode === 'dashboard' ? 'text-gray-400' : 'text-gray-600'}`}>Get started by creating your first SEO audit</p>
              <Link href="/audits/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Audit
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : viewMode === 'dashboard' && latestAudit ? (
          <div className="space-y-6">
            {/* Website Selector */}
            <div className="flex items-center gap-4 mb-6">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="font-medium">{latestAudit.url}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <Link href={`/audits/${latestAudit.id}`}>
                <Button variant="outline" className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">
                  View Full Report
                </Button>
              </Link>
            </div>

            {/* Overview Cards - Same as before */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Indexing Card */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Indexing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-white">{latestAudit.rawJson?.pages?.length || 0}</div>
                      <div className="text-xs text-gray-400 mt-1">Pages Crawled</div>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{latestAudit.overallScore}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-green-400 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    <span>Overall Score</span>
                  </div>
                </CardContent>
              </Card>

              {/* Crawl Errors Card */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Crawl Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-white">{issueCounts.technical}</div>
                      <div className="text-xs text-gray-400 mt-1">Technical Issues</div>
                    </div>
                    <div className="w-16 h-16 rounded bg-red-500 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{issueCounts.technical}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs">
                    <Minus className="h-3 w-3" />
                    <span>No change</span>
                  </div>
                </CardContent>
              </Card>

              {/* Meta Issues Card */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Meta Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-white">{issueCounts.meta}</div>
                      <div className="text-xs text-gray-400 mt-1">On-Page Issues</div>
                    </div>
                    <div className="w-16 h-16 rounded bg-blue-600 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{issueCounts.meta}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-green-400 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    <span>Identified</span>
                  </div>
                </CardContent>
              </Card>

              {/* Page Speed Card */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Page Speed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-white">{latestAudit.technicalScore}</div>
                      <div className="text-xs text-gray-400 mt-1">Technical Score</div>
                    </div>
                    <div className="w-16 h-16 rounded bg-green-500 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{latestAudit.technicalScore}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-green-400 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    <span>Good</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Schema Health Chart */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Schema Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                      <svg className="transform -rotate-90 w-32 h-32">
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="transparent"
                          className="text-gray-700"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="56"
                          stroke="currentColor"
                          strokeWidth="12"
                          fill="transparent"
                          strokeDasharray={`${2 * Math.PI * 56}`}
                          strokeDashoffset={`${2 * Math.PI * 56 * (1 - schemaHealth.success / 100)}`}
                          className="text-green-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-white">{schemaHealth.success}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Succeeding</span>
                      <span className="text-green-400 font-semibold">{schemaHealth.success}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Error</span>
                      <span className="text-red-400 font-semibold">{schemaHealth.error}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SEO Scores Chart */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">SEO Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Technical</span>
                        <span className="text-white font-semibold">{latestAudit.technicalScore}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${latestAudit.technicalScore}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">On-Page</span>
                        <span className="text-white font-semibold">{latestAudit.onPageScore}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${latestAudit.onPageScore}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Content</span>
                        <span className="text-white font-semibold">{latestAudit.contentScore}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${latestAudit.contentScore}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Accessibility</span>
                        <span className="text-white font-semibold">{latestAudit.accessibilityScore}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${latestAudit.accessibilityScore}%` }}></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* On-Page Issues Table */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">On-Page Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Issue Name</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Priority</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-semibold text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onPageIssues.map((issue, idx) => (
                        <tr key={idx} className="border-b border-gray-700">
                          <td className="py-3 px-4 text-white">{issue.name}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              issue.priority === 'High' ? 'bg-red-500 text-white' :
                              issue.priority === 'Medium' ? 'bg-yellow-500 text-white' :
                              'bg-blue-500 text-white'
                            }`}>
                              {issue.priority || 'Low'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-white">{issue.count}</span>
                              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filter and Group Controls */}
            <div className="flex items-center justify-between">
              <h2 className={`text-xl font-semibold ${viewMode === 'dashboard' ? 'text-white' : ''}`}>
                {groupBy ? 'Audits by Website' : 'Recent Audits'}
              </h2>
              <div className="flex items-center gap-2">
                {/* Filter Buttons */}
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
                {/* Group By Website Toggle */}
                <Button
                  variant={groupBy ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGroupBy(!groupBy)}
                >
                  {groupBy ? <FolderOpen className="h-4 w-4 mr-2" /> : <Folder className="h-4 w-4 mr-2" />}
                  {groupBy ? 'List View' : 'Group by Website'}
                </Button>
              </div>
            </div>

            {/* Grouped View */}
            {groupBy && groupedAudits.length > 0 ? (
              <div className="space-y-6">
                {groupedAudits.map((group) => (
                  <div key={group.url}>
                    <h3 className={`text-lg font-semibold mb-3 ${viewMode === 'dashboard' ? 'text-white' : ''}`}>
                      {group.url}
                      <span className="ml-2 text-sm text-gray-500">({group.allAudits.length} {group.allAudits.length === 1 ? 'audit' : 'audits'})</span>
                    </h3>
                    <div className="grid gap-4">
                      {group.allAudits.map(renderAuditCard)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Regular List View */
              <div className="grid gap-4">
                {audits.map(renderAuditCard)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
