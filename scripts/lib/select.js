// Weekday theme rotation for the daily post. Deterministic: the same date and
// history always select the same quote. History entries are { date, idx, slug,
// author } with date as a Pacific YYYY-MM-DD.

const WEEKDAYS = [
  { id: 'mortality', tags: ['death', 'time'] }, // Sunday
  { id: 'discipline', tags: ['discipline'] },
  { id: 'perseverance', tags: ['perseverance'] },
  { id: 'mind', tags: ['mind'] },
  { id: 'courage', tags: ['courage'] },
  { id: 'action', tags: ['action'] },
  { id: 'simplicity', tags: ['simplicity', 'nature'] }, // Saturday
];

const QUOTE_GAP_DAYS = 365;
const AUTHOR_GAP_DAYS = 7;
const SHORT_QUOTE = 160;

function themeForDate(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return WEEKDAYS[day];
}

function isSunday(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0;
}

function daysBetween(earlier, later) {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86400000);
}

// FNV-1a over a fixed salt plus the date. Unsigned 32-bit.
function hashDate(date) {
  let hash = 2166136261;
  const text = `axitome:${date}`;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isUnknown(author) {
  const name = String(author || '').trim();
  // "Unknown", "Unknown, The Moviegoer", and attributions explicitly marked
  // unclear are not names we should post.
  if (!name) return true;
  if (/^unknown\b/i.test(name)) return true;
  if (/\bunclear\b/i.test(name)) return true;
  return false;
}

function blockedSets(history, date) {
  const quotes = new Set();
  const slugs = new Set();
  const authors = new Set();
  for (const post of history || []) {
    const days = daysBetween(post.date, date);
    if (days >= 0 && days < QUOTE_GAP_DAYS) {
      if (post.idx != null) quotes.add(post.idx);
      if (post.slug) slugs.add(post.slug);
    }
    if (days > 0 && days < AUTHOR_GAP_DAYS && post.author) authors.add(post.author);
  }
  return { quotes, slugs, authors };
}

function matchesTheme(quote, tags) {
  const own = quote.t || [];
  return own.some((tag) => tags.includes(tag));
}

function preferShort(list) {
  const short = list.filter((quote) => String(quote.q || '').length < SHORT_QUOTE);
  return short.length ? short : list;
}

function candidatePool(items, date, history) {
  const theme = themeForDate(date);
  const blocked = blockedSets(history, date);
  const themed = items.filter((quote) => quote.q && !isUnknown(quote.a) && matchesTheme(quote, theme.tags));
  const fresh = themed.filter((quote) => !blocked.quotes.has(quote.idx) && !(quote.slug && blocked.slugs.has(quote.slug)));
  const freshAuthor = fresh.filter((quote) => !blocked.authors.has(quote.a));
  // Prefer a quote that is new, from a new author, and short. Relax author,
  // then the 365-day gap, only when that pool is empty.
  if (freshAuthor.length) return { theme, pool: preferShort(freshAuthor) };
  if (fresh.length) return { theme, pool: preferShort(fresh) };
  if (themed.length) return { theme, pool: preferShort(themed) };
  return { theme, pool: [] };
}

function pick(items, date, history) {
  const { theme, pool } = candidatePool(items, date, history);
  if (!pool.length) {
    throw new Error(`No eligible quote for ${date} (${theme.id})`);
  }
  const ordered = pool.slice().sort((a, b) => a.idx - b.idx);
  const chosen = ordered[hashDate(date) % ordered.length];
  return { ...chosen, theme: theme.id };
}

module.exports = {
  WEEKDAYS,
  QUOTE_GAP_DAYS,
  AUTHOR_GAP_DAYS,
  SHORT_QUOTE,
  themeForDate,
  isSunday,
  daysBetween,
  hashDate,
  isUnknown,
  candidatePool,
  pick,
};
