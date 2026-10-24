const fs = require('fs');
const path = require('path');
const { loadQuotes, catalog, buildTweetText, isDryRun } = require('./lib/quotes');

const root = path.join(__dirname, '..');
let failed = 0;
function check(name, ok, detail) {
  if (ok) console.log(`ok  ${name}`);
  else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`);
  }
}

const quotes = loadQuotes();
check('quote count', quotes.length === 744, String(quotes.length));

const expected = [
  ['look in the hearts and minds of others for your happiness', 'Hunter S. Thompson', 'The Proud Highway'],
  ['Do you want to be good, or just seem good?', 'Charles Yu', 'Sorry Please Thank You'],
  ['hard times can be softened, tight squeezes widened', 'Seneca', 'On Tranquility of Mind, 10.4b'],
  ['Learn to love solitude, to be more alone with yourselves', 'Andrei Tarkovsky', 'A Poet in the Cinema (1984)'],
  ['Stoicism is not a matter of gritting your teeth', 'Richard Sorabji', 'Emotion and Peace of Mind'],
  ['Consider why an idea might work, before you consider why it might not', 'Anthony Tjan', 'What the Best Mentors Do'],
  ['Know thyself; nothing in excess.', 'Delphic maxim', 'Temple of Apollo at Delphi'],
  ['we all stumble, everyone of us', 'Emily Kimbrough', null],
  ['Let the man not be corrupted by external things', 'Seneca', 'On the Happy Life'],
];
for (const [snippet, author, source] of expected) {
  const hits = quotes.filter((quote) => quote.q.includes(snippet));
  check(`attribution ${author}`, hits.length === 1 && hits[0].a === author && (source == null || hits[0].s === source), hits.map((hit) => hit.a).join(','));
}

const stillUnknown = [
  'Be grateful for what you have.',
  'exceeding trifling witling',
  'Interviews: all about spinning',
  'stop the waves',
  'fight through some bad days',
  'emotional reaction to everything',
  'There are 3 types of people',
];
for (const snippet of stillUnknown) {
  const hits = quotes.filter((quote) => quote.q.includes(snippet));
  check(`left unknown: ${snippet.slice(0, 32)}`, hits.length === 1 && hits[0].a === 'Unknown');
}

const items = catalog(quotes);
const slugs = new Set(items.map((item) => item.slug));
const authorSlugs = new Set(items.map((item) => item.authorSlug));
check('unique quote slugs', slugs.size === items.length, String(slugs.size));

let badText = 0;
for (const item of items) {
  const text = buildTweetText(item);
  if (text.length > 280 || /axitome\.com|https?:\/\//i.test(text)) badText += 1;
  if (!text.startsWith('\u201C') || !text.includes(`\u2014 ${item.a}`)) badText += 1;
}
check('tweet text', badText === 0, String(badText));
check('dry run parser', isDryRun({ DRY_RUN: '1' }) && !isDryRun({ DRY_RUN: '' }));

const sitemap = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8');
const locs = sitemap.match(/<loc>/g) || [];
check('sitemap count', locs.length === 1 + items.length + authorSlugs.size, `${locs.length} vs ${1 + items.length + authorSlugs.size}`);

const robots = fs.readFileSync(path.join(root, 'public', 'robots.txt'), 'utf8');
check('robots sitemap', robots.includes('Sitemap: https://www.axitome.com/sitemap.xml') && robots.includes('Allow: /'));

const sample = items.find((item) => item.s === 'On Tranquility of Mind, 10.4b');
const sampleHtml = fs.readFileSync(path.join(root, 'public', 'q', sample.slug, 'index.html'), 'utf8');
check('sample title', sampleHtml.includes('<title>') && sampleHtml.includes('Seneca'));
check('sample canonical', sampleHtml.includes(`<link rel="canonical" href="https://www.axitome.com/q/${sample.slug}">`));
check('sample schema', sampleHtml.includes('"@type":"Quotation"') && sampleHtml.includes('On Tranquility of Mind, 10.4b'));
check('sample og', sampleHtml.includes(`https://www.axitome.com/og/q/${sample.slug}.png`));
const sampleCard = fs.readFileSync(path.join(root, 'public', 'og', 'q', `${sample.slug}.png`));
check('sample og file', sampleCard.subarray(0, 4).toString('hex') === '89504e47');
const authorCard = fs.readFileSync(path.join(root, 'public', 'og', 'a', `${sample.authorSlug}.png`));
check('author og file', authorCard.subarray(0, 4).toString('hex') === '89504e47');
check('sample twitter', sampleHtml.includes('summary_large_image'));
check('no reflection filler', !/reflection|what this means/i.test(sampleHtml));

const authorHtml = fs.readFileSync(path.join(root, 'public', 'a', sample.authorSlug, 'index.html'), 'utf8');
check('author page', authorHtml.includes('Quotes by Seneca') && authorHtml.includes(`/q/${sample.slug}`) && authorHtml.includes(`https://www.axitome.com/og/a/${sample.authorSlug}.png`));

const home = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
check('home signup', home.includes('Get one quote a day by email') && home.includes('/api/subscribe'));
check('home quote link', home.includes('quotePageLink') && home.includes('slugs.json'));

console.log(failed ? `\n${failed} failed` : '\nAll checks passed');
console.log(`SAMPLE_SLUG ${sample.slug}`);
process.exit(failed ? 1 : 0);
