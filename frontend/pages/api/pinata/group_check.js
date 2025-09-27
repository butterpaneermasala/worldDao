export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const jwt = process.env.PINATA_JWT;
  const groupId = process.env.PINATA_GROUP_ID || process.env.NEXT_PUBLIC_PINATA_GROUP_ID || '';
  if (!groupId) return res.status(400).json({ error: 'No groupId configured (PINATA_GROUP_ID or NEXT_PUBLIC_PINATA_GROUP_ID)' });
  if (!jwt || jwt.split('.').length !== 3) return res.status(400).json({ error: 'PINATA_JWT missing or malformed' });

  try {
    // Fetch group details
    const infoResp = await fetch(`https://api.pinata.cloud/v3/groups/${encodeURIComponent(groupId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const infoText = await infoResp.text().catch(() => '');
    let infoJson = null;
    try { infoJson = JSON.parse(infoText); } catch (_) {}

    // Optionally list contents first page
    const contentsResp = await fetch(`https://api.pinata.cloud/v3/groups/${encodeURIComponent(groupId)}/contents?limit=1`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const contentsText = await contentsResp.text().catch(() => '');
    let contentsJson = null;
    try { contentsJson = JSON.parse(contentsText); } catch (_) {}

    return res.status(200).json({
      ok: infoResp.ok && contentsResp.ok,
      groupCheck: {
        info: { status: infoResp.status, statusText: infoResp.statusText, body: infoJson || infoText },
        contents: { status: contentsResp.status, statusText: contentsResp.statusText, body: contentsJson || contentsText },
      },
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
