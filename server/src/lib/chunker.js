// Splits a markdown knowledge file into searchable chunks.
// Front matter (between --- lines) sets the file title and the portfolio section it links to.
//
// ---
// title: Projects
// anchor: projects
// ---
// ## Tiny Village
// text...

const MAX_CHARS = 900;

function parseFrontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: md };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: md.slice(m[0].length) };
}

function splitLong(text) {
  if (text.length <= MAX_CHARS) return [text];
  const parts = [];
  let current = '';
  for (const para of text.split(/\n{2,}/)) {
    if ((current + '\n\n' + para).length > MAX_CHARS && current) {
      parts.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export function chunkMarkdown(md, fileName) {
  const { meta, body } = parseFrontMatter(md);
  const title = meta.title || fileName.replace(/\.md$/, '');
  const anchor = meta.anchor || 'top';
  const sections = body.split(/^## /m).filter((s) => s.trim());
  const chunks = [];

  sections.forEach((section, si) => {
    const [headingLine, ...rest] = section.split('\n');
    const heading = headingLine.replace(/^#+\s*/, '').trim();
    const content = rest.join('\n').trim();
    splitLong(content || heading).forEach((piece, pi) => {
      // Prefix with titles so each chunk carries its own context into the embedding
      const text = `${title} — ${heading}\n${piece}`;
      chunks.push({
        id: `${fileName.replace(/\.md$/, '')}-${si}-${pi}`,
        text,
        metadata: { source: fileName, title, heading, anchor, text },
      });
    });
  });

  return chunks;
}
