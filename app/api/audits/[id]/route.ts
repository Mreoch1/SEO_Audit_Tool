import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/audits/[id] - Get audit details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle both sync and async params (Next.js 13+ uses async params)
    const resolvedParams = params instanceof Promise ? await params : params
    const auditId = resolvedParams.id

    if (!auditId) {
      return NextResponse.json({ error: 'Audit ID is required' }, { status: 400 })
    }

    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: {
        issues: true
      }
    })

    if (!audit) {
      console.error(`[GET /api/audits/${auditId}] Audit not found in database`)
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }

    // Handle null rawJson (audit still running)
    const rawJson = audit.rawJson ? JSON.parse(audit.rawJson) : {
      summary: {
        overallScore: audit.overallScore || 0,
        technicalScore: audit.technicalScore || 0,
        onPageScore: audit.onPageScore || 0,
        contentScore: audit.contentScore || 0,
        accessibilityScore: audit.accessibilityScore || 0
      },
      pages: [],
      technicalIssues: [],
      onPageIssues: [],
      contentIssues: [],
      accessibilityIssues: [],
      performanceIssues: [],
      siteWide: {},
      imageAltAnalysis: [],
      competitorAnalysis: null,
      raw: { options: {} }
    }

    return NextResponse.json({
      ...audit,
      rawJson,
      issues: audit.issues.map(issue => {
        let affectedPages: string[] = []
        try {
          if (issue.affectedPagesJson) {
            affectedPages = JSON.parse(issue.affectedPagesJson)
            // Ensure it's an array
            if (!Array.isArray(affectedPages)) {
              affectedPages = []
            }
          }
        } catch (parseError) {
          console.warn(`[GET /api/audits/${auditId}] Failed to parse affectedPagesJson for issue ${issue.id}:`, parseError)
          affectedPages = []
        }
        return {
          ...issue,
          affectedPages
        }
      })
    })
  } catch (error) {
    console.error('[GET /api/audits/[id]] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch audit' },
      { status: 500 }
    )
  }
}

// PATCH /api/audits/[id] - Update audit (archive/unarchive)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const auditId = resolvedParams.id

    const body = await request.json()
    const { archived } = body

    if (typeof archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 })
    }

    const audit = await prisma.audit.update({
      where: { id: auditId },
      data: { archived }
    })

    return NextResponse.json({ success: true, audit: { id: audit.id, archived: audit.archived } })
  } catch (error) {
    console.error('Audit update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update audit' },
      { status: 500 }
    )
  }
}

// DELETE /api/audits/[id] - Delete audit
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params
    const auditId = resolvedParams.id

    await prisma.audit.delete({
      where: { id: auditId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Audit deletion error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete audit' },
      { status: 500 }
    )
  }
}

