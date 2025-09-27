export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { groupId, winningTokenURI, allTokenURIs } = req.body || {};
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return res.status(500).json({ error: 'Server PINATA_JWT not set' });
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

    const v3Headers = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

    const results = [];
    // Optional: if groupId provided, attempt to remove files from the group (best-effort)
    if (groupId && String(groupId).trim().length) {
      for (const cid of targetCids) {
        try {
          // Pinata v3: Unpin by CID (content API)
          // Docs evolve; attempt a DELETE on v3 content endpoint, fallback to v1 unpin
          let ok = false;
          let resp = await fetch(`https://api.pinata.cloud/v3/content/${cid}`, { method: 'DELETE', headers: v3Headers });
          if (!resp.ok) {
            // fallback to v1 unpin by CID
            resp = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, { method: 'DELETE', headers: v3Headers });
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
          const resp = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, { method: 'DELETE', headers: v3Headers });
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
