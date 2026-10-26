const fs = require('fs');
const path = require('path');
const { loadQuotes, catalog, buildTweetText, buildReplyText, isDryRun, shouldPostToday, losAngelesHour } = require('./lib/quotes');
const { pick, themeForDate, daysBetween, isUnknown, isDisputed } = require('./lib/select');
const { roman, renderLedgerCard } = require('./lib/card');

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
check('quote count', quotes.length === 740, String(quotes.length));

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
  ['stop the waves, but you can learn to surf', 'Swami Satchidananda', 'poster caption, quoted in Wherever You Go, There You Are (1994)'],
];
for (const [snippet, author, source] of expected) {
  const hits = quotes.filter((quote) => quote.q.includes(snippet));
  check(`attribution ${author}`, hits.length === 1 && hits[0].a === author && (source == null || hits[0].s === source), hits.map((hit) => hit.a).join(','));
}

const stillUnknown = [
  'Be grateful for what you have.',
  'exceeding trifling witling',
  'Interviews: all about spinning',
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
  if (!text.includes(`\u2014 ${item.a}`)) badText += 1;
  if (item.angle) {
    const kept = text.startsWith(`${item.angle}\n\n\u201C`);
    const dropped = text.startsWith('\u201C');
    if (!kept && !dropped) badText += 1;
  } else if (!text.startsWith('\u201C')) badText += 1;
}
check('tweet text', badText === 0, String(badText));
check('reply link', buildReplyText() === 'One line a day: axitome.com');
const angled = items.filter((item) => item.angle);
check('seeded angles', angled.length === 3 && angled.every((item) => ['Seneca', 'Epictetus', 'Marcus Aurelius'].includes(item.a)));
check('dry run parser', isDryRun({ DRY_RUN: '1' }) && !isDryRun({ DRY_RUN: '' }));
check('roman', roman(484) === 'CDLXXXIV' && roman(2026) === 'MMXXVI' && roman(26) === 'XXVI' && roman(11) === 'XI');

const shortPick = pick([
  { q: 'x'.repeat(180), a: 'A', t: ['discipline'], idx: 1, slug: 'long' },
  { q: 'short quote here', a: 'B', t: ['discipline'], idx: 2, slug: 'short' },
], '2026-10-26', []);
check('prefers short', shortPick.slug === 'short' && shortPick.theme === 'discipline');
const unknownPick = pick([
  { q: 'no', a: 'Unknown', t: ['discipline'], idx: 1, slug: 'u' },
  { q: 'yes', a: 'Seneca', t: ['discipline'], idx: 2, slug: 's' },
], '2026-10-26', []);
check('skips unknown', unknownPick.a === 'Seneca');
check('skips unclear', isUnknown('Unknown, The Moviegoer') && isUnknown('Williamson (context unclear)') && !isUnknown('Seneca'));
const disputedPick = pick([
  { q: 'no', a: 'Seneca', t: ['discipline'], idx: 1, slug: 'd', attribution: 'disputed' },
  { q: 'yes', a: 'Epictetus', t: ['discipline'], idx: 2, slug: 'e' },
], '2026-10-26', []);
check('skips disputed', disputedPick.a === 'Epictetus' && !isDisputed(disputedPick));
for (const snippet of [
  'Engage, inspire and empower.',
  'Learning and helping.',
  'unfair to themself',
  'self-sufficiency which rattles your humility',
]) {
  check(`removed ${snippet.slice(0, 28)}`, !quotes.some((quote) => quote.q.includes(snippet)));
}
const posted = JSON.parse(fs.readFileSync(path.join(root, 'state', 'history.json'), 'utf8'));
const sundayPost = posted.posts.find((post) => post.date === '2026-10-25');
check('sunday recorded', sundayPost && sundayPost.author === 'Dale Carnegie' && sundayPost.idx === 407);
check('monday unposted', !posted.posts.some((post) => post.date === '2026-10-26'));
check('history copy', fs.readFileSync(path.join(root, 'public', 'history.json'), 'utf8') === fs.readFileSync(path.join(root, 'state', 'history.json'), 'utf8'));
const sunday = pick(items, '2026-10-25', posted.posts);
check('sunday eligible', sunday.theme === 'mortality' && !isDisputed(sunday) && !isUnknown(sunday.a) && !/discipline is choosing/i.test(sunday.q));
const authorPick = pick([
  { q: 'seneca line', a: 'Seneca', t: ['discipline'], idx: 2, slug: 's' },
  { q: 'other line', a: 'Epictetus', t: ['discipline'], idx: 3, slug: 'e' },
], '2026-10-26', [{ date: '2026-10-25', idx: 2, author: 'Seneca', slug: 's' }]);
check('author gap', authorPick.a === 'Epictetus');
const quotePick = pick([
  { q: 'seneca line', a: 'Seneca', t: ['discipline'], idx: 2, slug: 's' },
  { q: 'other line', a: 'Epictetus', t: ['discipline'], idx: 3, slug: 'e' },
], '2026-10-26', [{ date: '2026-01-01', idx: 3, author: 'Epictetus', slug: 'e' }]);
check('quote gap', quotePick.a === 'Seneca');

const sim = [];
let selectionFails = 0;
for (let i = 0; i < 40; i += 1) {
  const date = new Date(Date.UTC(2026, 9, 26 + i)).toISOString().slice(0, 10);
  const again = pick(items, date, sim);
  const once = pick(items, date, sim);
  const theme = themeForDate(date);
  if (again.idx !== once.idx) selectionFails += 1;
  if (isUnknown(again.a) || isDisputed(again)) selectionFails += 1;
  if (!again.t.some((tag) => theme.tags.includes(tag))) selectionFails += 1;
  for (const post of sim) {
    const days = daysBetween(post.date, date);
    if (days >= 0 && days < 365 && post.idx === again.idx) selectionFails += 1;
    if (days > 0 && days < 7 && post.author === again.a) selectionFails += 1;
  }
  sim.push({ date, idx: again.idx, author: again.a, slug: again.slug });
}
check('selection rules', selectionFails === 0, String(selectionFails));

function atUtc(iso) {
  return new Date(iso);
}
check('posting window',
  shouldPostToday({ GITHUB_EVENT_NAME: 'schedule' }, atUtc('2026-10-26T13:00:00Z'))
  && losAngelesHour(atUtc('2026-10-26T13:00:00Z')) === 6
  && shouldPostToday({ GITHUB_EVENT_NAME: 'schedule' }, atUtc('2026-10-26T16:30:00Z'))
  && !shouldPostToday({ GITHUB_EVENT_NAME: 'schedule' }, atUtc('2026-10-26T17:00:00Z'))
  && !shouldPostToday({ GITHUB_EVENT_NAME: 'schedule' }, atUtc('2026-10-26T12:30:00Z'))
  && !shouldPostToday({ GITHUB_EVENT_NAME: 'schedule' }, atUtc('2026-10-26T18:30:00Z'))
  && shouldPostToday({ GITHUB_EVENT_NAME: 'workflow_dispatch' }, atUtc('2026-10-26T17:00:00Z'))
  && shouldPostToday({ GITHUB_EVENT_NAME: 'schedule' }, atUtc('2026-11-03T14:00:00Z'))
  && shouldPostToday({ GITHUB_EVENT_NAME: 'schedule' }, atUtc('2026-11-03T17:30:00Z'))
  && !shouldPostToday({ GITHUB_EVENT_NAME: 'schedule' }, atUtc('2026-11-03T13:30:00Z'))
  && !shouldPostToday({ GITHUB_EVENT_NAME: 'schedule' }, atUtc('2026-11-03T18:00:00Z')));

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

(async () => {
  const sampleCard = await renderLedgerCard(sample, { date: '2026-10-26', dark: false });
  const sunday = items.find((item) => item.t.includes('death') && item.q.length < 120);
  const sundayCard = await renderLedgerCard(sunday, { date: '2026-11-01', dark: true });
  const width = sampleCard.readUInt32BE(16);
  const height = sampleCard.readUInt32BE(20);
  const sundayWidth = sundayCard.readUInt32BE(16);
  const sundayHeight = sundayCard.readUInt32BE(20);
  check('ledger png', sampleCard.subarray(0, 4).toString('hex') === '89504e47' && width === 1080 && height === 1350, `${width}x${height}`);
  check('sunday ledger', sundayCard.subarray(0, 4).toString('hex') === '89504e47' && sundayWidth === 1080 && sundayHeight === 1350);
  console.log(failed ? `\n${failed} failed` : '\nAll checks passed');
  console.log(`SAMPLE_SLUG ${sample.slug}`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
