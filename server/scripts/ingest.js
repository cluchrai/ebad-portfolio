// Reads server/knowledge/*.md, splits them into chunks and uploads them to Upstash Vector.
// Upstash creates the embeddings with the index's built-in model.
// Run again whenever you edit the knowledge files:  npm run ingest

import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Index } from '@upstash/vector';
import { chunkMarkdown } from '../src/lib/chunker.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'knowledge');

async function main() {
  const { UPSTASH_VECTOR_REST_URL: url, UPSTASH_VECTOR_REST_TOKEN: token } = process.env;
  if (!url || !token) throw new Error('Set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN in server/.env first.');
  const index = new Index({ url, token });

  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  const chunks = [];
  for (const f of files) {
    const md = await readFile(path.join(dir, f), 'utf8');
    chunks.push(...chunkMarkdown(md, f));
  }
  console.log(`Read ${files.length} files → ${chunks.length} chunks`);

  await index.reset(); // start clean so edited or deleted text doesn't linger
  for (let i = 0; i < chunks.length; i += 50) {
    const batch = chunks.slice(i, i + 50).map((c) => ({ id: c.id, data: c.text, metadata: c.metadata }));
    await index.upsert(batch);
    console.log(`Uploaded ${Math.min(i + 50, chunks.length)} / ${chunks.length}`);
  }
  console.log('Done. The chatbot now uses the updated knowledge.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
