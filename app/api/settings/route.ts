import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/settings - Get app settings
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  if (!settings) {
    // Create default settings
    settings = await prisma.appSettings.create({
      data: {
        id: 'singleton',
        brandName: 'SEO Audit Pro',
        primaryColor: '#3b82f6'
      }
    })
  }

  // Don't return password
  const { smtpPassword, ...safeSettings } = settings

  return NextResponse.json(safeSettings)
}

// POST /api/settings - Update app settings
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      brandName,
      brandSubtitle,
      primaryColor,
      logoUrl,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpFrom
    } = body

    const settings = await prisma.appSettings.upsert({
      where: { id: 'singleton' },
      update: {
        brandName,
        brandSubtitle,
        primaryColor,
        logoUrl,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword: smtpPassword || undefined, // Only update if provided
        smtpFrom
      },
      create: {
        id: 'singleton',
        brandName: brandName || 'SEO Audit Pro',
        brandSubtitle,
        primaryColor: primaryColor || '#3b82f6',
        logoUrl,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        smtpFrom
      }
    })

    const { smtpPassword: _, ...safeSettings } = settings

    return NextResponse.json(safeSettings)
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

