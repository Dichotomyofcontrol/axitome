const fs = require('fs');
const path = require('path');

const SITE = 'https://www.axitome.com';

const TAG_LABELS = {
  action: 'Action',
  character: 'Character',
  courage: 'Courage',
  creativity: 'Creativity',
  death: 'Death & Mortality',
  discipline: 'Discipline',
  freedom: 'Freedom',
  growth: 'Growth',
  happiness: 'Happiness',
  leadership: 'Leadership',
  loss: 'Loss',
  love: 'Love',
  mind: 'Mind & Thought',
  nature: 'Nature',
  perseverance: 'Perseverance',
  purpose: 'Purpose',
  simplicity: 'Simplicity',
  solitude: 'Solitude',
  time: 'Time',
  wisdom: 'Wisdom',
};

function quotesPath() {
  return path.join(__dirname, '..', '..', 'public', 'quotes.json');
}

function loadQuotes() {
  return JSON.parse(fs.readFileSync(quotesPath(), 'utf8'));
}

function slugify(input) {
  const s = String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'quote';
}

function uniqueSlug(base, used) {
  let slug = base.slice(0, 80).replace(/-+$/g, '') || 'quote';
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  let n = 2;
  while (used.has(`${slug}-${n}`)) n += 1;
  const next = `${slug}-${n}`;
  used.add(next);
  return next;
}

function catalog(quotes) {
  const authorUsed = new Set();
  const authorSlugByName = new Map();
  for (const quote of quotes) {
    if (!authorSlugByName.has(quote.a)) {
      authorSlugByName.set(quote.a, uniqueSlug(slugify(quote.a), authorUsed));
    }
  }
  const quoteUsed = new Set();
  return quotes.map((quote, idx) => {
    const authorSlug = authorSlugByName.get(quote.a);
    const quoteBit = slugify(quote.q).slice(0, 48).replace(/-+$/g, '');
    const slug = uniqueSlug(`${authorSlug}-${quoteBit}`, quoteUsed);
    return { ...quote, idx, slug, authorSlug };
  });
}

function losAngelesParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = {};
  for (const part of fmt.formatToParts(now)) parts[part.type] = part.value;
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour,
    minute: Number(parts.minute),
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function losAngelesHour(now) {
  return losAngelesParts(now).hour;
}

// Same day index the daily post has always used: Pacific calendar day
// since 2026-01-01, modulo the quote count. Do not "fix" the timezone
// parse; GitHub runners are UTC and this keeps the sequence stable.
function dayIndex(quotes, now = new Date()) {
  const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  pacific.setHours(0, 0, 0, 0);
  const epoch = new Date(2026, 0, 1);
  const n = Math.floor((pacific - epoch) / 86400000);
  const len = quotes.length || 1;
  return ((n % len) + len) % len;
}

function buildTweetText(quote) {
  const credit = `\n\u2014 ${quote.a}${quote.s ? `, ${quote.s}` : ''}`;
  const body = `\u201C${quote.q}\u201D${credit}`;
  const full = quote.angle ? `${quote.angle}\n\n${body}` : body;
  if (full.length <= 280) return full;
  // Over 280: drop the angle first, then fall back to truncating the quote.
  if (quote.angle) return buildTweetText({ q: quote.q, a: quote.a, s: quote.s });

  const ellipsis = '\u2026';
  let room = 280 - (1 + ellipsis.length + 1 + credit.length);
  if (room < 24 && quote.s) {
    return buildTweetText({ q: quote.q, a: quote.a });
  }
  if (room < 8) room = 8;
  let cut = quote.q.slice(0, room).trim();
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > 16) cut = cut.slice(0, lastSpace);
  cut = cut.replace(/[,\s;:—-]+$/g, '');
  const text = `\u201C${cut}${ellipsis}\u201D${credit}`;
  return text.length <= 280 ? text : text.slice(0, 279) + ellipsis;
}

function buildReplyText() {
  return 'One line a day: axitome.com';
}

function isDryRun(env = process.env) {
  const value = String(env.DRY_RUN || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function shouldPostToday(env = process.env, now = new Date()) {
  // The once-per-day check lives in la-hour.js; here only enforce the window.
  const hour = losAngelesHour(now);
  if (env.GITHUB_EVENT_NAME === 'schedule' && (hour < 6 || hour > 9)) return false;
  return true;
}

module.exports = {
  SITE,
  TAG_LABELS,
  quotesPath,
  loadQuotes,
  slugify,
  catalog,
  losAngelesParts,
  losAngelesHour,
  dayIndex,
  buildTweetText,
  buildReplyText,
  isDryRun,
  shouldPostToday,
};
