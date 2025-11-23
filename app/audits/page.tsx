'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { 
  Plus, FileText, AlertCircle, CheckCircle, XCircle, Clock, 
  RefreshCw, Eye, Calendar, ExternalLink, TrendingUp, TrendingDown
} from 'lucide-react'

interface Audit {
  id: string
  url: string
  overallScore: number
  createdAt: string
  archived: boolean
  status: 'running' | 'completed' | 'failed'
  highSeverityIssues: number
}

export default function AuditsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active')

  useEffect(() => {
    fetchAudits()
  }, [filter])

  const fetchAudits = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/audits?filter=${filter}&limit=100`)
      if (!res.ok) throw new Error('Failed to fetch audits')
      const data = await res.json()
      setAudits(data.audits || [])
    } catch (error) {
      console.error('Error fetching audits:', error)
      toast({
        title: 'Error',
        description: 'Failed to load audits',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRunAgain = async (auditId: string) => {
    try {
      // Fetch the full audit to get options
      const res = await fetch(`/api/audits/${auditId}`)
      if (!res.ok) throw new Error('Failed to fetch audit details')
      const audit = await res.json()
      
      // Extract options from rawJson if available
      let options: any = {
        url: audit.url
      }
      
      if (audit.rawJson) {
        try {
          const rawData = JSON.parse(audit.rawJson)
          
          // Extract tier and addOns from raw.options
          if (rawData.raw?.options) {
            options.tier = rawData.raw.options.tier
            options.addOns = rawData.raw.options.addOns || {}
          }
          
          // Extract competitor URLs (prefer user-provided, fallback to AI-detected)
          const competitorUrls: string[] = []
          if (rawData.competitorAnalysis?.userProvidedCompetitors) {
            competitorUrls.push(...rawData.competitorAnalysis.userProvidedCompetitors)
          } else if (rawData.competitorAnalysis?.aiDetectedCompetitors) {
            competitorUrls.push(...rawData.competitorAnalysis.aiDetectedCompetitors)
          } else if (rawData.competitorAnalysis?.competitorUrl) {
            // Fallback for older audit format
            competitorUrls.push(rawData.competitorAnalysis.competitorUrl)
          }
          options.competitorUrls = competitorUrls
        } catch (e) {
          console.warn('Could not parse rawJson for options:', e)
        }
      }
      
      // Navigate to new audit page with options in query params
      const params = new URLSearchParams()
      if (options.url) params.set('url', options.url)
      if (options.tier) params.set('tier', options.tier)
      if (options.addOns) {
        Object.entries(options.addOns).forEach(([key, value]) => {
          if (value) {
            if (typeof value === 'boolean' && value) {
              params.set(`addOns.${key}`, 'true')
            } else if (typeof value === 'number' && value > 0) {
              params.set(`addOns.${key}`, value.toString())
            }
          }
        })
      }
      if (options.competitorUrls && options.competitorUrls.length > 0) {
        // Support up to 10 competitor URLs
        options.competitorUrls.slice(0, 10).forEach((url: string, idx: number) => {
          if (url && url.trim()) {
            params.set(`competitorUrl${idx}`, url)
          }
        })
      }
      
      router.push(`/audits/new?${params.toString()}`)
    } catch (error) {
      console.error('Error preparing run again:', error)
      toast({
        title: 'Error',
        description: 'Failed to load audit options',
        variant: 'destructive'
      })
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200'
    if (score >= 60) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SEO Audits</h1>
          <p className="text-gray-600 mt-1">View and manage your audit history</p>
        </div>
        <Link href="/audits/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Audit
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              filter === 'active'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Active ({audits.filter(a => !a.archived).length})
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              filter === 'archived'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Archived ({audits.filter(a => a.archived).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              filter === 'all'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({audits.length})
          </button>
        </div>
      </div>

      {/* Audits List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading audits...</p>
        </div>
      ) : audits.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No audits found</h3>
            <p className="text-gray-600 mb-6">
              {filter === 'archived' 
                ? 'You have no archived audits.' 
                : 'Get started by creating your first SEO audit.'}
            </p>
            <Link href="/audits/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create New Audit
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {audits.map((audit) => (
            <Card 
              key={audit.id} 
              className={`hover:shadow-md transition-shadow ${
                audit.archived ? 'opacity-75' : ''
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {getDomain(audit.url)}
                      </h3>
                      {audit.status === 'running' && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <Clock className="h-3 w-3 mr-1" />
                          Running
                        </Badge>
                      )}
                      {audit.status === 'completed' && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                      {audit.status === 'failed' && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                      {audit.archived && (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          Archived
                        </Badge>
                      )}
                    </div>
                    
                    <a 
                      href={audit.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1 mb-3"
                    >
                      {audit.url}
                      <ExternalLink className="h-3 w-3" />
                    </a>

                    <div className="flex items-center gap-6 mb-4">
                      <div className={`px-3 py-1 rounded-lg border ${getScoreBgColor(audit.overallScore)}`}>
                        <div className="text-xs text-gray-600 mb-1">Overall Score</div>
                        <div className={`text-2xl font-bold ${getScoreColor(audit.overallScore)}`}>
                          {audit.overallScore}
                        </div>
                      </div>
                      
                      {audit.highSeverityIssues > 0 && (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {audit.highSeverityIssues} High Priority Issue{audit.highSeverityIssues !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Calendar className="h-4 w-4" />
                        {formatDate(audit.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Link href={`/audits/${audit.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </Link>
                    {audit.status === 'completed' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleRunAgain(audit.id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Run Again
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

