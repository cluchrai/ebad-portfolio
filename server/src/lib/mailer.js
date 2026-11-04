import nodemailer from 'nodemailer';

// Two ways to send, chosen by which keys are set:
// - RESEND_API_KEY: Resend's HTTPS API. Needed on hosts that block SMTP ports (Render's free tier).
// - SMTP_*: any SMTP server, e.g. Gmail with an App Password. Fine for local development.

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email is not configured. Set RESEND_API_KEY, or SMTP_HOST, SMTP_USER and SMTP_PASS, in .env.');
  }
  const port = Number(SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // fail in seconds, not nodemailer's default 2 minutes, if the host cannot reach the SMTP server
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return transporter;
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function sendWithResend({ from, to, replyTo, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, text, html }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend responded ${res.status}: ${detail.slice(0, 300)}`);
  }
}

export async function sendContactEmail({ name, email, subject, message }) {
  const safe = { name: escapeHtml(name), email: escapeHtml(email), subject: escapeHtml(subject), message: escapeHtml(message) };
  const useResend = Boolean(process.env.RESEND_API_KEY);

  const mail = {
    // Resend's shared sender works without a domain, but only delivers to the address you signed up with
    from: useResend
      ? process.env.RESEND_FROM || 'Portfolio contact form <onboarding@resend.dev>'
      : `"Portfolio contact form" <${process.env.SMTP_USER}>`,
    to: process.env.CONTACT_TO || process.env.SMTP_USER,
    replyTo: `"${name.replace(/"/g, '')}" <${email}>`,
    subject: `[Portfolio] ${subject}`,
    text: `From: ${name} <${email}>\nSubject: ${subject}\n\n${message}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <h2 style="margin:0 0 12px">New message from your portfolio</h2>
        <p><strong>From:</strong> ${safe.name} &lt;${safe.email}&gt;</p>
        <p><strong>Subject:</strong> ${safe.subject}</p>
        <hr />
        <p style="white-space:pre-wrap">${safe.message}</p>
      </div>`,
  };

  if (useResend) return sendWithResend(mail);
  await getTransporter().sendMail(mail);
}
