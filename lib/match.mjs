// Snaps a player's guess to the closest answer already on the board, without the AI.
// Handles typos ("minecraf", "fortnight"), spacing ("sponge bob"), plurals, sound-alike
// spellings ("fone"), and longer/shorter wordings ("chocolate chip granola bar" -> "Chocolate Chip").
// It is careful NOT to merge different answers that merely look alike
// ("Soy Sauce" vs "Hot Sauce", "2 Miles" vs "3 Miles", "Almond Milk" vs "Milk").
import { normalize } from './text.mjs';

const FILLER = new Set(['a', 'an', 'the', 'my', 'some', 'of', 'and', 'n', 'or', 'to', 'in', 'on', 'with', 'for', 'i', 'it', 'is', 'just', 'probably', 'definitely', 'maybe', 'like', 'really', 'very', 'you', 'your', 'do', 'what', 'which', 'most', 'people']);
const NEG = new Set(['no', 'not', 'none', 'never', 'without', 'nothing', 'dont', 'don', 'nope']);

const singular = (w) => w.replace(/(\w{2,})ies$/, '$1y').replace(/(\w{2,}[^s])s$/, '$1');
const words = (s) => normalize(s).split(' ').filter((w) => w && !FILLER.has(w)).map(singular);
const compact = (s) => words(s).join('');
/** Spelling-insensitive key: "The Sponge Bobs" and "spongebob" give the same key. */
export const compactKey = compact;

// Rough "sounds like" spelling of one word: fortnight~fortnite, fone~phone, kool~cool, pizza~piza.
const sound = (w) => w.replace(/(\w{2})e$/, '$1') // silent final e: space~spac, fortnite~fortnit
  .replace(/ght/g, 't').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/^kn/, 'n').replace(/^wr/, 'r')
  .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/z/g, 's').replace(/(.)\1+/g, '$1');

/** Edit distance, giving up early (returns cap + 1) once it can't be <= cap. */
export function editDistance(a, b, cap = 3) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (next[j] < best) best = next[j];
    }
    if (best > cap) return cap + 1;
    row = next;
  }
  return row[b.length];
}

/** 0 = identical, 1-2 = typo distance, Infinity = different words. Numbers must match exactly. */
function wordGap(a, b) {
  if (a === b) return 0;
  if (/\d/.test(a) || /\d/.test(b)) return Infinity;
  const sa = sound(a), sb = sound(b);
  if (sa.length >= 3 && sa === sb) return 0.5;
  const n = Math.min(a.length, b.length);
  const allow = n >= 9 ? 2 : n >= 5 ? 1 : 0;
  if (!allow) return Infinity;
  const d = Math.min(editDistance(a, b, allow), editDistance(sa, sb, allow));
  return d <= allow ? d : Infinity;
}

const covers = (big, small) => small.every((w) => big.some((x) => wordGap(x, w) < Infinity));

/**
 * Returns the group (with .label, .count, optional .aliases) the guess most likely means, or null.
 * `question` (optional) lets extra words that just repeat the question be ignored
 * ("ankle socks" -> "Ankle" when the question is about socks).
 */
export function closestAnswer(groups, guess, question = '') {
  const g = normalize(guess);
  if (!g) return null;
  const gc = compact(guess);
  if (!gc) return null;

  // 1. Exact, a remembered alias, or the same letters ignoring spaces/filler/plurals.
  for (const grp of groups) if (normalize(grp.label) === g || grp.aliases?.includes(g)) return grp;
  for (const grp of groups) if (compact(grp.label) === gc) return grp;

  const qWords = new Set(words(question));
  const gw = words(guess);
  const negated = (ws) => ws.some((w) => NEG.has(w));

  // 2. Same words, with small typos: word by word, same number of words.
  let best = null, bestGap = Infinity;
  for (const grp of groups) {
    const lw = words(grp.label);
    if (lw.length !== gw.length) continue;
    let gap = 0;
    for (let i = 0; i < lw.length && gap < Infinity; i++) gap += wordGap(gw[i], lw[i]);
    if (gap < bestGap || (gap === bestGap && best && grp.count > best.count)) { best = grp; bestGap = gap; }
  }
  if (best && bestGap < Infinity) return best;

  // 3. Longer or shorter wording of the same answer.
  const longer = [], shorter = [];
  for (const grp of groups) {
    const lw = words(grp.label);
    if (!lw.length || negated(lw) !== negated(gw)) continue; // "no socks" is not "Socks"
    // Same words in a different order ("honey oats" -> "Oats And Honey").
    if (gw.length === lw.length && covers(gw, lw) && covers(lw, gw)) longer.push(grp);
    // Guess says more ("chocolate chip granola bar"): only OK if the extra words come from the question.
    if (gw.length > lw.length && covers(gw, lw)) {
      const extra = gw.filter((w) => !lw.some((x) => wordGap(x, w) < Infinity));
      if (extra.every((w) => qWords.has(w))) longer.push(grp);
    }
    // Guess says less ("free robux" -> "I Got Free Robux", "Leia" -> "Princess Leia"):
    // it must cover at least half of the answer and point at only one answer.
    if (gw.length < lw.length && covers(lw, gw) && gw.length * 2 >= lw.length && gw.join('').length >= 4) shorter.push(grp);
  }
  if (longer.length) return longer.sort((a, b) => words(b.label).length - words(a.label).length || b.count - a.count)[0];
  if (shorter.length === 1) return shorter[0];
  return null; // let the AI decide (or count it as a new answer)
}
