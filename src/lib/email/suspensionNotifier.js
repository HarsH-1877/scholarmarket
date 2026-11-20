import nodemailer from 'nodemailer'
import { renderSuspensionEmail, renderReactivationEmail } from './templates/suspension.js'

function createTransporter() {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT || 0)
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS

  if (smtpHost) {
    const port = smtpPort || 587
    return nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass },
    })
  }

  if (!smtpUser || !smtpPass) {
    throw new Error('Email credentials missing (EMAIL_USER/EMAIL_PASS or SMTP_*)')
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  })
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a suspension notification email to the affected user.
 *
 * @param {{ to: string, name: string, reason?: string, appealEmail?: string }} opts
 */
export async function sendSuspensionEmail({ to, name, reason, appealEmail }) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@scholarmarket.local'
  const transporter = createTransporter()
  const { subject, text, html } = renderSuspensionEmail({ name, reason, appealEmail })

  await transporter.sendMail({ from, to, subject, text, html })
}

/**
 * Sends a reactivation notification email to the affected user.
 *
 * @param {{ to: string, name: string }} opts
 */
export async function sendReactivationEmail({ to, name }) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@scholarmarket.local'
  const transporter = createTransporter()
  const { subject, text, html } = renderReactivationEmail({ name })

  await transporter.sendMail({ from, to, subject, text, html })
}
