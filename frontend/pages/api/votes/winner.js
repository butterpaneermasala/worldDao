import { computeWinner } from '@/lib/store';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const sessionId = Number(req.query.sessionId);
    if (Number.isNaN(sessionId)) return res.status(400).json({ error: 'missing/invalid sessionId' });
    const out = computeWinner(sessionId);
    return res.status(200).json(out);
  } catch (e) {
    console.error('[votes/winner] error', e);
    return res.status(500).json({ error: e.message || 'internal error' });
  }
}
