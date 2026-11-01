import { kv } from '@vercel/kv';
import { checkPassword, issueCookie, clearCookie, hasKeyInUrl, noStore } from './_session.js';

const LIMIT = 5;          // attempts
const WINDOW = 15 * 60;   // seconds
const GLOBAL_FAILS = 30;  // failed attempts from all IPs combined per window
const GLOBAL_KEY = 'admin-login:fail:all';

function ip(req) {
  return String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
}

export default async function handler(req, res) {
  noStore(res);
  if (hasKeyInUrl(req)) return res.status(400).json({ error: 'Do not put the admin key in the URL' });
  if (req.method === 'DELETE') { clearCookie(res); return res.status(200).json({ ok: true }); }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rlKey = `admin-login:${ip(req)}`;
  let count = 0;
  try {
    count = await kv.incr(rlKey);
    if (count === 1) await kv.expire(rlKey, WINDOW);
  } catch (e) {
    console.error('Rate limit store unavailable');
  }
  let globalFails = 0;
  try { globalFails = Number(await kv.get(GLOBAL_KEY)) || 0; } catch (e) {}
  if (count > LIMIT || globalFails >= GLOBAL_FAILS) {
    res.setHeader('Retry-After', String(WINDOW));
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const pw = String(body.password || '');
  if (!checkPassword(pw)) {
    try {
      const n = await kv.incr(GLOBAL_KEY);
      if (n === 1) await kv.expire(GLOBAL_KEY, WINDOW);
    } catch (e) {}
    await new Promise(r => setTimeout(r, 400));
    return res.status(401).json({ error: 'Invalid password' });
  }
  try { await kv.del(rlKey); } catch (e) {}
  issueCookie(res);
  return res.status(200).json({ ok: true });
}
