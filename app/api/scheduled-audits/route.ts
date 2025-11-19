import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isValidCronExpression, getNextRunTime } from '@/lib/cron'

// GET /api/scheduled-audits - List scheduled audits
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scheduledAudits = await prisma.scheduledAudit.findMany({
    orderBy: { createdAt: 'desc' }
  })

  const auditsWithNextRun = scheduledAudits.map(audit => ({
    ...audit,
    nextRun: getNextRunTime(audit.cronExpression, audit.lastRunAt || undefined)
  }))

  return NextResponse.json(auditsWithNextRun)
}

// POST /api/scheduled-audits - Create scheduled audit
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { url, cronExpression, emailTo, active = true } = body

    if (!url || !cronExpression) {
      return NextResponse.json(
        { error: 'URL and cronExpression are required' },
        { status: 400 }
      )
    }

    if (!isValidCronExpression(cronExpression)) {
      return NextResponse.json(
        { error: 'Invalid cron expression' },
        { status: 400 }
      )
    }

    const scheduledAudit = await prisma.scheduledAudit.create({
      data: {
        url,
        cronExpression,
        emailTo,
        active
      }
    })

    return NextResponse.json(scheduledAudit)
  } catch (error) {
    console.error('Scheduled audit creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create scheduled audit' },
      { status: 500 }
    )
  }
}

