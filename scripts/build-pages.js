const fs = require('fs');
const path = require('path');
const { SITE, loadQuotes, catalog } = require('./lib/quotes');
const { quotePage, authorPage, relatedQuotes } = require('./lib/html');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const quotes = loadQuotes();
  const items = catalog(quotes);
  const quoteDir = path.join(publicDir, 'q');
  const authorDir = path.join(publicDir, 'a');
  resetDir(quoteDir);
  resetDir(authorDir);

  const byAuthor = new Map();
  for (const item of items) {
    if (!byAuthor.has(item.authorSlug)) byAuthor.set(item.authorSlug, []);
    byAuthor.get(item.authorSlug).push(item);
  }

  for (const item of items) {
    const dir = path.join(quoteDir, item.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), quotePage(item, relatedQuotes(items, item)));
  }

  for (const [authorSlug, entries] of byAuthor) {
    const dir = path.join(authorDir, authorSlug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), authorPage(entries[0].a, authorSlug, entries));
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `${SITE}/`,
    ...items.map((item) => `${SITE}/q/${item.slug}`),
    ...[...byAuthor.keys()].map((authorSlug) => `${SITE}/a/${authorSlug}`),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((loc) => `  <url><loc>${loc}</loc><lastmod>${today}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), body);
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin.html',
    'Disallow: /api/admin',
    '',
    `Sitemap: ${SITE}/sitemap.xml`,
    '',
  ].join('\n'));
  fs.writeFileSync(
    path.join(publicDir, 'slugs.json'),
    JSON.stringify(items.map((item) => ({ slug: item.slug, authorSlug: item.authorSlug })))
  );

  console.log(`Built ${items.length} quote pages, ${byAuthor.size} author pages, ${urls.length} sitemap URLs.`);
}

main();
