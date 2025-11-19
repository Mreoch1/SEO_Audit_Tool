import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { runAudit } from '@/lib/seoAudit'
import { generateShortSummary, generateDetailedSummary } from '@/lib/reportSummary'

// GET /api/audits - List audits
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const [audits, total] = await Promise.all([
    prisma.audit.findMany({
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
    prisma.audit.count()
  ])

  return NextResponse.json({
    audits: audits.map(a => ({
      id: a.id,
      url: a.url,
      overallScore: a.overallScore,
      createdAt: a.createdAt,
      highSeverityIssues: a.issues.length
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  })
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

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Run audit with tier-based options, add-ons, and competitor URLs
    const auditResult = await runAudit(url, { 
      maxPages, 
      maxDepth, 
      tier, 
      addOns,
      competitorUrls: competitorUrls && Array.isArray(competitorUrls) ? competitorUrls : undefined
    })

    // Generate summaries
    const shortSummary = generateShortSummary(auditResult)
    const detailedSummary = generateDetailedSummary(auditResult)

    // Save to database
    const audit = await prisma.audit.create({
      data: {
        url,
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

    return NextResponse.json({ id: audit.id })
  } catch (error) {
    console.error('Audit creation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create audit' },
      { status: 500 }
    )
  }
}

