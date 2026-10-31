// Ledger style link-preview cards (1200x630), see IDENTITY.md.
// Kept separate from card.js so the daily post image is not changed here.
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const W = 1200;
const H = 630;
const C = { trav: '#E9E2D3', chisel: '#3A2E26', dim: 'rgba(58,46,38,0.62)', ox: '#6B1E1E', shadow: '#A79E8C' };
let ready = false;
let stone = null;

function fonts() {
  if (ready) return;
  const dir = path.join(__dirname, '..', '..', 'assets', 'fonts');
  GlobalFonts.registerFromPath(path.join(dir, 'CormorantSC-SemiBold.ttf'), 'Ledger SC');
  GlobalFonts.registerFromPath(path.join(dir, 'CormorantSC-Bold.ttf'), 'Ledger SC Bold');
  // Same variable font the daily card registers as CormorantGaramond[wght].ttf.
  GlobalFonts.registerFromPath(path.join(dir, 'CormorantGaramond[wght].ttf'), 'Ledger Text');
  ready = true;
}

function roman(n) {
  const R = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let o = '';
  for (const [v, s] of R) while (n >= v) { o += s; n -= v; }
  return o;
}

// Homepage day count: Pacific calendar days since 2026-01-01, plus one.
// A missing or unposted date returns null so the card does not invent a day.
function quoteCardMarks(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return null;
  const [year, month, day] = date.split('-').map(Number);
  const n = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(2026, 0, 1)) / 86400000);
  if (!Number.isFinite(n) || n < 0) return null;
  return {
    day: `DAY ${n + 1}`,
    date: `${roman(day)} \u00b7 ${roman(month)} \u00b7 ${roman(year)}`,
  };
}

// History posts win by slug, then by catalog index when the author still matches.
// extras cover a day the homepage shows before it is written into history.
function shareDates(items, posts, extras = []) {
  const dates = new Map();
  function assign(item, date) {
    if (!item || !quoteCardMarks(date)) return;
    const prev = dates.get(item.idx);
    if (!prev || prev < date) dates.set(item.idx, date);
  }
  for (const post of posts || []) {
    let item = null;
    if (post.slug) item = items.find((entry) => entry.slug === post.slug);
    if (!item && Number.isInteger(post.idx) && items[post.idx] && (!post.author || items[post.idx].a === post.author)) {
      item = items[post.idx];
    }
    assign(item, post.date);
  }
  for (const extra of extras) assign(extra.item, extra.date);
  return dates;
}

// Deterministic stone texture, painted once and reused.
function stoneLayer() {
  if (stone) return stone;
  const c = createCanvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = C.trav;
  x.fillRect(0, 0, W, H);
  let s = 1234567;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  // soft clouding: a few broad, low contrast blotches (compresses well)
  for (let i = 0; i < 0; i += 1) {
    const cx = rnd() * W, cy = rnd() * H, r = 120 + rnd() * 260;
    const g0 = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const dark = rnd() < 0.5;
    g0.addColorStop(0, dark ? 'rgba(167,158,140,0.16)' : 'rgba(244,239,230,0.22)');
    g0.addColorStop(1, 'rgba(233,226,211,0)');
    x.fillStyle = g0; x.fillRect(0, 0, W, H);
  }
  // sparse pits in the stone
  for (let i = 0; i < 1400; i += 1) {
    x.fillStyle = rnd() < 0.7 ? 'rgba(120,108,92,0.28)' : 'rgba(255,255,255,0.35)';
    const r = 0.6 + rnd() * 1.4;
    x.beginPath(); x.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2); x.fill();
  }
  // faint veins
  x.strokeStyle = 'rgba(167,158,140,0.22)';
  x.lineWidth = 1;
  for (let v = 0; v < 6; v += 1) {
    x.beginPath();
    let px = rnd() * W; let py = 0;
    x.moveTo(px, py);
    while (py < H) { px += (rnd() - 0.5) * 60; py += 30 + rnd() * 40; x.lineTo(px, py); }
    x.stroke();
  }
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(58,46,38,0.10)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  stone = c;
  return c;
}

function mark(ctx, x, y, size) {
  const k = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = C.chisel;
  ctx.beginPath(); ctx.moveTo(50, 6); ctx.lineTo(86, 92); ctx.lineTo(72, 92); ctx.lineTo(50, 36); ctx.lineTo(28, 92); ctx.lineTo(14, 92); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.ox;
  ctx.beginPath(); ctx.moveTo(27, 70); ctx.lineTo(75, 50); ctx.lineTo(78, 58); ctx.lineTo(30, 78); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function spaced(ctx, text, x, y, tracking, align = 'left') {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let cx = align === 'right' ? x - total : x;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + tracking; });
  return total;
}

function carved(ctx, text, x, y) {
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(text, x, y + 1.5);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillText(text, x, y - 1.5);
  ctx.fillStyle = C.chisel;
  ctx.fillText(text, x, y);
}

function wrap(ctx, text, max) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = []; let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function frame(ctx, rightLabel) {
  ctx.drawImage(stoneLayer(), 0, 0);
  mark(ctx, 64, 44, 46);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.chisel;
  ctx.font = '22px "Ledger SC Bold"';
  spaced(ctx, 'AXITOME', 122, 77, 6);
  ctx.fillStyle = C.dim;
  ctx.font = '22px "Ledger SC"';
  if (rightLabel) spaced(ctx, rightLabel, W - 64, 77, 3, 'right');
}

function fit(ctx, text, family, sizes, max, maxLines, weight) {
  const wt = weight ? `${weight} ` : '';
  for (const size of sizes) {
    ctx.font = `${wt}${size}px ${family}`;
    const lines = wrap(ctx, text, max);
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  ctx.font = `${wt}${size}px ${family}`;
  let lines = wrap(ctx, text, max);
  lines = lines.slice(0, maxLines);
  lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,;:.]*\S*$/, '') + '\u2026';
  return { size, lines };
}

function renderLedgerQuoteCard(entry, date) {
  fonts();
  const marks = quoteCardMarks(date);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  frame(ctx, marks ? marks.day : '');
  const X = 64; const MAX = W - 128;
  const short = entry.q.length <= 70;
  let block;
  if (short) {
    block = fit(ctx, entry.q.toUpperCase(), '"Ledger SC"', [76, 68, 60, 54], MAX, 3);
  } else {
    block = fit(ctx, entry.q, '"Ledger Text"', [58, 52, 46, 42], MAX, 4, 600);
  }
  const lh = Math.round(block.size * (short ? 1.08 : 1.18));
  const total = block.lines.length * lh;
  const top = 130; const bottom = 470;
  let y = top + Math.max(0, (bottom - top - total) / 2) + block.size * 0.8;
  ctx.textAlign = 'left';
  for (const line of block.lines) { carved(ctx, line, X, y); y += lh; }
  const cutY = Math.min(y - lh + block.size * 0.45 + 22, 500);
  const grad = ctx.createLinearGradient(X, 0, X + 300, 0);
  grad.addColorStop(0, '#4d1414'); grad.addColorStop(0.5, C.ox); grad.addColorStop(1, '#8a2a24');
  ctx.fillStyle = grad;
  ctx.fillRect(X, cutY, 300, 5);
  ctx.fillStyle = C.chisel;
  ctx.font = '26px "Ledger SC Bold"';
  spaced(ctx, entry.a.toUpperCase(), X, cutY + 50, 5);
  ctx.fillStyle = C.dim;
  ctx.font = '22px "Ledger SC"';
  if (marks) spaced(ctx, marks.date, W - 64, H - 46, 3, 'right');
  spaced(ctx, 'One line. Nothing to buy.', X, H - 46, 2);
  return canvas.toBuffer('image/png');
}

function renderLedgerAuthorCard(name, count) {
  fonts();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  frame(ctx, 'THE WALL');
  const block = fit(ctx, name.toUpperCase(), '"Ledger SC"', [120, 100, 84, 70, 58], W - 128, 2);
  const lh = block.size * 1.02;
  let y = 330 - ((block.lines.length - 1) * lh) / 2;
  for (const line of block.lines) { carved(ctx, line, 64, y); y += lh; }
  ctx.fillStyle = C.ox;
  ctx.fillRect(64, y - lh + 40, 300, 5);
  ctx.fillStyle = C.dim;
  ctx.font = '26px "Ledger SC"';
  spaced(ctx, `${count} ${count === 1 ? 'LINE' : 'LINES'} ON THE WALL`, 64, y - lh + 92, 4);
  return canvas.toBuffer('image/png');
}

function renderLedgerHomeCard(headline = 'ONE LINE, EACH MORNING.', sub = 'One line. Nothing to buy.') {
  fonts();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  frame(ctx, '');
  mark(ctx, W / 2 - 120, 120, 240);
  ctx.textAlign = 'center';
  ctx.font = '64px "Ledger SC"';
  for (const size of [64, 56, 48]) { ctx.font = `${size}px "Ledger SC"`; if (ctx.measureText(headline).width < W - 140) break; }
  carved(ctx, headline, W / 2, 470);
  ctx.fillStyle = C.dim; ctx.font = '26px "Ledger SC"';
  ctx.fillText(sub, W / 2, 530);
  return canvas.toBuffer('image/png');
}

module.exports = { renderLedgerQuoteCard, renderLedgerAuthorCard, renderLedgerHomeCard, roman, quoteCardMarks, shareDates, W, H };
