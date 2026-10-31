const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SITE, loadQuotes, catalog } = require('./lib/quotes');
const { quotePage, authorPage, relatedQuotes } = require('./lib/html');
const { renderLedgerQuoteCard, renderLedgerAuthorCard, renderLedgerHomeCard } = require('./lib/ledger-card');

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
    `${SITE}/born/`,
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

  const ogQuoteDir = path.join(publicDir, 'og', 'q');
  const ogAuthorDir = path.join(publicDir, 'og', 'a');
  resetDir(path.join(publicDir, 'og'));
  fs.mkdirSync(ogQuoteDir, { recursive: true });
  fs.mkdirSync(ogAuthorDir, { recursive: true });
  for (const item of items) {
    fs.writeFileSync(path.join(ogQuoteDir, `${item.slug}.png`), renderLedgerQuoteCard(item));
  }
  for (const [authorSlug, entries] of byAuthor) {
    fs.writeFileSync(
      path.join(ogAuthorDir, `${authorSlug}.png`),
      renderLedgerAuthorCard(entries[0].a, entries.length)
    );
  }
  fs.writeFileSync(path.join(publicDir, 'og', 'home.png'), renderLedgerHomeCard());
  fs.writeFileSync(path.join(publicDir, 'og', 'born.png'), renderLedgerHomeCard('SEE THE LINE CARVED ON YOUR DAY.', 'Pick a month and day.'));
  compressPngs([
    path.join(publicDir, 'og', 'home.png'),
    path.join(publicDir, 'og', 'born.png'),
    ...items.map((item) => path.join(ogQuoteDir, `${item.slug}.png`)),
    ...[...byAuthor.keys()].map((authorSlug) => path.join(ogAuthorDir, `${authorSlug}.png`)),
  ]);

  console.log(`Built ${items.length} quote pages, ${byAuthor.size} author pages, ${urls.length} sitemap URLs, ${items.length + byAuthor.size} share cards.`);
}

function compressPngs(files) {
  const probe = spawnSync('pngquant', ['--version'], { stdio: 'ignore' });
  if (probe.status !== 0) {
    console.log('pngquant not installed; share cards left uncompressed.');
    return;
  }
  const result = spawnSync('xargs', ['-P', '4', '-n', '1', 'pngquant', '--quality=60-90', '--nofs', '--skip-if-larger', '--force', '--ext', '.png'], {
    input: `${files.join('\n')}\n`,
  });
  if (result.status !== 0) {
    throw new Error(`pngquant failed: ${result.stderr ? result.stderr.toString() : result.status}`);
  }
}

main();
