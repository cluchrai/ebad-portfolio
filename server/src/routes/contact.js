import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { sendContactEmail } from '../lib/mailer.js';

const router = Router();

// Max 5 messages per visitor every 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many messages from this connection. Wait 15 minutes and try again.' },
});

// No line breaks allowed in name/subject (blocks email header injection)
const singleLine = (min, max, label) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(min, `${label} needs at least ${min} characters.`)
    .max(max, `${label} must be under ${max} characters.`)
    .refine((v) => !/[\r\n]/.test(v), `${label} can't contain line breaks.`);

const schema = z.object({
  name: singleLine(2, 80, 'Name'),
  email: z.string().trim().max(120).email('Enter a valid email address, like name@example.com.'),
  subject: singleLine(3, 150, 'Subject'),
  message: z
    .string()
    .trim()
    .min(10, 'Message needs at least 10 characters.')
    .max(3000, 'Message must be under 3000 characters.'),
  website: z.string().optional(), // honeypot
});

const LINK_LIMIT = 3;

router.post('/', limiter, async (req, res) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const fields = {};
    for (const issue of parsed.error.issues) fields[issue.path[0]] ??= issue.message;
    return res.status(400).json({ error: 'Some fields need fixing.', fields });
  }

  const data = parsed.data;

  // Spam checks: filled honeypot or link-stuffed message. Pretend success so bots learn nothing.
  const links = (data.message.match(/https?:\/\//gi) || []).length;
  if (data.website || links > LINK_LIMIT) {
    return res.json({ ok: true });
  }

  try {
    await sendContactEmail(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('Contact email failed:', err.message);
    res.status(502).json({ error: 'The email service did not accept the message.' });
  }
});

export default router;
