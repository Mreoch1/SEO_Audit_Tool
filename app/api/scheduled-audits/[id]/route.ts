import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isValidCronExpression } from '@/lib/cron'

// PATCH /api/scheduled-audits/[id] - Update scheduled audit
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
    const { url, cronExpression, emailTo, active } = body

    if (cronExpression && !isValidCronExpression(cronExpression)) {
      return NextResponse.json(
        { error: 'Invalid cron expression' },
        { status: 400 }
      )
    }

    const scheduledAudit = await prisma.scheduledAudit.update({
      where: { id: params.id },
      data: {
        url,
        cronExpression,
        emailTo,
        active
      }
    })

    return NextResponse.json(scheduledAudit)
  } catch (error) {
    console.error('Scheduled audit update error:', error)
    return NextResponse.json(
      { error: 'Failed to update scheduled audit' },
      { status: 500 }
    )
  }
}

// DELETE /api/scheduled-audits/[id] - Delete scheduled audit
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.scheduledAudit.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Scheduled audit deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete scheduled audit' },
      { status: 500 }
    )
  }
}

