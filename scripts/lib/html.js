const { SITE, TAG_LABELS } = require('./quotes');
const { tierOf, linesOf } = require('../../public/breaks');
const { citationLine, statusWord } = require('../../public/cite');

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
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Axitome">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(title)}">
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

function quotePage(entry, related) {
  const url = `${SITE}/q/${entry.slug}`;
  const image = `${SITE}/og/q/${entry.slug}.png`;
  const title = quoteTitle(entry);
  const description = quoteDescription(entry);
  const who = creator(entry.a);
  const cite = citationLine(entry);
  const word = statusWord(entry);
  const quotation = {
    '@context': 'https://schema.org',
    '@type': 'Quotation',
    text: entry.q,
    url,
    inLanguage: 'en',
  };
  if (entry.status === 'verified') {
    quotation.creator = who;
    quotation.spokenByCharacter = who;
  } else if (word) {
    quotation.creditText = `${word}: ${entry.a}`;
  }
  if (entry.s) quotation.citation = entry.s;
  else if (cite) quotation.citation = cite;
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Axitome', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: entry.a, item: `${SITE}/a/${entry.authorSlug}` },
      { '@type': 'ListItem', position: 3, name: clip(entry.q, 80), item: url },
    ],
  };
    const tier = tierOf(entry.q);
  const lines = linesOf(entry.q, tier).map((line) => `<span class="line">${esc(line)}</span>`).join('');
  const citeHtml = cite
    ? `<p class="work">${(entry.sourceUrl || entry.url) ? `<a href="${esc(entry.sourceUrl || entry.url)}">${esc(cite)}</a>` : esc(cite)}</p>`
    : '';
  const relatedHtml = related.length
    ? `<section class="related"><h2>${esc(relatedHeading(entry, related))}</h2><ul>${related.map((item) => `<li><a href="/q/${esc(item.slug)}"><p>${esc(item.q)}</p><span>${esc(item.a)}</span></a></li>`).join('')}</ul></section>`
    : '';
  return `${head({ title, description, url, image })}
<script type="application/ld+json">${jsonLd(quotation)}</script>
<script type="application/ld+json">${jsonLd(crumbs)}</script>
</head>
<body>
<header class="top"><a class="brand" href="/"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6 L86 92 H72 L50 36 L28 92 H14 Z" fill="#3A2E26"/><path d="M27 70 L75 50 L78 58 L30 78 Z" fill="#6B1E1E"/></svg>Axitome</a><a class="top-link" href="/">Today</a></header>
<main class="wrap">
  <article>
    <h1 class="quote ${tier}" aria-label="${esc(entry.q)}">${lines}</h1>
    <div class="cut" aria-hidden="true"></div>
    <p class="by"><a href="/a/${esc(entry.authorSlug)}">${esc(entry.a)}</a>${word ? `<span class="mark">${esc(word)}</span>` : ''}</p>
    ${citeHtml}
  </article>
  ${relatedHtml}
</main>
<div class="quiet">
  ${subscribeForm(`/q/${entry.slug}`)}
</div>
</body>
</html>
`;
}

// Author and quote pages list the catalog. The daily line is not "quote N on
// day N" anymore: the homepage and the X post share public/select.js. Hiding
// rows whose catalog index is still in the future would drop lines already posted.
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
  const items = entries.map((entry) => `<li><a href="/q/${esc(entry.slug)}"><p>${esc(entry.q)}</p></a></li>`).join('');
  return `${head({ title, description, url, image })}
<script type="application/ld+json">${jsonLd(list)}</script>
</head>
<body>
<header class="top"><a class="brand" href="/"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 6 L86 92 H72 L50 36 L28 92 H14 Z" fill="#3A2E26"/><path d="M27 70 L75 50 L78 58 L30 78 Z" fill="#6B1E1E"/></svg>Axitome</a><a class="top-link" href="/">Today</a></header>
<main class="wrap">
  <p class="kicker">${entries.length} quote${entries.length === 1 ? '' : 's'}</p>
  <h1 class="quote name">${esc(name)}</h1>
  <div class="cut" aria-hidden="true"></div>
  <ul class="author-list">${items}</ul>
</main>
<div class="dark">
  ${subscribeForm(`/a/${authorSlug}`)}
</div>
</body>
</html>
`;
}

// Related by theme first: most shared tags, other authors preferred, a stable
// per-quote shuffle so neighbours vary. Same author only fills what themes cannot.
function relatedQuotes(items, entry, limit = 3) {
  const tags = entry.t || [];
  const seed = (item) => {
    let h = 2166136261;
    for (const ch of `${entry.slug}|${item.slug}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  };
  const scored = [];
  if (tags.length) {
    for (const item of items) {
      if (item.idx === entry.idx || !item.t) continue;
      const shared = item.t.filter((t) => tags.includes(t)).length;
      if (!shared) continue;
      const lead = item.t.includes(tags[0]) ? 1 : 0;
      scored.push({ item, score: shared * 2 + lead - (item.a === entry.a ? 3 : 0), h: seed(item) });
    }
    scored.sort((x, y) => y.score - x.score || x.h - y.h);
  }
  const picked = [];
  const authors = new Set();
  for (const { item } of scored) {
    if (picked.length >= limit) break;
    if (authors.has(item.a)) continue;
    authors.add(item.a);
    picked.push(item);
  }
  if (picked.length < limit) {
    for (const item of items) {
      if (picked.length >= limit) break;
      if (item.idx !== entry.idx && item.a === entry.a && !picked.includes(item)) picked.push(item);
    }
  }
  return picked;
}

function relatedHeading(entry, related) {
  const tag = entry.t && entry.t[0];
  if (tag && related.some((item) => item.t && item.t.includes(tag))) return `More on ${themeLabel(tag).toLowerCase()}`;
  return `More from ${entry.a}`;
}

module.exports = {
  esc,
  quotePage,
  authorPage,
  relatedQuotes,
  quoteTitle,
  quoteDescription,
};
