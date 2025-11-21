import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/audits/[id] - Get audit details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const audit = await prisma.audit.findUnique({
    where: { id: params.id },
    include: {
      issues: true
    }
  })

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  const rawJson = JSON.parse(audit.rawJson)

  return NextResponse.json({
    ...audit,
    rawJson,
    issues: audit.issues.map(issue => ({
      ...issue,
      affectedPages: JSON.parse(issue.affectedPagesJson)
    }))
  })
}

// PATCH /api/audits/[id] - Update audit (archive/unarchive)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { archived } = body

    if (typeof archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 })
    }

    const audit = await prisma.audit.update({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.audit.delete({
      where: { id: params.id }
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

