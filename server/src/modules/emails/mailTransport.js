// modules/emails/mailTransport.js - one sendEmail() entry point, three transports:
//   1. SMTP when MAIL_HOST + MAIL_USERNAME + MAIL_PASSWORD are set (any provider, e.g. Brevo relay)
//   2. Brevo transactional REST API when BREVO_API_KEY is set (and SMTP is not)
//   3. console logger in dev when neither is configured (never silently drops in prod - it logs)
import nodemailer from 'nodemailer';
import { env, smtpEnabled, brevoEnabled } from '../../core/env.js';
import { logger } from '../../core/logger.js';

const DEFAULT_SENDER = { name: 'THREAD', email: 'no-reply@thread.dev' };
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

let smtpTransport;

/** Accepts `"Name <email@x>"` or a bare address. */
function parseSender(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim() || DEFAULT_SENDER.name, email: match[2].trim() };
  return { name: DEFAULT_SENDER.name, email: raw || DEFAULT_SENDER.email };
}

function getSmtpTransport() {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: env.MAIL_HOST.replace(/^smtps?:\/\//i, '').replace(/\/+$/, ''),
      port: env.MAIL_PORT,
      secure: env.MAIL_PORT === 465, // 465 = implicit TLS; 587 upgrades via STARTTLS
      auth: { user: env.MAIL_USERNAME, pass: env.MAIL_PASSWORD },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return smtpTransport;
}

const redact = (to = '') => `${String(to).slice(0, 3)}***`;

export async function sendEmail({ to, subject, html, text }) {
  const sender = parseSender(env.MAIL_FROM);

  if (smtpEnabled) {
    const info = await getSmtpTransport().sendMail({
      from: { name: sender.name, address: sender.email },
      to,
      subject,
      html,
      text: text || stripHtml(html),
    });
    if (!info.accepted?.length && info.rejected?.length) {
      throw new Error(`SMTP rejected recipient(s): ${info.rejected.join(', ')}`);
    }
    logger.info({ transport: 'smtp', to: redact(to), messageId: info.messageId }, 'email sent');
    return { dev: false, status: 'sent', transport: 'smtp' };
  }

  if (brevoEnabled) {
    const payload = {
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text || stripHtml(html),
    };
    const response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'api-key': env.BREVO_API_KEY,
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Brevo send failed (${response.status}): ${errBody.slice(0, 300)}`);
    }
    logger.info({ transport: 'brevo', to: redact(to) }, 'email sent');
    return { dev: false, status: 'sent', transport: 'brevo' };
  }

  logger.warn({ to: redact(to), subject }, 'DEV EMAIL (no SMTP/API transport configured)');
  logger.warn({ html: html.slice(0, 400) }, 'DEV EMAIL PREVIEW');
  return { dev: true, status: 'logged' };
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
