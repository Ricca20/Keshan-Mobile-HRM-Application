import nodemailer from 'nodemailer'
import { after } from 'next/server'

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'PhoneShop HRM'

/**
 * SMTP transport. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS to send through a
 * transactional provider on your own domain (Resend, Brevo, SES, ...), which is what
 * keeps mail out of spam. Without them it falls back to Gmail with EMAIL_USER/EMAIL_PASS.
 */
function createTransport() {
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587)
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  })
}

const transporter = createTransport()

function senderAddress(): string | undefined {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER
}

/** Escapes untrusted values before interpolating them into email HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * A call-to-action button plus the same link as plain text underneath, so the email
 * still works when the client blocks or strips the button.
 */
export function emailButton(url: string, label: string): string {
  const href = escapeHtml(url)
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:8px;background:#2563eb;">
<a href="${href}" target="_blank" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr></table>
<p style="font-size:13px;color:#64748b;margin:0 0 16px;">If the button does not work, copy and paste this link into your browser:<br>
<a href="${href}" target="_blank" style="color:#2563eb;word-break:break-all;">${href}</a></p>`
}

function layout(subject: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0f172a;">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e2e8f0;font-weight:bold;font-size:17px;color:#1e3a8a;">${escapeHtml(APP_NAME)}</td></tr>
<tr><td style="padding:24px 28px;">${body}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">This is an automated message from the ${escapeHtml(APP_NAME)} staff system. You are receiving it because you have an account there.</td></tr>
</table></td></tr></table></body></html>`
}

/** Plain-text version of an email body. Mail without one is far more likely to be marked as spam. */
function toPlainText(html: string): string {
  return html
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, text: string) => {
      const label = text.replace(/<[^>]+>/g, '').trim()
      return label && label !== href ? `${label}: ${href}` : href
    })
    .replace(/<(br|\/p|\/h\d|\/div|\/tr|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function deliver(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: { name: APP_NAME, address: senderAddress()! },
      replyTo: process.env.EMAIL_REPLY_TO || undefined,
      to,
      subject,
      html: layout(subject, html),
      text: toPlainText(html),
    })
  } catch (error) {
    console.error(`Failed to send email "${subject}" to ${to}:`, error)
  }
}

/**
 * Sends an email in the standard layout. Delivery runs after the response is sent
 * (SMTP can take seconds), so API calls like clock-in never wait on, or fail because of, email.
 */
export async function sendNotificationEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const configured = process.env.SMTP_HOST
    ? process.env.SMTP_USER && process.env.SMTP_PASS
    : process.env.EMAIL_USER && process.env.EMAIL_PASS
  if (!configured || !senderAddress()) {
    console.warn('⚠️ SMTP credentials not found. Skipping email sending.')
    return
  }

  const cleanSubject = subject.replace(/[\r\n]+/g, ' ')
  try {
    after(() => deliver(to, cleanSubject, html))
  } catch {
    // Outside a request (e.g. a script): send right away
    await deliver(to, cleanSubject, html)
  }
}
