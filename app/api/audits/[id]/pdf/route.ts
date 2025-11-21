import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generatePDF } from '@/lib/pdf'

// GET /api/audits/[id]/pdf - Generate PDF report
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resolvedParams = params instanceof Promise ? await params : params
  const auditId = resolvedParams.id

  const audit = await prisma.audit.findUnique({
    where: { id: auditId }
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

  if (!audit.rawJson) {
    return NextResponse.json({ error: 'Audit data not found' }, { status: 404 })
  }

  const auditResult = JSON.parse(audit.rawJson)

  try {
    const pdfBuffer = await generatePDF(auditResult, branding, audit.url)

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="seo-audit-${audit.id}.pdf"`
      }
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

