export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const jwtRaw = process.env.PINATA_JWT;
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;
  // Treat malformed JWTs as absent to allow clean fallback
  const jwt = (jwtRaw && jwtRaw.split('.').length === 3) ? jwtRaw : '';
  if (!jwt && !(apiKey && apiSecret)) {
    return res.status(500).json({ error: 'Server Pinata credentials not set: provide PINATA_JWT or PINATA_API_KEY and PINATA_API_SECRET' });
  }

  try {
    const { name, base64, groupId } = req.body || {};
    if (!name || !base64) {
      return res.status(400).json({ error: 'Missing name or base64' });
    }

    // Decode base64 -> Blob for FormData
    const buffer = Buffer.from(String(base64), 'base64');
    const blob = new Blob([buffer], { type: 'image/svg+xml' });

    const form = new FormData();
    form.append('file', blob, name);
    form.append('pinataMetadata', JSON.stringify({ name }));

    const groupIdEnv = process.env.PINATA_GROUP_ID || process.env.NEXT_PUBLIC_PINATA_GROUP_ID || '';
    const finalGroupId = (groupId && String(groupId).trim()) || (groupIdEnv && String(groupIdEnv).trim()) || '';
    if (finalGroupId) {
      console.log('[pinata/upload] Using groupId:', finalGroupId);
    }
    const opts = finalGroupId
      ? { cidVersion: 1, groupId: finalGroupId }
      : { cidVersion: 1 };
    form.append('pinataOptions', JSON.stringify(opts));

    let resp;
    const shouldUseJwtForGrouping = Boolean(finalGroupId && jwt);
    if (shouldUseJwtForGrouping) {
      // When a groupId is present and we have a valid JWT, use JWT upload to ensure grouping works reliably
      console.log('[pinata/upload] Using JWT for upload (group mode)');
      resp = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: form,
      });
    } else if (apiKey && apiSecret) {
      // Otherwise prefer server API key/secret when available
      console.log('[pinata/upload] Using API key/secret for upload');
      resp = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          pinata_api_key: apiKey,
          pinata_secret_api_key: apiSecret,
        },
        body: form,
      });
    } else if (jwt) {
      // Fallback to JWT if no keys present
      console.log('[pinata/upload] Using JWT for upload');
      resp = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: form,
      });
    }

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return res.status(resp.status).json({ error: `Pinata upload failed: ${resp.status} ${resp.statusText}`, details: t });
    }

    const data = await resp.json();
    const hash = data.IpfsHash || (data?.data?.IpfsHash);
    if (!hash) {
      return res.status(502).json({ error: 'No IpfsHash returned from Pinata' });
    }

    // If we have a JWT and a finalGroupId, ensure the CID is added to the group via v3 API
    if (jwt && finalGroupId) {
      try {
        const addResp = await fetch(`https://api.pinata.cloud/v3/groups/${encodeURIComponent(finalGroupId)}/contents`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ cids: [hash] }),
        });
        if (!addResp.ok) {
          const t = await addResp.text().catch(() => '');
          console.warn('[pinata/upload] add-to-group failed', addResp.status, addResp.statusText, t);
          return res.status(502).json({ error: 'Failed to add CID to Pinata group', status: addResp.status, statusText: addResp.statusText, details: t });
        }
        console.log('[pinata/upload] Added CID to group successfully');
      } catch (e) {
        console.warn('[pinata/upload] add-to-group error', String(e));
        return res.status(502).json({ error: 'Exception while adding CID to Pinata group', details: String(e) });
      }
    }

    return res.status(200).json({ tokenURI: `ipfs://${hash}` });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
