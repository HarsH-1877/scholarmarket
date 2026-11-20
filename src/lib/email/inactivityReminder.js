import nodemailer from "nodemailer";
import { renderInactivityReminderEmail } from "./templates/inactivityReminder.js";

function createTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 0);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (smtpHost) {
    const port = smtpPort || 587;
    return nodemailer.createTransport({
      host: smtpHost,
      port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }

  if (!smtpUser || !smtpPass) {
    throw new Error("Email credentials missing (EMAIL_USER/EMAIL_PASS or SMTP_*)");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });
}

/**
 * Send an inactivity reminder email to a creator whose profile has been
 * dormant for more than the configured threshold (default 180 days).
 *
 * @param {string} to        – recipient email address
 * @param {string} name      – creator display name
 * @param {number} inactiveDays – number of days since last activity
 * @param {{ materialCount: number, demotedCount: number }} stats
 * @returns {Promise<void>}
 */
export async function sendInactivityReminder(to, name, inactiveDays, stats) {
  const defaultFrom = process.env.EMAIL_USER || "no-reply@scholarmarket.local";
  const from = process.env.EMAIL_FROM || defaultFrom;
  const transporter = createTransporter();

  const { subject, text, html, headers } = renderInactivityReminderEmail({
    to,
    name,
    inactiveDays,
    stats,
  });

  await transporter.sendMail({ from, to, subject, text, html, headers });
}
