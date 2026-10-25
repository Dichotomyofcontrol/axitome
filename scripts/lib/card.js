const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const SERIF = 'Axitome Serif';
const SANS = 'Axitome Sans';
const Q = 'Ledger Garamond';
const QI = 'Ledger Garamond Italic';
const SC = 'Ledger SC';
const SCB = 'Ledger SC Bold';
const INK = '#3A2E26';
const MUTED = '#5C5042';
const OX = '#6B1E1E';
const DARK_PALETTE = { ink: '#E9E2D3', muted: '#A79E8C', ox: '#962F2C', hi: '#141210', lo: '#000000' };
const LIGHT_PALETTE = { ink: INK, muted: MUTED, ox: OX, hi: '#FCF8EE', lo: '#1E1612' };
let fontsReady = false;

function ensureFonts() {
  if (fontsReady) return;
  const dir = path.join(__dirname, '..', '..', 'assets', 'fonts');
  const files = [
    ['LiberationSerif-Italic.ttf', SERIF],
    ['LiberationSans-Regular.ttf', SANS],
    ['CormorantGaramond[wght].ttf', Q],
    ['CormorantGaramond-Italic[wght].ttf', QI],
    ['CormorantSC-SemiBold.ttf', SC],
    ['CormorantSC-Bold.ttf', SCB],
  ];
  for (const [file, name] of files) {
    const fontPath = path.join(dir, file);
    if (!fs.existsSync(fontPath)) throw new Error(`Missing bundled font ${file}`);
    GlobalFonts.registerFromPath(fontPath, name);
  }
  fontsReady = true;
}

function roman(n) {
  let value = Math.floor(Number(n) || 0);
  if (value <= 0) return '';
  let out = '';
  const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  for (const [amount, glyph] of table) {
    while (value >= amount) {
      out += glyph;
      value -= amount;
    }
  }
  return out;
}

function romanDate(date) {
  const [year, month, day] = String(date).split('-').map(Number);
  return `${roman(day)} · ${roman(month)} · ${roman(year)}`;
}

function texturePath(dark) {
  return path.join(__dirname, '..', '..', 'assets', 'textures', dark ? 'basalt.jpg' : 'travertine.jpg');
}

function setFont(ctx, family, size, weight) {
  ctx.font = weight ? `${weight} ${size}px "${family}"` : `${size}px "${family}"`;
  ctx.fontVariationSettings = weight ? `"wght" ${weight}` : 'normal';
}

function fillAscender(ctx, text, x, ascenderY) {
  ctx.textBaseline = 'alphabetic';
  const ascent = ctx.measureText('Hg').fontBoundingBoxAscent;
  ctx.fillText(text, x, ascenderY + ascent);
}

// Shadow + highlight + ink, matching the carved lettering on the ledger mockups.
function carved(ctx, text, x, ascenderY, ink, hi, lo) {
  ctx.textBaseline = 'alphabetic';
  const y = ascenderY + ctx.measureText('H').fontBoundingBoxAscent;
  ctx.save();
  ctx.filter = 'blur(1.2px)';
  ctx.globalAlpha = 140 / 255;
  ctx.fillStyle = lo;
  ctx.fillText(text, x + 2, y + 2);
  ctx.restore();
  ctx.save();
  ctx.filter = 'blur(0.6px)';
  ctx.globalAlpha = 140 / 255;
  ctx.fillStyle = hi;
  ctx.fillText(text, x - 1, y - 1);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 245 / 255;
  ctx.fillStyle = ink;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function paintLedgerBackground(ctx, img, width, height, dark) {
  const scale = Math.max(width / img.width, height / img.height);
  const dw = Math.round(img.width * scale);
  const dh = Math.round(img.height * scale);
  const x = Math.floor((dw - width) / 2);
  const y = Math.floor((dh - height) / 2);
  const layer = createCanvas(width, height);
  const layerCtx = layer.getContext('2d');
  layerCtx.imageSmoothingEnabled = true;
  layerCtx.imageSmoothingQuality = 'high';
  layerCtx.drawImage(img, -x, -y, dw, dh);
  if (!dark) {
    ctx.filter = 'blur(1.2px)';
    ctx.drawImage(layer, 0, 0);
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(233,226,211,0.38)';
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.drawImage(layer, 0, 0);
  }
}

async function renderLedgerCard(quote, options = {}) {
  ensureFonts();
  const { date, dark = false, layout = 'post' } = options;
  if (!date) throw new Error('renderLedgerCard requires a YYYY-MM-DD date');
  const story = layout === 'story';
  const width = 1080;
  const height = story ? 1920 : 1350;
  const blockTop = story ? 300 : 260;
  const blockH = story ? 1120 : 700;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const texture = await loadImage(texturePath(dark));
  paintLedgerBackground(ctx, texture, width, height, dark);

  const palette = dark ? DARK_PALETTE : LIGHT_PALETTE;
  const left = 110;
  const right = width - 110;
  const maxWidth = right - left;

  setFont(ctx, SC, 30);
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'left';
  fillAscender(ctx, `N\u00B0 ${roman((quote.idx || 0) + 1)}`, left, 110);
  ctx.textAlign = 'right';
  fillAscender(ctx, romanDate(date), right, 110);
  ctx.fillStyle = palette.muted;
  ctx.fillRect(left, 160, maxWidth, 1);

  let size = 124;
  let lines = [];
  let lineH = 0;
  const quoted = `\u201C${quote.q}\u201D`;
  while (true) {
    setFont(ctx, Q, size, 500);
    lines = wrap(ctx, quoted, maxWidth);
    lineH = Math.floor(size * 1.08);
    if (lines.length * lineH <= blockH || size <= 36) break;
    size -= 4;
  }
  const maxLines = Math.max(1, Math.floor(blockH / lineH));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const trimmed = lines[maxLines - 1].replace(/[\u201D"\s]+$/g, '').replace(/[,\s;:\u2014-]+$/g, '');
    lines[maxLines - 1] = `${trimmed}\u2026\u201D`;
  }

  setFont(ctx, Q, size, 500);
  const quoteMark = ctx.measureText('\u201C').width;
  let y = Math.floor(blockTop + (blockH - lines.length * lineH) / 2);
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    const x = left - (i === 0 ? quoteMark : 0);
    carved(ctx, line, x, y + i * lineH, palette.ink, palette.hi, palette.lo);
  });
  y += lines.length * lineH + 56;

  ctx.fillStyle = palette.ox;
  ctx.fillRect(left, y, 220, 5);
  y += 40;

  let author = String(quote.a || '').toUpperCase();
  let authorSize = 46;
  while (authorSize > 28) {
    setFont(ctx, SCB, authorSize);
    if (ctx.measureText(author).width <= maxWidth) break;
    authorSize -= 2;
  }
  setFont(ctx, SCB, authorSize);
  if (ctx.measureText(author).width > maxWidth) {
    while (author.length > 4 && ctx.measureText(`${author}\u2026`).width > maxWidth) {
      author = author.slice(0, -1).trim();
    }
    author = `${author}\u2026`;
  }
  ctx.textAlign = 'left';
  carved(ctx, author, left, y, palette.ink, palette.hi, palette.lo);

  if (quote.s) {
    let sourceSize = 34;
    while (sourceSize > 18) {
      setFont(ctx, QI, sourceSize, 500);
      if (ctx.measureText(quote.s).width <= maxWidth) break;
      sourceSize -= 2;
    }
    setFont(ctx, QI, sourceSize, 500);
    ctx.fillStyle = palette.muted;
    ctx.textAlign = 'left';
    fillAscender(ctx, quote.s, left, y + 62);
  }

  ctx.fillStyle = palette.muted;
  ctx.fillRect(left, height - 150, maxWidth, 1);
  setFont(ctx, SCB, 34);
  ctx.fillStyle = palette.ox;
  ctx.textAlign = 'left';
  fillAscender(ctx, 'AXITOME', left, height - 120);
  setFont(ctx, QI, 30, 500);
  ctx.fillStyle = palette.muted;
  ctx.textAlign = 'right';
  fillAscender(ctx, 'axitome.com', right, height - 114);
  if (dark) {
    setFont(ctx, SC, 26);
    ctx.fillStyle = palette.muted;
    ctx.textAlign = 'center';
    fillAscender(ctx, 'MEMENTO MORI', Math.round(width / 2), height - 116);
  }

  return canvas.toBuffer('image/png');
}

function wrap(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function paintBackground(ctx, width, height) {
  ctx.fillStyle = '#111010';
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(width / 2, height * 0.38, 0, width / 2, height * 0.38, width * 0.55);
  glow.addColorStop(0, 'rgba(200,168,110,0.05)');
  glow.addColorStop(1, 'rgba(200,168,110,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawWatermark(ctx, width, y) {
  ctx.font = `16px "${SANS}"`;
  ctx.fillStyle = '#7d766c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('axitome.com', width / 2, y);
}

function renderQuoteCard(quote, layout = 'square') {
  ensureFonts();
  const story = layout === 'story';
  const width = 1080;
  const height = story ? 1920 : 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  paintBackground(ctx, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const maxWidth = width - (story ? 160 : 200);
  let fontSize = quote.q.length > 300 ? (story ? 40 : 30) : quote.q.length > 150 ? (story ? 48 : 36) : (story ? 56 : 42);
  let lines = [];
  let lineH = 0;
  const maxBlock = story ? 1100 : 640;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    ctx.font = `${fontSize}px "${SERIF}"`;
    lines = wrap(ctx, quote.q, maxWidth);
    lineH = Math.round(fontSize * 1.7);
    if (lines.length * lineH <= maxBlock || fontSize <= 24) break;
    fontSize -= 2;
  }

  const openH = story ? 100 : 80;
  const gapOpen = story ? 36 : 30;
  const gapClose = story ? 18 : 15;
  const closeH = story ? 100 : 80;
  const gapRule = story ? 48 : 40;
  const gapAuthor = story ? 36 : 30;
  const authorH = story ? 28 : 20;
  const sourceExtra = quote.s ? (story ? 40 : 28) : 0;
  const textBlockH = lines.length * lineH;
  const totalH = openH + gapOpen + textBlockH + gapClose + closeH + gapRule + 1 + gapAuthor + authorH + sourceExtra;
  let y = Math.round((height - totalH) / 2);
  if (story) y = Math.max(220, Math.min(y, 420));

  ctx.font = `${story ? 110 : 90}px "${SERIF}"`;
  ctx.fillStyle = '#c8a86e';
  ctx.fillText('\u201C', width / 2, y);
  y += openH + gapOpen;

  ctx.font = `${fontSize}px "${SERIF}"`;
  ctx.fillStyle = '#f0ebe3';
  lines.forEach((line, i) => ctx.fillText(line, width / 2, y + i * lineH));
  y += textBlockH + gapClose;

  ctx.font = `${story ? 110 : 90}px "${SERIF}"`;
  ctx.fillStyle = '#c8a86e';
  ctx.fillText('\u201D', width / 2, y);
  y += closeH + gapRule;

  ctx.strokeStyle = '#c8a86e';
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 30, y);
  ctx.lineTo(width / 2 + 30, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  y += 1 + gapAuthor;

  let authorSize = story ? 22 : 18;
  ctx.font = `${authorSize}px "${SANS}"`;
  ctx.fillStyle = '#b0a898';
  let author = quote.a.toUpperCase();
  while (ctx.measureText(author).width > maxWidth && authorSize > 12) {
    authorSize -= 1;
    ctx.font = `${authorSize}px "${SANS}"`;
  }
  if (ctx.measureText(author).width > maxWidth) {
    author = `${author.slice(0, 42).trim()}\u2026`;
  }
  ctx.fillText(author, width / 2, y);
  y += authorH;

  if (quote.s && y < height - 120) {
    ctx.font = `${story ? 18 : 15}px "${SANS}"`;
    ctx.fillStyle = '#8c857b';
    wrap(ctx, quote.s, maxWidth).slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, width / 2, y + 12 + i * (story ? 26 : 20));
    });
  }

  drawWatermark(ctx, width, story ? height - 180 : height - 55);
  return canvas.toBuffer('image/png');
}

function renderAuthorCard(name, count) {
  ensureFonts();
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  paintBackground(ctx, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const maxWidth = width - 180;
  let size = 64;
  let lines = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    ctx.font = `${size}px "${SERIF}"`;
    lines = wrap(ctx, name, maxWidth);
    if (lines.length <= 3 || size <= 36) break;
    size -= 4;
  }
  const lineH = Math.round(size * 1.25);
  let y = 380;
  ctx.fillStyle = '#f0ebe3';
  lines.forEach((line, i) => ctx.fillText(line, width / 2, y + i * lineH));
  y += lines.length * lineH + 36;

  ctx.strokeStyle = '#c8a86e';
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 30, y);
  ctx.lineTo(width / 2 + 30, y);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.font = `20px "${SANS}"`;
  ctx.fillStyle = '#b0a898';
  const label = count === 1 ? '1 quote' : `${count} quotes`;
  ctx.fillText(label, width / 2, y + 28);
  drawWatermark(ctx, width, height - 55);
  return canvas.toBuffer('image/png');
}

module.exports = {
  ensureFonts,
  renderQuoteCard,
  renderAuthorCard,
  renderLedgerCard,
  roman,
  romanDate,
};
