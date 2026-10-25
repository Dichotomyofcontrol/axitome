const { SITE, TAG_LABELS } = require('./quotes');

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function clip(text, max) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1).replace(/\s+\S*$/, '').replace(/[,\s;:]+$/g, '');
  return `${cut}\u2026`;
}

function themeLabel(tag) {
  return TAG_LABELS[tag] || tag;
}

function quoteTitle(entry) {
  const theme = entry.t && entry.t[0] ? themeLabel(entry.t[0]).toLowerCase() : '';
  const head = theme ? `${entry.a} on ${theme}` : entry.a;
  const excerpt = entry.q.length <= 110 ? entry.q : clip(entry.q, 110);
  return `${head}: \u201C${excerpt}\u201D | Axitome`;
}

function quoteDescription(entry) {
  const credit = entry.s ? `${entry.a}, ${entry.s}` : entry.a;
  return clip(`\u201C${entry.q}\u201D \u2014 ${credit}`, 160);
}

function creator(name) {
  if (name === 'Delphic maxim') return { '@type': 'Organization', name };
  return { '@type': 'Person', name };
}

function head({ title, description, url, image }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Axitome">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1080">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+SC:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap">
<link rel="stylesheet" href="/page.css">
`;
}

function subscribeForm(nextPath) {
  return `<section class="signup">
  <h2>One line, each morning.</h2>
  <p>Get one quote a day by email.</p>
  <form id="subscribeForm" method="post" action="/api/subscribe">
    <input class="hp" tabindex="-1" autocomplete="off" type="text" name="company" aria-hidden="true">
    <input type="hidden" name="next" value="${esc(nextPath)}">
    <div class="row">
      <input type="email" name="email" required maxlength="320" placeholder="Email address" autocomplete="email" aria-label="Email address">
      <button type="submit">Subscribe</button>
    </div>
    <p class="note" id="subscribeNote" role="status"></p>
  </form>
</section>
<script>
document.getElementById('subscribeForm').addEventListener('submit', function (e) {
  if (!window.fetch) return;
  e.preventDefault();
  var note = document.getElementById('subscribeNote');
  note.textContent = 'One moment.';
  fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email: this.email.value, company: this.company.value, next: this.next.value })
  }).then(function (r) {
    return r.json().then(function (d) { return { ok: r.ok, d: d }; });
  }).then(function (res) {
    note.textContent = res.ok ? 'Saved. One quote, each morning.' : (res.d && res.d.error ? res.d.error : 'Signup is not open yet.');
  }).catch(function () {
    note.textContent = 'Signup is not open yet.';
  });
});
</script>`;
}

// Static pages are built ahead of time, so lines whose day has not come yet
// are hidden in the browser. Day N is Pacific calendar days since 2026-01-01.
const ARRIVED_SCRIPT = `<script>
(function () {
  var p = {};
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
  } catch (e) { var d = new Date(); p = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }; }
  var today = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day) - Date.UTC(2026, 0, 1)) / 864e5);
  var R = ['M',1000,'CM',900,'D',500,'CD',400,'C',100,'XC',90,'L',50,'XL',40,'X',10,'IX',9,'V',5,'IV',4,'I',1];
  function roman(n) { var o = ''; for (var i = 0; i < R.length; i += 2) while (n >= R[i + 1]) { o += R[i]; n -= R[i + 1]; } return o; }
  var lists = document.querySelectorAll('[data-arrived]');
  for (var l = 0; l < lists.length; l++) {
    var list = lists[l], max = +list.getAttribute('data-max') || 999, shown = 0;
    var items = list.querySelectorAll('[data-idx]');
    for (var i = 0; i < items.length; i++) {
      var idx = +items[i].getAttribute('data-idx');
      if (idx > today || shown >= max) { items[i].hidden = true; continue; }
      shown++;
      var d = items[i].querySelector('.day');
      if (d) { var dt = new Date(Date.UTC(2026, 0, 1 + idx)); d.textContent = 'Day ' + (idx + 1) + ' \u00b7 ' + roman(dt.getUTCDate()) + ' \u00b7 ' + roman(dt.getUTCMonth() + 1) + ' \u00b7 ' + roman(dt.getUTCFullYear()); }
    }
    var count = document.querySelector(list.getAttribute('data-count') || '#none');
    if (count) count.textContent = shown + (shown === 1 ? ' line' : ' lines') + ' on the wall so far';
    var sec = list.closest('[data-hide-empty]');
    if (sec && !shown) sec.hidden = true;
  }
})();
</script>`;

function quotePage(entry, related) {
  const url = `${SITE}/q/${entry.slug}`;
  const image = `${SITE}/og/q/${entry.slug}.png`;
  const title = quoteTitle(entry);
  const description = quoteDescription(entry);
  const who = creator(entry.a);
  const quotation = {
    '@context': 'https://schema.org',
    '@type': 'Quotation',
    text: entry.q,
    url,
    inLanguage: 'en',
    creator: who,
    spokenByCharacter: who,
  };
  if (entry.s) quotation.citation = entry.s;
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Axitome', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: entry.a, item: `${SITE}/a/${entry.authorSlug}` },
      { '@type': 'ListItem', position: 3, name: clip(entry.q, 80), item: url },
    ],
  };
  const themes = (entry.t || []).map(themeLabel).join(' · ');
  const relatedHtml = related.length
    ? `<section class="related" data-hide-empty><h2>Related</h2><ul data-arrived data-max="3">${related.map((item) => `<li data-idx="${item.idx}"><a href="/q/${esc(item.slug)}"><p>${esc(item.q)}</p><span>${esc(item.a)}</span></a></li>`).join('')}</ul></section>`
    : '';
  return `${head({ title, description, url, image })}
<script type="application/ld+json">${jsonLd(quotation)}</script>
<script type="application/ld+json">${jsonLd(crumbs)}</script>
</head>
<body>
<header class="top"><a class="brand" href="/"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6 L86 92 H72 L50 36 L28 92 H14 Z" fill="#3A2E26"/><path d="M27 70 L75 50 L78 58 L30 78 Z" fill="#6B1E1E"/></svg>Axitome</a><a class="top-link" href="/">Today</a></header>
<main class="wrap">
  <article>
    <h1 class="quote">${esc(entry.q)}</h1>
    <div class="cut" aria-hidden="true"></div>
    <p class="by"><a href="/a/${esc(entry.authorSlug)}">${esc(entry.a)}</a></p>
    ${entry.s ? `<p class="work">${esc(entry.s)}</p>` : ''}
    ${themes ? `<p class="themes">${esc(themes)}</p>` : ''}
  </article>
  ${relatedHtml}
</main>
<div class="dark">
  ${subscribeForm(`/q/${entry.slug}`)}
</div>
${ARRIVED_SCRIPT}
</body>
</html>
`;
}

function authorPage(name, authorSlug, entries) {
  const url = `${SITE}/a/${authorSlug}`;
  const image = `${SITE}/og/a/${authorSlug}.png`;
  const title = `Quotes by ${name} | Axitome`;
  const description = clip(`${entries.length} quote${entries.length === 1 ? '' : 's'} by ${name}, kept by Axitome.`, 160);
  const list = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: entries.length,
      itemListElement: entries.map((entry, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE}/q/${entry.slug}`,
        name: clip(entry.q, 120),
      })),
    },
  };
  const items = entries.map((entry) => `<li data-idx="${entry.idx}"><a href="/q/${esc(entry.slug)}"><span class="day">Day ${entry.idx + 1}</span><p>${esc(entry.q)}</p></a></li>`).join('');
  return `${head({ title, description, url, image })}
<script type="application/ld+json">${jsonLd(list)}</script>
</head>
<body>
<header class="top"><a class="brand" href="/"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6 L86 92 H72 L50 36 L28 92 H14 Z" fill="#3A2E26"/><path d="M27 70 L75 50 L78 58 L30 78 Z" fill="#6B1E1E"/></svg>Axitome</a><a class="top-link" href="/">Today</a></header>
<main class="wrap">
  <p class="kicker" id="arrivedCount">${entries.length} quote${entries.length === 1 ? '' : 's'}</p>
  <h1 class="quote name">${esc(name)}</h1>
  <div class="cut" aria-hidden="true"></div>
  <ul class="author-list" data-arrived data-count="#arrivedCount">${items}</ul>
</main>
<div class="dark">
  ${subscribeForm(`/a/${authorSlug}`)}
</div>
${ARRIVED_SCRIPT}
</body>
</html>
`;
}

function relatedQuotes(items, entry, limit = 8) {
  const tag = entry.t && entry.t[0];
  const sameAuthor = items.filter((item) => item.idx !== entry.idx && item.a === entry.a);
  const sameTheme = items.filter((item) => item.idx !== entry.idx && item.a !== entry.a && tag && item.t && item.t.includes(tag));
  const picked = [];
  const seen = new Set();
  for (const group of [sameAuthor, sameTheme]) {
    for (const item of group) {
      if (picked.length >= limit) return picked;
      if (seen.has(item.idx)) continue;
      seen.add(item.idx);
      picked.push(item);
    }
  }
  return picked;
}

module.exports = {
  esc,
  quotePage,
  authorPage,
  relatedQuotes,
  quoteTitle,
  quoteDescription,
};
