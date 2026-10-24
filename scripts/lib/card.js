const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const SERIF = 'Axitome Serif';
const SANS = 'Axitome Sans';
let fontsReady = false;

function ensureFonts() {
  if (fontsReady) return;
  const dir = path.join(__dirname, '..', '..', 'assets', 'fonts');
  const serif = path.join(dir, 'LiberationSerif-Italic.ttf');
  const sans = path.join(dir, 'LiberationSans-Regular.ttf');
  if (!fs.existsSync(serif) || !fs.existsSync(sans)) {
    throw new Error('Missing bundled fonts in assets/fonts');
  }
  GlobalFonts.registerFromPath(serif, SERIF);
  GlobalFonts.registerFromPath(sans, SANS);
  fontsReady = true;
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
};
