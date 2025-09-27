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
    const { name, base64, groupId, mime } = req.body || {};
    if (!name || !base64) {
      return res.status(400).json({ error: 'Missing name or base64' });
    }

    // Decode base64 -> Blob for FormData
    const buffer = Buffer.from(String(base64), 'base64');
    // Determine content type
    let contentType = 'application/octet-stream';
    if (typeof mime === 'string' && mime) {
      contentType = mime;
    } else if (name.toLowerCase().endsWith('.svg')) {
      contentType = 'image/svg+xml';
    } else if (name.toLowerCase().endsWith('.png')) {
      contentType = 'image/png';
    }
    const blob = new Blob([buffer], { type: contentType });

    const form = new FormData();
    form.append('file', blob, name);
    form.append('pinataMetadata', JSON.stringify({ name }));

    const opts = { cidVersion: 1 };
    form.append('pinataOptions', JSON.stringify(opts));

    let resp;
    const shouldUseJwtForGrouping = Boolean(groupId && jwt);
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
      const responseText = await resp.text().catch(() => '');
      console.error(`[pinata/upload] API request failed: ${resp.status} ${resp.statusText}`, {
        status: resp.status,
        statusText: resp.statusText,
        response: responseText,
        headers: Object.fromEntries(resp.headers.entries())
      });

      // Don't treat 502 as a complete failure - the upload might have succeeded
      if (resp.status === 502) {
        console.warn('[pinata/upload] 502 Bad Gateway - upload may have succeeded despite error');
        // Return success with a warning instead of failing completely
        return res.status(200).json({
          tokenURI: null,
          warning: 'Upload may have succeeded but server returned 502. Check Pinata dashboard.',
          status: resp.status,
          details: responseText
        });
      }

      return res.status(resp.status).json({ error: `Pinata upload failed: ${resp.status} ${resp.statusText}`, details: responseText });
    }

    const data = await resp.json();
    console.log('[pinata/upload] Pinata response:', { status: resp.status, data: data?.IpfsHash ? '[HASH PRESENT]' : data });

    const hash = data.IpfsHash || (data?.data?.IpfsHash);
    if (!hash) {
      console.error('[pinata/upload] No IpfsHash in response:', data);
      return res.status(502).json({ error: 'No IpfsHash returned from Pinata', responseData: data });
    }
    console.log('[pinata/upload] Upload successful, hash:', hash);


    return res.status(200).json({ tokenURI: `ipfs://${hash}` });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
