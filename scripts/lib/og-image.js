const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const PImage = require('pureimage');

const SERIF = 'AxitomeSerif';
const SANS = 'AxitomeSans';
let fontsReady = false;

function loadFont(file, family) {
  const registered = PImage.registerFont(file, family).loadSync();
  if (registered.font) registered.font.getKerningValue = () => 0;
  return registered;
}

function fontDir() {
  const candidates = [
    path.join(__dirname, '..', '..', 'assets', 'fonts'),
    path.join(process.cwd(), 'assets', 'fonts'),
    path.join('/var/task', 'assets', 'fonts'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'LiberationSerif-Italic.ttf'))) return dir;
  }
  throw new Error('Missing bundled fonts in assets/fonts');
}

function ensureFonts() {
  if (fontsReady) return;
  const dir = fontDir();
  loadFont(path.join(dir, 'LiberationSerif-Italic.ttf'), SERIF);
  loadFont(path.join(dir, 'LiberationSans-Regular.ttf'), SANS);
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
}

function drawWatermark(ctx, width, y) {
  ctx.font = `16px ${SANS}`;
  ctx.fillStyle = '#7d766c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('axitome.com', width / 2, y);
}

function rule(ctx, width, y) {
  ctx.strokeStyle = '#c8a86e';
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 30, y);
  ctx.lineTo(width / 2 + 30, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

async function encode(bitmap) {
  const stream = new PassThrough();
  const chunks = [];
  const done = new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
  await PImage.encodePNGToStream(bitmap, stream, { deflateLevel: 3 });
  return done;
}

async function renderQuoteOg(quote) {
  ensureFonts();
  const width = 1080;
  const height = 1080;
  const bitmap = PImage.make(width, height);
  const ctx = bitmap.getContext('2d');
  paintBackground(ctx, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const maxWidth = width - 200;
  let fontSize = quote.q.length > 300 ? 30 : quote.q.length > 150 ? 36 : 42;
  let lines = [];
  let lineH = 0;
  const maxBlock = 640;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    ctx.font = `${fontSize}px ${SERIF}`;
    lines = wrap(ctx, quote.q, maxWidth);
    lineH = Math.round(fontSize * 1.7);
    if (lines.length * lineH <= maxBlock || fontSize <= 24) break;
    fontSize -= 2;
  }

  const openH = 80;
  const gapOpen = 30;
  const gapClose = 15;
  const closeH = 80;
  const gapRule = 40;
  const gapAuthor = 30;
  const authorH = 20;
  const sourceExtra = quote.s ? 28 : 0;
  const textBlockH = lines.length * lineH;
  const totalH = openH + gapOpen + textBlockH + gapClose + closeH + gapRule + 1 + gapAuthor + authorH + sourceExtra;
  let y = Math.round((height - totalH) / 2);

  ctx.font = `90px ${SERIF}`;
  ctx.fillStyle = '#c8a86e';
  ctx.fillText('\u201C', width / 2, y);
  y += openH + gapOpen;

  ctx.font = `${fontSize}px ${SERIF}`;
  ctx.fillStyle = '#f0ebe3';
  lines.forEach((line, i) => ctx.fillText(line, width / 2, y + i * lineH));
  y += textBlockH + gapClose;

  ctx.font = `90px ${SERIF}`;
  ctx.fillStyle = '#c8a86e';
  ctx.fillText('\u201D', width / 2, y);
  y += closeH + gapRule;

  rule(ctx, width, y);
  y += 1 + gapAuthor;

  let authorSize = 18;
  ctx.font = `${authorSize}px ${SANS}`;
  ctx.fillStyle = '#b0a898';
  let author = String(quote.a || '').toUpperCase();
  while (ctx.measureText(author).width > maxWidth && authorSize > 12) {
    authorSize -= 1;
    ctx.font = `${authorSize}px ${SANS}`;
  }
  if (ctx.measureText(author).width > maxWidth) {
    author = `${author.slice(0, 42).trim()}\u2026`;
  }
  ctx.fillText(author, width / 2, y);
  y += authorH;

  if (quote.s && y < height - 120) {
    ctx.font = `15px ${SANS}`;
    ctx.fillStyle = '#8c857b';
    wrap(ctx, quote.s, maxWidth).slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, width / 2, y + 12 + i * 20);
    });
  }

  drawWatermark(ctx, width, height - 55);
  return encode(bitmap);
}

async function renderAuthorOg(name, count) {
  ensureFonts();
  const width = 1080;
  const height = 1080;
  const bitmap = PImage.make(width, height);
  const ctx = bitmap.getContext('2d');
  paintBackground(ctx, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const maxWidth = width - 180;
  let size = 64;
  let lines = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    ctx.font = `${size}px ${SERIF}`;
    lines = wrap(ctx, name, maxWidth);
    if (lines.length <= 3 || size <= 36) break;
    size -= 4;
  }
  const lineH = Math.round(size * 1.25);
  let y = 380;
  ctx.fillStyle = '#f0ebe3';
  lines.forEach((line, i) => ctx.fillText(line, width / 2, y + i * lineH));
  y += lines.length * lineH + 36;

  rule(ctx, width, y);

  ctx.font = `20px ${SANS}`;
  ctx.fillStyle = '#b0a898';
  const label = count === 1 ? '1 quote' : `${count} quotes`;
  ctx.fillText(label, width / 2, y + 28);
  drawWatermark(ctx, width, height - 55);
  return encode(bitmap);
}

module.exports = {
  renderQuoteOg,
  renderAuthorOg,
};
