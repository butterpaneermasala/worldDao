export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { groupId, winningTokenURI, allTokenURIs } = req.body || {};
  const jwt = process.env.PINATA_JWT;
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;
  if (!jwt && !(apiKey && apiSecret)) {
    return res.status(500).json({ error: 'Server Pinata credentials not set: provide PINATA_JWT or PINATA_API_KEY and PINATA_API_SECRET' });
  }
  if (!Array.isArray(allTokenURIs) || !winningTokenURI) {
    return res.status(400).json({ error: 'Missing winningTokenURI or allTokenURIs' });
  }

  try {
    // Helper to extract CID from ipfs://CID or https://gateway/ipfs/CID or other typical forms
    const extractCid = (uri) => {
      if (!uri || typeof uri !== 'string') return null;
      try {
        if (uri.startsWith('ipfs://')) return uri.slice('ipfs://'.length).split('/')[0];
        // Try parsing as URL
        const u = new URL(uri);
        // common: /ipfs/<cid>/...
        const parts = u.pathname.split('/').filter(Boolean);
        const ipfsIdx = parts.indexOf('ipfs');
        if (ipfsIdx !== -1 && parts[ipfsIdx + 1]) return parts[ipfsIdx + 1];
        // subdomain gateway like https://<cid>.ipfs.gateway
        const hostParts = u.hostname.split('.');
        const ipfsSub = hostParts.indexOf('ipfs');
        if (ipfsSub > 0) return hostParts[ipfsSub - 1];
      } catch (_) {}
      return null;
    };

    const winnerCid = extractCid(winningTokenURI);
    if (!winnerCid) return res.status(400).json({ error: 'Cannot parse winning CID' });

    const targetCids = new Set();
    for (const uri of allTokenURIs) {
      const cid = extractCid(uri);
      if (cid && cid !== winnerCid) targetCids.add(cid);
    }

    const v3Headers = jwt
      ? { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
      : null;
    const v1Headers = jwt
      ? { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }
      : {
          pinata_api_key: apiKey,
          pinata_secret_api_key: apiSecret,
          'Content-Type': 'application/json',
        };

    const results = [];
    // Optional: if groupId provided, attempt to remove files from the group (best-effort)
    if (groupId && String(groupId).trim().length) {
      for (const cid of targetCids) {
        try {
          // Prefer v3 with JWT if available, else use v1 with available creds
          let ok = false;
          let resp;
          if (v3Headers) {
            resp = await fetch(`https://api.pinata.cloud/v3/content/${cid}`, { method: 'DELETE', headers: v3Headers });
            if (!resp.ok) {
              // fallback to v1 unpin by CID with same headers or switch to API keys
              resp = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, { method: 'DELETE', headers: v1Headers });
            }
          } else {
            resp = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, { method: 'DELETE', headers: v1Headers });
          }
          ok = resp.ok;
          if (!ok) {
            const t = await resp.text().catch(() => '');
            results.push({ cid, status: 'failed', error: t });
          } else {
            results.push({ cid, status: 'deleted' });
          }
        } catch (e) {
          results.push({ cid, status: 'failed', error: String(e) });
        }
      }
    } else {
      // No groupId: simply unpin non-winners by CID
      for (const cid of targetCids) {
        try {
          const resp = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, { method: 'DELETE', headers: v1Headers });
          if (!resp.ok) {
            const t = await resp.text().catch(() => '');
            results.push({ cid, status: 'failed', error: t });
          } else {
            results.push({ cid, status: 'deleted' });
          }
        } catch (e) {
          results.push({ cid, status: 'failed', error: String(e) });
        }
      }
    }

    return res.status(200).json({ ok: true, deleted: results });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
