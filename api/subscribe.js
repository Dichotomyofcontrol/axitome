import { kv } from '@vercel/kv';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fields(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  return {
    email: String(body.email || '').trim().toLowerCase(),
    company: String(body.company || '').trim(),
    next: String(body.next || '').trim(),
  };
}

function safeNext(next) {
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) return '/';
  return next.slice(0, 300);
}

function wantsJson(req) {
  const type = String(req.headers['content-type'] || '');
  const accept = String(req.headers.accept || '');
  return type.includes('json') || accept.includes('application/json');
}

function page(message, next) {
  const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Axitome</title>
<link rel="stylesheet" href="/page.css">
</head>
<body>
<main class="done">
  <p class="quote">${safe}</p>
  <p><a href="${next.replace(/"/g, '')}">Return</a></p>
</main>
</body>
</html>`;
}

function send(res, req, status, message, next) {
  if (wantsJson(req)) return res.status(status).json(status < 400 ? { ok: true } : { error: message });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(page(message, safeNext(next)));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, company, next } = fields(req);
  if (company) return send(res, req, 200, 'Saved. One quote, each morning.', next);

  if (!EMAIL.test(email) || email.length > 320) {
    return send(res, req, 400, 'Enter a valid email address.', next);
  }

  if (String(process.env.SUBSCRIBE_ENABLED || 'true').toLowerCase() === 'false') {
    return send(res, req, 503, 'Signup is not open yet.', next);
  }

  try {
    const existing = await kv.hget('subscribers', email);
    if (!existing) await kv.hset('subscribers', { [email]: new Date().toISOString() });
    return send(res, req, 200, 'Saved. One quote, each morning.', next);
  } catch (err) {
    console.error('Subscribe storage failed');
    return send(res, req, 503, 'Signup is not open yet.', next);
  }
}
