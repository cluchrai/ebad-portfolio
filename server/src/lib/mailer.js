import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.');
  }
  const port = Number(SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function sendContactEmail({ name, email, subject, message }) {
  const t = getTransporter();
  const safe = { name: escapeHtml(name), email: escapeHtml(email), subject: escapeHtml(subject), message: escapeHtml(message) };

  await t.sendMail({
    from: `"Portfolio contact form" <${process.env.SMTP_USER}>`,
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
  });
}
