import { PrismaClient } from '@prisma/client'
import { generatePDF } from '../lib/pdf'
import { Colors } from '../lib/brandColors'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  const auditId = process.argv[2] || 'cmidhz3ho0000wb879dsj4av4'

  console.log(`📄 Saving PDF for audit: ${auditId}\n`)

  const audit = await prisma.audit.findUnique({
    where: { id: auditId }
  })

  if (!audit) {
    console.error('❌ Audit not found')
    process.exit(1)
  }

  if (!audit.rawJson) {
    console.error('❌ Audit has no result data')
    process.exit(1)
  }

  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  if (!settings) {
    console.error('❌ App settings not found')
    process.exit(1)
  }

  console.log('📄 Generating PDF...')
  const auditResult = JSON.parse(audit.rawJson as string)
  const branding = {
    brandName: settings.brandName || 'SEO Audit Pro',
    brandSubtitle: settings.brandSubtitle,
    primaryColor: settings.primaryColor || Colors.primary,
    logoUrl: settings.logoUrl
  }
  const pdfBuffer = await generatePDF(auditResult, branding, audit.url)

  // Get domain name for filename
  const url = new URL(audit.url)
  const domain = url.hostname.replace('www.', '')
  const filename = `${domain}-SEO-Audit-${Date.now()}.pdf`
  const filepath = path.join(process.cwd(), filename)

  fs.writeFileSync(filepath, pdfBuffer)

  console.log('✅ PDF saved successfully!')
  console.log(`\n   File: ${filename}`)
  console.log(`   Path: ${filepath}`)
  console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB\n`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

