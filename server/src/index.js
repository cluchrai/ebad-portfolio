import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import contactRouter from './routes/contact.js';
import chatRouter from './routes/chat.js';

const app = express();
const PORT = process.env.PORT || 5000;
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.set('trust proxy', 1); // correct client IPs behind Render/Vercel proxies (rate limiting)
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || origins.includes(origin)) return cb(null, true);
      cb(new Error('Origin not allowed'));
    },
  })
);
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/contact', contactRouter);
app.use('/api/chat', chatRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
  if (err.message === 'Origin not allowed') return res.status(403).json({ error: 'This site is not allowed to call the API.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
