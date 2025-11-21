/**
 * Email Utilities
 * 
 * Handles sending emails via Nodemailer using SMTP settings
 */

import nodemailer from 'nodemailer'
import { prisma } from './db'

export interface EmailOptions {
  to: string
  subject: string
  text?: string
  html?: string
  attachments?: Array<{
    filename: string
    content: Buffer
  }>
}

/**
 * Get SMTP transporter from database settings
 */
async function getTransporter() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPassword) {
    throw new Error('SMTP settings not configured. Please configure in Settings page.')
  }

  // Zoho-specific configuration
  const isZoho = settings.smtpHost?.includes('zoho.com')
  
  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || 587,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPassword
    },
    // Zoho-specific settings for better deliverability
    ...(isZoho && {
      tls: {
        rejectUnauthorized: false // Zoho sometimes has certificate issues
      },
      // Ensure proper connection pooling
      pool: true,
      maxConnections: 1,
      maxMessages: 10
    })
  })
}

/**
 * Send email
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  const from = settings?.smtpFrom || settings?.smtpUser || 'noreply@example.com'
  const fromName = settings?.brandName || 'SEO Audit Pro'
  
  // Format from address with name for better deliverability
  const fromFormatted = fromName ? `${fromName} <${from}>` : from

  const transporter = await getTransporter()

  // Generate unique Message-ID for better deliverability
  const messageId = `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@${from.split('@')[1] || 'seoauditpro.net'}>`

  await transporter.sendMail({
    from: fromFormatted,
    to: options.to,
    replyTo: from, // Add reply-to for better deliverability
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments,
    // Add headers to improve deliverability
    headers: {
      'Message-ID': messageId,
      'X-Mailer': 'SEO Audit Pro',
      'X-Priority': '1', // Normal priority
      'Importance': 'normal',
      'List-Unsubscribe': `<mailto:${from}?subject=unsubscribe>`, // Unsubscribe header
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', // One-click unsubscribe
      'Precedence': 'bulk', // Mark as transactional/bulk
      'Auto-Submitted': 'auto-generated', // Mark as automated
      'Content-Type': 'text/html; charset=UTF-8',
      'MIME-Version': '1.0'
    },
    // Add priority for better inbox placement
    priority: 'normal'
  })
}

/**
 * Send test email
 */
export async function sendTestEmail(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'SEO Audit App - Test Email',
    text: 'This is a test email from the SEO Audit App. If you received this, your SMTP settings are configured correctly.',
    html: '<p>This is a test email from the SEO Audit App. If you received this, your SMTP settings are configured correctly.</p>'
  })
}

