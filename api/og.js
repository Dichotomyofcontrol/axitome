import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let cached = null;
function items() {
  if (!cached) {
    const { loadQuotes, catalog } = require('../scripts/lib/quotes.js');
    cached = catalog(loadQuotes());
  }
  return cached;
}

function cards() {
  return require('../scripts/lib/card.js');
}

function param(req, name) {
  if (req.query && req.query[name]) return String(req.query[name]);
  try {
    const url = new URL(req.url, 'https://www.axitome.com');
    return url.searchParams.get(name) || '';
  } catch {
    return '';
  }
}

export default function handler(req, res) {
  try {
    const slug = param(req, 'slug').trim();
    const author = param(req, 'author').trim();
    const all = items();
    let png;
    if (slug) {
      const quote = all.find((item) => item.slug === slug);
      if (!quote) return res.status(404).json({ error: 'Not found' });
      png = cards().renderQuoteCard(quote, 'square');
    } else if (author) {
      const group = all.filter((item) => item.authorSlug === author);
      if (!group.length) return res.status(404).json({ error: 'Not found' });
      png = cards().renderAuthorCard(group[0].a, group.length);
    } else {
      return res.status(400).json({ error: 'Missing slug or author' });
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.status(200).send(png);
  } catch (err) {
    console.error('OG card failed:', err);
    res.status(500).json({ error: 'Card failed', detail: String(err && err.message ? err.message : err).slice(0, 400) });
  }
}
