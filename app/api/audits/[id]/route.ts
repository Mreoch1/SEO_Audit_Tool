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

