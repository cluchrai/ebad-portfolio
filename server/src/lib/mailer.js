import nodemailer from 'nodemailer';
import { ownerEmail, visitorEmail } from './emailTemplates.js';

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

const useResend = () => Boolean(process.env.RESEND_API_KEY);
const deliver = (mail) => (useResend() ? sendWithResend(mail) : getTransporter().sendMail(mail));

export async function sendContactEmail({ name, email, subject, message }) {
  const owner = ownerEmail({ name, email, subject, message });
  const from = useResend()
    ? // Resend's shared sender works without a domain, but only delivers to the address you signed up with
      process.env.RESEND_FROM || 'Portfolio contact form <onboarding@resend.dev>'
    : `"Portfolio contact form" <${process.env.SMTP_USER}>`;
  const to = process.env.CONTACT_TO || process.env.SMTP_USER;

  await deliver({ from, to, replyTo: `"${name.replace(/"/g, '')}" <${email}>`, ...owner });

  // Optional receipt for the visitor. Off by default: Resend's shared sender cannot deliver to other people,
  // so turn it on only with a verified domain (RESEND_FROM) or SMTP. A failure here never fails the request.
  if (process.env.SEND_CONFIRMATION === 'true') {
    try {
      await deliver({ from, to: email, replyTo: to, ...visitorEmail({ name, subject, message }) });
    } catch (err) {
      console.error('Confirmation email failed:', err.message);
    }
  }
}
