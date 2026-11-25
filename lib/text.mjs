import { createHash } from 'node:crypto';

/** Loose normalization used for matching guesses and de-duplicating questions. */
export function normalize(s) {
  let t = String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(a|an|the|my|some) /, '');
  // crude singularization of the last word: "tacos" -> "taco", "berries" -> "berry"
  t = t.replace(/(\w{3,})ies$/, '$1y').replace(/(\w{3,}[^s])s$/, '$1');
  return t;
}

export function questionId(text) {
  return createHash('sha1').update(normalize(text)).digest('hex').slice(0, 12);
}

export function cleanLabel(s, max = 40) {
  const t = String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  // Capitalize word starts without touching letters after apostrophes ("Levi's", not "Levi'S").
  return t.replace(/(^|[\s\-/(])([a-z])/g, (m, pre, c) => pre + c.toUpperCase());
}

/** Deterministic 32-bit hash -> [0, 1). */
export function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

// Hard blocklist: anything matching is dropped, no matter what the AI reviewer said.
const BLOCKED = /\b(shoot(er|ers|ing|ings)|gun ?man|massacre|terroris\w*|suicid\w*|self[- ]harm|overdos\w*|murder\w*|rape\w*|genocide|holocaust|nazi\w*|9\/11|hostage|lockdown drill|active shooter|cancer|funeral|abuse\w*|porn\w*|sexy|nude\w*|cocaine|heroin|meth|drunk\w*|hangover|beer|wine|vodka|alcohol\w*|vap(e|es|ing)|cigarett\w*|weed|hooters|bikini|slur\w*)\b/i;

export function isBlocked(q) {
  return BLOCKED.test(q.text) || q.answers.some((a) => BLOCKED.test(a.label));
}

/** Validate and tidy one generated question. Returns null if it is unusable. */
export function sanitizeQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const text = String(q.text || '').replace(/\s+/g, ' ').trim();
  if (text.length < 15 || text.length > 150) return null; // short questions for younger players
  if (!Array.isArray(q.answers)) return null;

  const seen = new Set();
  const answers = [];
  for (const a of q.answers) {
    const label = cleanLabel(a?.label);
    const share = Math.round(Number(a?.share));
    const key = normalize(label);
    if (!label || !key || !Number.isFinite(share) || share <= 0 || share > 100 || seen.has(key)) continue;
    seen.add(key);
    answers.push({ label, share });
  }
  if (answers.length < 4 || answers.length > 8) return null;
  if (isBlocked({ text, answers })) return null;

  const sum = answers.reduce((s, a) => s + a.share, 0);
  if (sum < 50 || sum > 130) return null;
  if (sum > 100) answers.forEach((a) => { a.share = Math.max(1, Math.round((a.share * 100) / sum)); });
  answers.sort((a, b) => b.share - a.share);

  return { type: tierFor(q.type, answers[0].share), text, answers };
}

// Rarity tiers, common -> rare.
export const TIERS = ['pleco', 'schooler', 'reef', 'deep'];
const TIER_RANGES = { pleco: [50, 101], schooler: [36, 60], reef: [24, 46], deep: [0, 34] };

/** Keep a question's tier honest: it must match how dominant its top answer is. */
export function tierFor(declared, topShare) {
  const byShare = topShare >= 55 ? 'pleco' : topShare >= 42 ? 'schooler' : topShare >= 28 ? 'reef' : 'deep';
  let type = TIER_RANGES[declared] ? declared : byShare;
  // Questions written before the Schooler tier existed: the lower Plecos and upper Reefs become Schoolers.
  if (type === 'pleco' && topShare < 55) type = 'schooler';
  if (type === 'reef' && topShare >= 45) type = 'schooler';
  const [lo, hi] = TIER_RANGES[type];
  return topShare < lo || topShare >= hi ? byShare : type;
}
