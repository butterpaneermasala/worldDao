#!/usr/bin/env node
/*
  Relayer daemon: automatically finalizes after Voting ends.
  Reads env:
    RELAYER_PRIVATE_KEY, RPC_URL, VOTING_ADDRESS,
    NEXT_PUBLIC_PINATA_GATEWAY_BASE, PINATA_GROUP_ID (optional for slots API)

  Flow:
    - Poll currentPhaseInfo()
    - If Voting ended, compute winner index from on-chain tallies, map to Pinata slot,
      fetch SVG bytes, and call finalizeWithWinner(tokenURI, svgBase64, winnerIndex)
*/

import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const VOTING_ADDRESS = process.env.VOTING_ADDRESS || process.env.NEXT_PUBLIC_VOTING_ADDRESS;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY_BASE || 'https://gateway.pinata.cloud/ipfs/';
const PINATA_GROUP_ID = process.env.PINATA_GROUP_ID || process.env.NEXT_PUBLIC_PINATA_GROUP_ID || '';

if (!RELAYER_PRIVATE_KEY) {
  console.error('[relayer] Missing RELAYER_PRIVATE_KEY');
  process.exit(1);
}
if (!VOTING_ADDRESS) {
  console.error('[relayer] Missing VOTING_ADDRESS');
  process.exit(1);
}

const ABI_PATH = path.join(process.cwd(), 'frontend', 'abis', 'Voting.json');
let VOTING_ABI;
try {
  VOTING_ABI = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
} catch (e) {
  // fallback if script is run from frontend dir
  try {
    VOTING_ABI = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'abis', 'Voting.json'), 'utf8'));
  } catch (err) {
    console.error('[relayer] Cannot read Voting ABI', e, err);
    process.exit(1);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getSlots() {
  try {
    const url = new URL('/api/pinata/slots', 'http://localhost:3000');
    if (PINATA_GROUP_ID) url.searchParams.set('groupId', PINATA_GROUP_ID);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`slots ${res.status}`);
    const data = await res.json();
    return data.slots || [];
  } catch (e) {
    console.warn('[relayer] slots fetch failed, proceeding with empty slots', e.message);
    return Array.from({ length: 20 }).map((_, i) => ({ index: i, hasContent: false }));
  }
}

async function fetchSvgBase64FromTokenURI(tokenURI) {
  try {
    const cid = tokenURI.startsWith('ipfs://') ? tokenURI.slice('ipfs://'.length) : tokenURI;
    // Use local proxy API to handle authentication
    const proxyUrl = `http://localhost:3000/api/pinata/proxy?cid=${encodeURIComponent(cid)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`svg fetch ${res.status}`);
    const svg = await res.text();
    // base64 encode
    const b64 = Buffer.from(svg, 'utf8').toString('base64');
    return b64;
  } catch (e) {
    console.error('[relayer] failed to fetch/encode svg', e.message);
    return '';
  }
}

async function computeWinnerIndexOnChain(contract) {
  // Read all 20 slotVotes and lastVoteTime to mirror contract tie-break
  const counts = [];
  const lastTs = [];
  for (let i = 0; i < 20; i++) {
    const v = await contract.slotVotes(i);
    const ts = await contract.lastVoteTime(i);
    counts[i] = Number(v);
    lastTs[i] = Number(ts) === 0 ? Number.MAX_SAFE_INTEGER : Number(ts);
  }
  let winner = 0;
  let maxVotes = counts[0] || 0;
  let earliest = lastTs[0];
  for (let i = 1; i < 20; i++) {
    const v = counts[i] || 0;
    if (v > maxVotes) {
      maxVotes = v; winner = i; earliest = lastTs[i];
    } else if (v === maxVotes) {
      if (lastTs[i] < earliest) { winner = i; earliest = lastTs[i]; }
    }
  }
  return winner;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
  const voting = new ethers.Contract(VOTING_ADDRESS, VOTING_ABI, wallet);

  console.log('[relayer] started. address:', await wallet.getAddress());

  while (true) {
    try {
      const info = await voting.currentPhaseInfo();
      const phase = Number(info[0]);
      const end = Number(info[1]);
      const now = Math.floor(Date.now() / 1000);

      if (phase === 1 /* Voting */ && now >= end) {
        console.log('[relayer] Voting ended. Finalizing...');
        const winnerIndex = await computeWinnerIndexOnChain(voting);
        const slots = await getSlots();
        const slot = slots.find(s => s.index === winnerIndex && s.hasContent);
        if (!slot) {
          console.warn('[relayer] Winner slot has no content; skipping this cycle');
        } else {
          const tokenURI = slot.tokenURI;
          const svgBase64 = await fetchSvgBase64FromTokenURI(tokenURI);
          if (!svgBase64) {
            console.warn('[relayer] Empty svgBase64; skipping finalize');
          } else {
            const tx = await voting.finalizeWithWinner(tokenURI, svgBase64, winnerIndex);
            console.log('[relayer] finalize tx sent:', tx.hash);
            await tx.wait();
            console.log('[relayer] finalized');
          }
        }
      }
    } catch (e) {
      console.error('[relayer] loop error', e.message);
    }
    await sleep(10000);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
