import { kv } from '@vercel/kv';
import { isAdmin, hasKeyInUrl, noStore } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  noStore(res);
  if (hasKeyInUrl(req)) return res.status(400).json({ error: 'Do not put the admin key in the URL' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const all = await kv.hgetall('likes') || {};
    const sorted = Object.entries(all)
      .map(([idx, count]) => ({ idx: parseInt(idx), count }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.count - a.count);

    let subscribers = [];
    try {
      const saved = await kv.hgetall('subscribers') || {};
      subscribers = Object.entries(saved)
        .map(([email, at]) => ({ email, at: String(at) }))
        .sort((a, b) => b.at.localeCompare(a.at));
    } catch (err) {
      console.error('Subscriber read failed');
    }

    return res.status(200).json({
      total_likes: sorted.reduce((s, e) => s + e.count, 0),
      quotes: sorted,
      subscriber_count: subscribers.length,
      subscribers,
    });
  } catch (e) {
    console.error('Admin API error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
}
