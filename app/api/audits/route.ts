import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runAudit } from '@/lib/seoAudit'
import { generateShortSummary, generateDetailedSummary } from '@/lib/reportSummary'

// Ensure we're using Node.js runtime (required for Puppeteer)
export const runtime = 'nodejs'

// GET /api/audits - List audits
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit
    const filter = searchParams.get('filter') || 'active' // 'all' | 'active' | 'archived'
    const groupBy = searchParams.get('groupBy') === 'website' // group by base domain

    // Build where clause
    const where: any = {}
    if (filter === 'active') {
      where.archived = false
    } else if (filter === 'archived') {
      where.archived = true
    }

    if (groupBy) {
      const uniqueUrls = await prisma.audit.findMany({
        where,
        select: { url: true },
        distinct: ['url'],
        orderBy: { createdAt: 'desc' }
      })

      const groupedAudits = await Promise.all(uniqueUrls.map(async (u) => {
        const auditsForUrl = await prisma.audit.findMany({
          where: { ...where, url: u.url },
          orderBy: { createdAt: 'desc' },
          include: {
            issues: {
              where: { severity: 'High' },
              select: { id: true }
            }
          }
        })
        return {
          url: u.url,
          latestAudit: auditsForUrl[0] ? {
            id: auditsForUrl[0].id,
            url: auditsForUrl[0].url,
            overallScore: auditsForUrl[0].overallScore,
            createdAt: auditsForUrl[0].createdAt,
            highSeverityIssues: auditsForUrl[0].issues.length,
            archived: auditsForUrl[0].archived ?? false
          } : null,
          allAudits: auditsForUrl.map(a => ({
            id: a.id,
            url: a.url,
            overallScore: a.overallScore,
            createdAt: a.createdAt,
            highSeverityIssues: a.issues.length,
            archived: a.archived ?? false
          }))
        }
      }))

      const filteredGroupedAudits = groupedAudits.filter(g => g.latestAudit !== null)
      return NextResponse.json({
        groupedAudits: filteredGroupedAudits,
        pagination: {
          page: 1,
          limit: filteredGroupedAudits.length,
          total: filteredGroupedAudits.length,
          totalPages: 1
        }
      })
    } else {
      const [audits, total] = await Promise.all([
        prisma.audit.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            issues: {
              where: { severity: 'High' },
              select: { id: true }
            }
          }
        }),
        prisma.audit.count({ where })
      ])

      const auditList = audits.map(a => ({
        id: a.id,
        url: a.url,
        overallScore: a.overallScore,
        createdAt: a.createdAt,
        archived: a.archived ?? false, // Handle undefined (old records)
        highSeverityIssues: a.issues.length
      }))

      return NextResponse.json({
        audits: auditList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    }
  } catch (error) {
    console.error('GET /api/audits error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch audits',
        audits: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
      },
      { status: 500 }
    )
  }
}

// POST /api/audits - Create new audit
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { url, maxPages, maxDepth, tier, addOns, competitorUrls } = body

    console.log('[API /api/audits POST] Received request:', { url, tier, addOns, competitorUrls })

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Create audit record immediately with "running" status
    const audit = await prisma.audit.create({
      data: {
        url,
        status: 'running',
        overallScore: 0,
        technicalScore: 0,
        onPageScore: 0,
        contentScore: 0,
        accessibilityScore: 0,
        shortSummary: 'Audit in progress...',
        detailedSummary: 'The audit is currently running. This may take several minutes for large sites.',
        rawJson: null
      }
    })

    // Run audit in background (don't await - return immediately)
    // Use .catch() to ensure errors are logged and don't crash the process
    processAuditInBackground(audit.id, url, { maxPages, maxDepth, tier, addOns, competitorUrls }).catch((error) => {
      console.error(`Background audit processing failed for ${audit.id}:`, error)
      // Error is already handled in processAuditInBackground, just log here
    })

    return NextResponse.json({ id: audit.id, status: 'running' })
  } catch (error) {
    console.error('Audit creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create audit' },
      { status: 500 }
    )
  }
}

/**
 * Process audit in background
 * This function runs asynchronously and updates the audit record when complete
 */
async function processAuditInBackground(
  auditId: string,
  url: string,
  options: {
    maxPages?: number
    maxDepth?: number
    tier?: 'starter' | 'standard' | 'professional' | 'agency'
    addOns?: any
    competitorUrls?: string[]
  }
) {
  try {
    console.log(`[Audit ${auditId}] Starting background processing for ${url}...`)
    const auditStartTime = Date.now()
    
    // Run audit with tier-based options, add-ons, and competitor URLs
    const auditResult = await runAudit(url, {
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      tier: options.tier,
      addOns: options.addOns,
      competitorUrls: options.competitorUrls && Array.isArray(options.competitorUrls) ? options.competitorUrls : undefined
    })

    const auditDuration = Math.round((Date.now() - auditStartTime) / 1000)
    console.log(`[Audit ${auditId}] Audit completed in ${auditDuration}s, processing ${auditResult.pages.length} pages`)

    // Generate summaries
    const shortSummary = generateShortSummary(auditResult)
    const detailedSummary = generateDetailedSummary(auditResult)

    // Update audit record with results
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'completed',
        overallScore: auditResult.summary.overallScore,
        technicalScore: auditResult.summary.technicalScore,
        onPageScore: auditResult.summary.onPageScore,
        contentScore: auditResult.summary.contentScore,
        accessibilityScore: auditResult.summary.accessibilityScore,
        shortSummary,
        detailedSummary,
        rawJson: JSON.stringify(auditResult),
        issues: {
          create: [
            ...auditResult.technicalIssues,
            ...auditResult.onPageIssues,
            ...auditResult.contentIssues,
            ...auditResult.accessibilityIssues,
            ...auditResult.performanceIssues
          ].map(issue => ({
            category: issue.category,
            severity: issue.severity,
            message: issue.message,
            details: issue.details || '',
            affectedPagesJson: JSON.stringify(issue.affectedPages || [])
          }))
        }
      }
    })
    
    console.log(`[Audit ${auditId}] Successfully completed and saved`)
  } catch (error) {
    console.error(`[Audit ${auditId}] Processing error:`, error)
    console.error(`[Audit ${auditId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace')
    
    // Update audit with failed status
    try {
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          status: 'failed',
          shortSummary: 'Audit failed to complete',
          detailedSummary: error instanceof Error ? error.message : 'An unknown error occurred during the audit.'
        }
      })
      console.log(`[Audit ${auditId}] Marked as failed in database`)
    } catch (updateError) {
      console.error(`[Audit ${auditId}] Failed to update status to 'failed':`, updateError)
    }
  }
}

