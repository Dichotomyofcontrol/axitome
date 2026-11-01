import crypto from 'node:crypto';

export const COOKIE = '__Host-axitome_admin';
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret() {
  const k = process.env.ADMIN_KEY || '';
  if (!k) return null;
  // Session signing key is derived from ADMIN_KEY; changing ADMIN_KEY logs everyone out.
  return crypto.createHmac('sha256', k).update('axitome-admin-session-v1').digest();
}

function sign(payload, key) {
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkPassword(pw) {
  const k = process.env.ADMIN_KEY || '';
  if (!k || !pw) return false;
  return safeEqual(pw, k);
}

export function issueCookie(res) {
  const key = secret();
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${exp}.${crypto.randomBytes(12).toString('base64url')}`;
  const value = `${payload}.${sign(payload, key)}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`);
}

export function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

function readCookie(req) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
  }
  return '';
}

export function isAdmin(req) {
  const key = secret();
  if (!key) return false;
  const v = readCookie(req);
  const lastDot = v.lastIndexOf('.');
  if (lastDot < 0) return false;
  const payload = v.slice(0, lastDot);
  const sig = v.slice(lastDot + 1);
  if (!safeEqual(sig, sign(payload, key))) return false;
  const [role, exp] = payload.split('.');
  return role === 'admin' && Number(exp) > Date.now() / 1000;
}

export function hasKeyInUrl(req) {
  const url = String(req.url || '');
  return /[?&](key|admin_key|adminKey|password)=/i.test(url);
}

export function noStore(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
}
