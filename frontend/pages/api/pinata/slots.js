import { NextResponse } from 'next/server';

// This route returns a deterministic list of up to 20 items from a Pinata group
// Response shape: { slots: [{ index, cid, tokenURI, name, hasContent } * 20 ] }

export const config = { api: { bodyParser: false } };

const GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY_BASE || 'https://gateway.pinata.cloud/ipfs/';

async function listAllPinnedItems({ jwt, apiKey, apiSecret }) {
  const headers = {};
  if (apiKey && apiSecret) {
    headers['pinata_api_key'] = apiKey;
    headers['pinata_secret_api_key'] = apiSecret;
  } else if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  } else {
    throw new Error('Pinata credentials not configured');
  }

  const url = `https://api.pinata.cloud/data/pinList?status=pinned`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pinata list failed: ${res.status} ${res.statusText} ${text}`);
  }
  const data = await res.json();
  // Normalize to array of items with cid, name
  // Pinata returns { rows: [{ ipfs_pin_hash, metadata: { name } }, ... ] }
  let items = (data.rows || []).map((it) => {
    const cid = it.ipfs_pin_hash || '';
    const name = it.metadata?.name || 'untitled';
    return { cid, name };
  }).filter(it => it.cid);

  // Sort by cid ascending for deterministic order
  items.sort((a, b) => a.cid.localeCompare(b.cid));
  return items;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const jwt = process.env.PINATA_JWT || '';
    const apiKey = process.env.PINATA_API_KEY || '';
    const apiSecret = process.env.PINATA_API_SECRET || '';

    const items = await listAllPinnedItems({ jwt, apiKey, apiSecret });
    // Already sorted by cid in listGroupItems

    const slots = Array.from({ length: 20 }).map((_, idx) => {
      const entry = items[idx];
      if (!entry) return { index: idx, hasContent: false, cid: null, tokenURI: null, name: null };
      const tokenURI = entry.cid.startsWith('ipfs://') ? entry.cid : `ipfs://${entry.cid}`;
      // Use server proxy to support private files and set proper headers
      const proxiedUrl = `/api/pinata/proxy?cid=${encodeURIComponent(entry.cid)}`;
      return { index: idx, hasContent: true, cid: entry.cid, tokenURI, url: proxiedUrl, name: entry.name };
    });

    return res.status(200).json({ slots });
  } catch (e) {
    console.error('[slots] error', e);
    return res.status(500).json({ error: e.message || 'internal error' });
  }
}
