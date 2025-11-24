/**
 * Email Utilities
 * 
 * Handles sending emails via Resend API (preferred) or SMTP fallback
 * Maintains full branding support
 */

import nodemailer from 'nodemailer'
import { Resend } from 'resend'
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
 * Send email via Resend API (preferred for better deliverability)
 */
async function sendEmailViaResend(options: EmailOptions, settings: any): Promise<void> {
  if (!settings.resendApiKey) {
    throw new Error('Resend API key not configured')
  }

  const resend = new Resend(settings.resendApiKey)
  
  // Try custom domain first, fallback to Resend default domain if not verified
  let from = settings.smtpFrom || settings.smtpUser || 'onboarding@resend.dev'
  const fromName = settings.brandName || 'SEO Audit Pro'
  
  // Check if using custom domain - if so, try it first, then fallback to Resend default
  const isCustomDomain = from.includes('@') && !from.includes('resend.dev') && !from.includes('onboarding@')
  
  // Resend format: "Name <email@domain.com>"
  let fromFormatted = `${fromName} <${from}>`

  // Convert attachments to Resend format
  const attachments = options.attachments?.map(att => ({
    filename: att.filename,
    content: att.content
  })) || []

  let result = await resend.emails.send({
    from: fromFormatted,
    to: options.to,
    replyTo: from,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: attachments.length > 0 ? attachments : undefined
  })

  // If custom domain fails verification, retry with Resend default domain
  if (result.error && isCustomDomain && result.error.message?.includes('not verified')) {
    console.log(`[Resend] Custom domain not verified, using Resend default domain`)
    from = 'onboarding@resend.dev'
    fromFormatted = `${fromName} <${from}>`
    
    result = await resend.emails.send({
      from: fromFormatted,
      to: options.to,
      replyTo: from,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: attachments.length > 0 ? attachments : undefined
    })
  }

  if (result.error) {
    throw new Error(`Resend API error: ${result.error.message}`)
  }
}

/**
 * Send email via SMTP (fallback)
 */
async function sendEmailViaSMTP(options: EmailOptions, settings: any): Promise<void> {
  const from = settings.smtpFrom || settings.smtpUser || 'noreply@example.com'
  const fromName = settings.brandName || 'SEO Audit Pro'
  
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
    // Add headers to improve deliverability (Zoho-optimized)
    headers: {
      'Message-ID': messageId,
      'X-Mailer': 'SEO Audit Pro',
      'X-Priority': '3', // Normal priority (1=high, 3=normal, 5=low)
      'Importance': 'normal',
      'Precedence': 'normal', // Changed from 'bulk' - transactional emails should be 'normal'
      'Auto-Submitted': 'auto-generated', // Mark as automated
      'Content-Type': 'text/html; charset=UTF-8',
      'MIME-Version': '1.0',
      // Remove spam trigger words from headers
      'X-Entity-Ref-ID': messageId // Unique reference for tracking
    },
    // Add priority for better inbox placement
    priority: 'normal',
    // Zoho-specific: Ensure proper encoding
    encoding: 'UTF-8'
  })
}

/**
 * Send email (uses Resend if configured, otherwise SMTP)
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 'singleton' }
  })

  if (!settings) {
    throw new Error('App settings not found')
  }

  // Use Resend if API key is configured, otherwise fallback to SMTP
  const useResend = settings.resendApiKey && (settings.emailProvider === 'resend' || !settings.emailProvider)
  
  if (useResend) {
    try {
      await sendEmailViaResend(options, settings)
      return
    } catch (error) {
      console.warn('Resend API failed, falling back to SMTP:', error)
      // Fall through to SMTP
    }
  }

  // Fallback to SMTP
  await sendEmailViaSMTP(options, settings)
}

/**
 * Send test email
 */
export async function sendTestEmail(to: string): Promise<void> {
  await sendEmail({
    to,
    subject: 'SEO Audit App - Test Email',
    text: 'This is a test email from the SEO Audit App. If you received this, your email settings are configured correctly.',
    html: '<p>This is a test email from the SEO Audit App. If you received this, your email settings are configured correctly.</p>'
  })
}
