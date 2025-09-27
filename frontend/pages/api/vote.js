import { recordVote } from '@/lib/store';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try {
    const { sessionId, index, address } = req.body || {};
    if (sessionId === undefined || index === undefined || !address) {
      return res.status(400).json({ error: 'missing fields: sessionId, index, address' });
    }
    // TODO: optional signature verification can be added here
    const ts = Math.floor(Date.now() / 1000);
    const out = recordVote({ sessionId: Number(sessionId), index: Number(index), address: String(address).toLowerCase(), timestamp: ts });
    if (!out.ok) return res.status(400).json({ error: out.error });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[vote] error', e);
    return res.status(500).json({ error: e.message || 'internal error' });
  }
}
