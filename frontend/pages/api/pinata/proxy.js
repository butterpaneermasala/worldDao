export const config = { api: { bodyParser: false } };

const DEFAULT_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY_BASE || 'https://gateway.pinata.cloud/ipfs/';

export default async function handler(req, res) {
  try {
    const cid = String(req.query.cid || '').trim();
    if (!cid) return res.status(400).json({ error: 'missing cid' });

    const url = `${DEFAULT_GATEWAY}${cid}`;

    // Prepare headers for authenticated access to private gateways
    const headers = {};
    const jwt = process.env.PINATA_JWT || '';
    const apiKey = process.env.PINATA_API_KEY || '';
    const apiSecret = process.env.PINATA_API_SECRET || '';
    if (apiKey && apiSecret) {
      headers['pinata_api_key'] = apiKey;
      headers['pinata_secret_api_key'] = apiSecret;
    } else if (jwt) {
      headers['Authorization'] = `Bearer ${jwt}`;
    }

    const upstream = await fetch(url, { headers });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return res.status(upstream.status).send(text);
    }

    // Copy content-type if provided
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType) res.setHeader('Content-Type', contentType);
    // Cache headers can be added for performance
    res.setHeader('Cache-Control', 'public, max-age=60');

    const buf = Buffer.from(await upstream.arrayBuffer());

    // If no contentType, try to detect SVG
    if (!contentType) {
      const head = buf.slice(0, 200).toString('utf8').toLowerCase();
      if (head.includes('<svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      }
    }

    res.status(200).send(buf);
  } catch (e) {
    console.error('[pinata/proxy] error', e);
    res.status(500).json({ error: 'proxy error', details: String(e) });
  }
}
