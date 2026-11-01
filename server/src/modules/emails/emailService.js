// modules/emails/emailService.js - templates + high-level senders (HTML emails).
import { sendEmail } from './mailTransport.js';
import { logger } from '../../core/logger.js';

const layout = (title, bodyHtml, footNote = '') => `
<!doctype html><html><body style="margin:0;padding:24px 8px;background:#faf7f2;font-family:Georgia,'Times New Roman',serif;color:#2b2118">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8e0d4;border-radius:10px;overflow:hidden">
    <div style="background:#2b2118;color:#faf7f2;padding:18px 28px;letter-spacing:.22em;font-size:13px">T H R E A D</div>
    <div style="padding:28px">
      <h1 style="margin:0 0 14px;font-size:22px;font-weight:normal;color:#2b2118">${title}</h1>
      ${bodyHtml}
      <p style="margin-top:26px;color:#8a7f70;font-size:13px">${footNote || 'Need help? Reply to this email or visit thread.dev/support (demo).'}</p>
    </div>
    <div style="padding:16px 28px;background:#f5f1e9;color:#8a7f70;font-size:12px">
      THREAD Editorial Clothing &middot; Bengaluru, India &middot; <span style="font-family:Helvetica,Arial,sans-serif">transactional email</span>
    </div>
  </div>
</body></html>`;

const p = (text) => `<p style="margin:12px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#3d3327">${text}</p>`;
const span = (text) => `<span style="display:inline-block;margin-top:10px;background:#faf7f2;border:1px solid #e8d8c0;padding:12px 22px;border-radius:8px;font-family:'Courier New',monospace;font-size:22px;letter-spacing:.35em;color:#2b2118">${text}</span>`;
const btn = (href, label) => `<a href="${href}" style="display:inline-block;margin-top:16px;background:#2b2118;color:#faf7f2;padding:10px 22px;border-radius:6px;font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:.08em;text-decoration:none">${label}</a>`;

export const emailService = {
  async sendOtp({ email, name, code, blurb }) {
    return sendEmail({
      to: email,
      subject: `Your THREAD code: ${code}`,
      html: layout(
        `${blurb.charAt(0).toUpperCase() + blurb.slice(1)}`,
        `${p(`Hi ${escapeHtml(name)}, this is your one-time code. It expires in 10 minutes and can be used only once.`)}${span(code)}`,
      ),
    });
  },

  async sendWelcome({ email, name, shopUrl }) {
    return sendEmail({
      to: email,
      subject: 'Welcome to THREAD',
      html: layout(
        'Welcome to THREAD',
        `${p(`Hi ${escapeHtml(name)}, your account is verified. Enjoy exploring this season's collection.`)}${btn(shopUrl || 'http://localhost:5173/shop', 'Start shopping')}`,
      ),
    });
  },

  async sendOrderConfirmation({ email, name, orderUrl, orderNumber, totalFmt, method }) {
    return sendEmail({
      to: email,
      subject: `Order ${orderNumber} confirmed`,
      html: layout(
        'Thank you for your order',
        `${p(`Hi ${escapeHtml(name)}, your order <strong>${orderNumber}</strong> (${escapeHtml(method)}) is confirmed with a total of <strong>${totalFmt}</strong>.`)}${btn(orderUrl, 'Track the order')}`,
      ),
    });
  },

  async sendOrderCancelled({ email, name, orderNumber }) {
    return sendEmail({
      to: email,
      subject: `Order ${orderNumber} cancelled`,
      html: layout('Order cancelled', `${p(`Hi ${escapeHtml(name)}, order ${orderNumber} is cancelled. If a payment was taken, the refund timeline is 5-7 working days.`)}`),
    });
  },

  async sendOrderStatus({ email, name, orderNumber, status, note }) {
    return sendEmail({
      to: email,
      subject: `Order ${orderNumber} is now ${status}`,
      html: layout(`Order ${orderNumber}: ${status}`, `${p(`Hi ${escapeHtml(name)}, the order status changed to <strong>${status}</strong>.${note ? ` ${escapeHtml(note)}` : ''}`)}`),
    });
  },

  async sendPasswordChanged(email, name) {
    return sendEmail({
      to: email,
      subject: 'Your THREAD password was changed',
      html: layout('Password changed', `${p(`Hi ${escapeHtml(name)}, your password was just changed. If this was not you, reset the password immediately.`)}`),
    });
  },
};

function escapeHtml(v = '') {
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// fail-soft wrapper: order flow must not break when email fails
export async function safeSend(fnLabel, fn) {
  try {
    return await fn();
  } catch (err) {
    logger.error({ err: err.message, fnLabel }, `email ${fnLabel} failed`);
    return null;
  }
}
