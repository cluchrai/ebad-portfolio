import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { answerQuestion } from '../lib/rag.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many questions in a minute. Wait a moment and ask again.' },
});

const schema = z.object({
  question: z.string().trim().min(2, 'Ask a question first.').max(500, 'Keep the question under 500 characters.'),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) }))
    .max(10)
    .optional(),
});

router.post('/', limiter, async (req, res) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  try {
    const result = await answerQuestion(parsed.data.question, parsed.data.history);
    res.json(result);
  } catch (err) {
    console.error('Chat failed:', err.message);
    res.status(502).json({ error: 'The assistant could not reach its AI service.' });
  }
});

export default router;
