// Weekday theme rotation for the daily post. Deterministic: the same date and
// history always select the same quote. History entries are { date, idx, slug,
// author } with date as a Pacific YYYY-MM-DD.
// Loaded by the site as /select.js and by Node from scripts/lib/select.js.

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AxitomeSelect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var WEEKDAYS = [
    { id: 'mortality', tags: ['death', 'time'] }, // Sunday
    { id: 'discipline', tags: ['discipline'] },
    { id: 'perseverance', tags: ['perseverance'] },
    { id: 'mind', tags: ['mind'] },
    { id: 'courage', tags: ['courage'] },
    { id: 'action', tags: ['action'] },
    { id: 'simplicity', tags: ['simplicity', 'nature'] }, // Saturday
  ];

  var QUOTE_GAP_DAYS = 365;
  var AUTHOR_GAP_DAYS = 7;
  var SHORT_QUOTE = 160;

  function themeForDate(date) {
    var day = new Date(date + 'T12:00:00Z').getUTCDay();
    return WEEKDAYS[day];
  }

  function isSunday(date) {
    return new Date(date + 'T12:00:00Z').getUTCDay() === 0;
  }

  function daysBetween(earlier, later) {
    var a = Date.parse(earlier + 'T00:00:00Z');
    var b = Date.parse(later + 'T00:00:00Z');
    if (isNaN(a) || isNaN(b)) return Infinity;
    return Math.round((b - a) / 86400000);
  }

  function hashDate(date) {
    var hash = 2166136261;
    var text = 'axitome:' + date;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function isUnknown(author) {
    var name = String(author || '').trim();
    if (!name) return true;
    if (/^unknown\b/i.test(name)) return true;
    if (/\bunclear\b/i.test(name)) return true;
    return false;
  }

  function isDisputed(quote) {
    return String((quote && quote.attribution) || '').toLowerCase() === 'disputed';
  }

  function blockedSets(history, date) {
    var quotes = new Set();
    var slugs = new Set();
    var authors = new Set();
    var posts = history || [];
    for (var i = 0; i < posts.length; i += 1) {
      var post = posts[i];
      var days = daysBetween(post.date, date);
      if (days >= 0 && days < QUOTE_GAP_DAYS) {
        if (post.idx != null) quotes.add(post.idx);
        if (post.slug) slugs.add(post.slug);
      }
      if (days > 0 && days < AUTHOR_GAP_DAYS && post.author) authors.add(post.author);
    }
    return { quotes: quotes, slugs: slugs, authors: authors };
  }

  function matchesTheme(quote, tags) {
    var own = quote.t || [];
    return own.some(function (tag) { return tags.indexOf(tag) !== -1; });
  }

  function preferShort(list) {
    var short = list.filter(function (quote) { return String(quote.q || '').length < SHORT_QUOTE; });
    return short.length ? short : list;
  }

  function eligible(quote) {
    return !!(quote && quote.q && !isUnknown(quote.a) && !isDisputed(quote));
  }

  function candidatePool(items, date, history) {
    var theme = themeForDate(date);
    var blocked = blockedSets(history, date);
    var themed = items.filter(function (quote) {
      return eligible(quote) && matchesTheme(quote, theme.tags);
    });
    var fresh = themed.filter(function (quote) {
      return !blocked.quotes.has(quote.idx) && !(quote.slug && blocked.slugs.has(quote.slug));
    });
    var freshAuthor = fresh.filter(function (quote) { return !blocked.authors.has(quote.a); });
    if (freshAuthor.length) return { theme: theme, pool: preferShort(freshAuthor) };
    if (fresh.length) return { theme: theme, pool: preferShort(fresh) };
    if (themed.length) return { theme: theme, pool: preferShort(themed) };
    return { theme: theme, pool: [] };
  }

  function pick(items, date, history) {
    var found = candidatePool(items, date, history);
    if (!found.pool.length) {
      throw new Error('No eligible quote for ' + date + ' (' + found.theme.id + ')');
    }
    var ordered = found.pool.slice().sort(function (a, b) { return a.idx - b.idx; });
    var chosen = ordered[hashDate(date) % ordered.length];
    var copy = {};
    var key;
    for (key in chosen) {
      if (Object.prototype.hasOwnProperty.call(chosen, key)) copy[key] = chosen[key];
    }
    copy.theme = found.theme.id;
    return copy;
  }

  return {
    WEEKDAYS: WEEKDAYS,
    QUOTE_GAP_DAYS: QUOTE_GAP_DAYS,
    AUTHOR_GAP_DAYS: AUTHOR_GAP_DAYS,
    SHORT_QUOTE: SHORT_QUOTE,
    themeForDate: themeForDate,
    isSunday: isSunday,
    daysBetween: daysBetween,
    hashDate: hashDate,
    isUnknown: isUnknown,
    isDisputed: isDisputed,
    eligible: eligible,
    candidatePool: candidatePool,
    pick: pick,
  };
});
