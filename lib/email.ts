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

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || 587,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPassword
    }
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

  const transporter = await getTransporter()

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    attachments: options.attachments
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

