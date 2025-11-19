import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generatePDF } from '@/lib/pdf'
import { sendEmail } from '@/lib/email'

// POST /api/audits/[id]/email - Email PDF report
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { emailTo } = body

  if (!emailTo) {
    return NextResponse.json({ error: 'emailTo is required' }, { status: 400 })
  }

  const audit = await prisma.audit.findUnique({
    where: { id: params.id }
  })

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  const branding = {
    brandName: settings?.brandName || 'SEO Audit Pro',
    brandSubtitle: settings?.brandSubtitle || undefined,
    primaryColor: settings?.primaryColor || '#3b82f6',
    logoUrl: settings?.logoUrl || undefined
  }

  const auditResult = JSON.parse(audit.rawJson)

  try {
    const pdfBuffer = await generatePDF(auditResult, branding, audit.url)

    await sendEmail({
      to: emailTo,
      subject: `SEO Audit Report - ${audit.url}`,
      text: `Please find attached the SEO audit report for ${audit.url}.\n\n${audit.shortSummary}`,
      html: `
        <h2>SEO Audit Report</h2>
        <p>Please find attached the SEO audit report for <strong>${audit.url}</strong>.</p>
        <p>${audit.shortSummary.replace(/\n/g, '<br>')}</p>
      `,
      attachments: [{
        filename: `seo-audit-${audit.id}.pdf`,
        content: pdfBuffer
      }]
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email sending error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}

