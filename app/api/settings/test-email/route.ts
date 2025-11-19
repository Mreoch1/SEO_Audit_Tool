import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendTestEmail } from '@/lib/email'

// POST /api/settings/test-email - Send test email
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { emailTo } = body

    if (!emailTo) {
      return NextResponse.json({ error: 'emailTo is required' }, { status: 400 })
    }

    await sendTestEmail(emailTo)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test email' },
      { status: 500 }
    )
  }
}

