import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(VOTES_FILE)) fs.writeFileSync(VOTES_FILE, JSON.stringify({}), 'utf8');
}

export function readVotes() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(VOTES_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

export function writeVotes(obj) {
  ensureDataDir();
  fs.writeFileSync(VOTES_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

export function recordVote({ sessionId, address, index, timestamp }) {
  const votes = readVotes();
  const key = String(sessionId);
  if (!votes[key]) votes[key] = { byAddress: {}, counts: {}, events: [] };
  const sess = votes[key];
  if (sess.byAddress[address]) {
    return { ok: false, error: 'already voted' };
  }
  sess.byAddress[address] = index;
  sess.counts[index] = (sess.counts[index] || 0) + 1;
  sess.events.push({ address, index, timestamp });
  writeVotes(votes);
  return { ok: true };
}

export function computeWinner(sessionId) {
  const votes = readVotes();
  const key = String(sessionId);
  const sess = votes[key];
  if (!sess) return { index: 0, votes: 0, tieBreakTs: 0 };
  // Build tallies for 20 slots, tie-break by earliest last vote timestamp
  const counts = new Array(20).fill(0);
  for (const k of Object.keys(sess.counts || {})) {
    counts[Number(k)] = sess.counts[k];
  }
  // compute last vote timestamp per index (earliest last vote wins on tie)
  const lastTs = new Array(20).fill(Number.MAX_SAFE_INTEGER);
  for (const ev of sess.events) {
    const idx = Number(ev.index);
    lastTs[idx] = Math.min(lastTs[idx], ev.timestamp);
  }
  let winner = 0;
  let maxVotes = counts[0];
  let earliest = lastTs[0];
  for (let i = 1; i < 20; i++) {
    const v = counts[i];
    if (v > maxVotes) {
      maxVotes = v;
      winner = i;
      earliest = lastTs[i];
    } else if (v === maxVotes) {
      if (lastTs[i] < earliest) {
        winner = i;
        earliest = lastTs[i];
      }
    }
  }
  return { index: winner, votes: maxVotes || 0, tieBreakTs: earliest };
}
