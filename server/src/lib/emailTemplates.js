// HTML + plain-text bodies for the two emails the contact form can send.
// Layout is table-based with inline styles, because email clients (Gmail, Outlook) ignore most modern CSS.
// Colours match the portfolio: violet #6A4CFF, mint #1FC7A9, ink #16183A.

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const FONT = "'Segoe UI',Helvetica,Arial,sans-serif";

function stamp() {
  return new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Karachi',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Shared page frame: pastel background, white card, gradient header with the EH badge.
function frame({ preheader, label, title, body, footer }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#E9EEFF;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E9EEFF;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(70,60,160,0.15);">
        <tr>
          <td bgcolor="#6A4CFF" style="background:#6A4CFF;background-image:linear-gradient(120deg,#6A4CFF 0%,#4B7BFF 55%,#1FC7A9 100%);padding:26px 30px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="52" valign="middle">
                <div style="width:46px;height:46px;line-height:46px;text-align:center;background:#FFFFFF;border-radius:14px;font-family:${FONT};font-size:18px;font-weight:800;color:#6A4CFF;">EH</div>
              </td>
              <td valign="middle" style="padding-left:14px;font-family:${FONT};">
                <div style="font-size:11px;letter-spacing:2.5px;font-weight:700;color:#D8D2FF;">${escapeHtml(label)}</div>
                <div style="font-size:22px;font-weight:800;color:#FFFFFF;margin-top:3px;">${escapeHtml(title)}</div>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="padding:28px 30px 8px;font-family:${FONT};color:#16183A;">${body}</td></tr>
        <tr>
          <td style="padding:18px 30px 26px;font-family:${FONT};font-size:12px;line-height:18px;color:#7A7FA8;border-top:1px solid #ECEBFA;">${footer}</td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** The email you receive when someone submits the contact form. */
export function ownerEmail({ name, email, subject, message }) {
  const n = escapeHtml(name);
  const e = escapeHtml(email);
  const s = escapeHtml(subject);
  const m = escapeHtml(message);
  const reply = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Re: ${subject}`)}`;

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2FF;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:11px;letter-spacing:2px;font-weight:700;color:#6A4CFF;">PLAYER</div>
        <div style="font-size:18px;font-weight:800;color:#16183A;margin-top:4px;">${n}</div>
        <div style="font-size:14px;margin-top:2px;"><a href="mailto:${e}" style="color:#4B33C9;text-decoration:none;">${e}</a></div>
      </td></tr>
    </table>

    <div style="font-size:11px;letter-spacing:2px;font-weight:700;color:#7A7FA8;margin:22px 0 6px;">SUBJECT</div>
    <div style="font-size:18px;font-weight:700;color:#16183A;">${s}</div>

    <div style="font-size:11px;letter-spacing:2px;font-weight:700;color:#7A7FA8;margin:22px 0 8px;">MESSAGE</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="4" bgcolor="#1FC7A9" style="background:#1FC7A9;border-radius:4px;"></td>
        <td style="padding:6px 0 6px 16px;font-size:16px;line-height:26px;color:#262A55;white-space:pre-wrap;">${m}</td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 10px;"><tr>
      <td bgcolor="#6A4CFF" style="background:#6A4CFF;border-radius:999px;">
        <a href="${reply}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Reply to ${n}</a>
      </td>
    </tr></table>`;

  const footer = `Received ${escapeHtml(stamp())} (Karachi time) through the contact form on your portfolio.<br>
    Hitting Reply in your mail app also goes straight to ${e}.`;

  return {
    subject: `[Portfolio] ${subject}`,
    html: frame({
      preheader: `${name}: ${message.replace(/\s+/g, ' ').slice(0, 110)}`,
      label: 'NEW MESSAGE',
      title: 'Someone wrote to you',
      body,
      footer,
    }),
    text: `New message from your portfolio\n\nFrom: ${name} <${email}>\nSubject: ${subject}\n\n${message}\n\n---\nReceived ${stamp()} (Karachi time). Reply to this email to answer ${name}.`,
  };
}

/** Optional receipt the visitor gets (only sent when SEND_CONFIRMATION=true and the sender can deliver to anyone). */
export function visitorEmail({ name, subject, message }, ownerName = 'Ebad') {
  const n = escapeHtml(name);
  const body = `
    <div style="font-size:18px;font-weight:800;margin-bottom:10px;">Hi ${n},</div>
    <div style="font-size:16px;line-height:26px;color:#262A55;">
      Thanks for getting in touch! Your message reached ${escapeHtml(ownerName)} and he will reply as soon as he can.
    </div>

    <div style="font-size:11px;letter-spacing:2px;font-weight:700;color:#7A7FA8;margin:24px 0 8px;">A COPY OF WHAT YOU SENT</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F2FF;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        <div style="font-size:16px;font-weight:700;color:#16183A;">${escapeHtml(subject)}</div>
        <div style="font-size:15px;line-height:24px;color:#474B78;margin-top:8px;white-space:pre-wrap;">${escapeHtml(message)}</div>
      </td></tr>
    </table>
    <div style="font-size:15px;line-height:24px;color:#474B78;margin:22px 0 10px;">Speak soon,<br><strong style="color:#16183A;">${escapeHtml(ownerName)}</strong></div>`;

  return {
    subject: `Got your message: ${subject}`,
    html: frame({
      preheader: `Thanks ${name}, your message was received.`,
      label: 'MESSAGE RECEIVED',
      title: 'Thanks for writing!',
      body,
      footer: 'You are receiving this because someone used this address on the contact form at the portfolio. If that was not you, you can ignore this email.',
    }),
    text: `Hi ${name},\n\nThanks for getting in touch! Your message reached ${ownerName} and he will reply as soon as he can.\n\nYour message:\n${subject}\n\n${message}\n\n${ownerName}`,
  };
}
