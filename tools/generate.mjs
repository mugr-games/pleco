// Pleco question generator.
// Usage:
//   node tools/generate.mjs                 full run (resumes where it left off)
//   node tools/generate.mjs --jobs 2        only run 2 batches (for testing)
//   node tools/generate.mjs --workers 4     parallel requests (default 6)
//
// Writes one JSON line per question into data/generated/<category>.jsonl.
// Progress is tracked in data/generated/progress.json so the run can be stopped and resumed.
import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat, extractJSON, hasKey, SMART_MODEL } from '../lib/ai.mjs';
import { normalize, questionId, sanitizeQuestion } from '../lib/text.mjs';
import { CATEGORIES, AUDIENCE } from '../lib/categories.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN_DIR = path.join(ROOT, 'data', 'generated');
const SUBTOPICS_FILE = path.join(ROOT, 'data', 'subtopics.json');
const PROGRESS_FILE = path.join(GEN_DIR, 'progress.json');

const args = process.argv.slice(2);
const argNum = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const MAX_JOBS = argNum('--jobs', Infinity);
const WORKERS = argNum('--workers', 6); // NVIDIA's free tier starts returning 429s around 10
const SUBTOPICS_PER_CATEGORY = 25;
const PER_BATCH = { pleco: 6, schooler: 6, reef: 6, deep: 6 }; // ~24 per batch, ~12k raw -> ~10k after review

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label) {
  let delay = 4000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // Rate limits (429) are temporary: keep waiting (up to ~2 min each time) instead of giving up.
      const limit = err.status === 429 ? 8 : 4;
      if (attempt >= limit) throw err;
      const wait = err.status === 429 ? Math.min(120000, 15000 * attempt + Math.random() * 5000) : delay;
      console.warn(`  retry ${attempt} for ${label}: ${String(err.message).slice(0, 120)} (waiting ${wait / 1000}s)`);
      await sleep(wait);
      delay *= 2;
    }
  }
}

// ---------- step 1: subtopics ----------
async function loadSubtopics() {
  const map = existsSync(SUBTOPICS_FILE) ? JSON.parse(await readFile(SUBTOPICS_FILE, 'utf8')) : {};
  for (const cat of CATEGORIES) {
    if (Array.isArray(map[cat.id]) && map[cat.id].length >= 10) continue;
    console.log(`Listing subtopics for ${cat.name}...`);
    const list = await withRetry(async () => {
      const text = await chat({
        model: SMART_MODEL,
        system: 'You plan content for a survey party game. Output only JSON.',
        user: `The players are ${AUDIENCE}.
Category: ${cat.name} (${cat.hint}).
List ${SUBTOPICS_PER_CATEGORY} distinct, concrete subtopics inside this category that would each support 20+ easy, specific "what would most people say" SURVEY questions about opinions, favourites, habits, experiences, pet peeves and first reactions (NOT facts to look up).
Every subtopic must be something a typical middle or high school student knows and has experienced. Nothing about adult life (jobs, offices, bills, taxes, mortgages, parenting, alcohol, dating details, expensive designer items).
Phrase each subtopic around kids and teens, e.g. "first night in a new Minecraft world", "snacks people sneak into class", "things you do when the teacher leaves the room".
Return {"subtopics": [short strings]}.`,
        maxTokens: 1500,
        temperature: 0.7,
        timeoutMs: 120000,
        schema: SUBTOPICS_SCHEMA,
      });
      const arr = (extractJSON(text, 'object').subtopics || []).map((s) => String(s).trim()).filter(Boolean);
      if (arr.length < 10) throw new Error('too few subtopics');
      return [...new Set(arr)].slice(0, SUBTOPICS_PER_CATEGORY);
    }, `subtopics ${cat.id}`);
    map[cat.id] = list;
    await writeFile(SUBTOPICS_FILE, JSON.stringify(map, null, 2));
  }
  return map;
}

// ---------- step 2: questions ----------
const WRITER_SYSTEM = `You write questions for Pleco, a survey party game: each player types the answer they think MOST people would give, and scores by matching the crowd.

AUDIENCE: ${AUDIENCE}. Every question must be EASY to understand and answer for a typical 11-18 year old.
- Short and simple: one sentence, under 15 words if possible, everyday words a 6th grader knows.
- Only things kids and teens know and experience: school, friends, family, phones, popular games, shows, music, snacks, sports, holidays.
- Nothing about adult life (jobs, offices, bills, taxes, parenting, alcohol, coffee habits, dating details, expensive designer items, driving to work).
- Nothing that changes every season or update (current map locations, limited-time events, this season's items, current rankings), so questions stay true for years.
- No obscure or old references a teen would not know (no deep cuts from before 2005 unless they are still famous today, like Mario or SpongeBob).

These are SURVEY questions, NOT trivia. There is no single correct answer: many answers are valid, and the goal is to guess the MOST POPULAR one. Good forms: "Name a...", "What's the first thing you...", "Which ... do people ... the most?", "What would you...". Ask about opinions, habits, experiences, associations and favourites.
Bad (trivia, has a lookup answer): "What colour wool does a pink sheep drop?", "Which Jordan colourway is called Bred?", "What food breeds pigs?".
Never write trivia. Every question must ask what people would SAY, CHOOSE, PICK, DO, HATE or LOVE.

Every question must be SPECIFIC: a narrow, concrete situation, never generic.
- Generic (bad): "Name a Minecraft mob."
- Specific (good): "Name a Minecraft mob you'd least want to hear behind you while mining."
It must be answerable by typing a short answer (1-4 words). No yes/no questions, no numbers.

Two types:
Four rarity tiers, common -> rare (all must be EASY to understand; the tier is about how spread out the answers are, not about hard knowledge):
- "pleco" (common): super popular; almost every student would agree (top answer share 55-85%).
  e.g. "Name the first thing you craft in a new Minecraft world." -> Crafting Table 65, Wooden Pickaxe 15, ...
- "schooler" (uncommon): most people go with the crowd, but a real chunk pick something else (top answer share 42-55%).
  e.g. "What's the worst school lunch?" -> Mystery Meat 45, Fish Sticks 20, Meatloaf 12, ...
- "reef" (rare): a favourite exists but it's close (top answer share 28-42%).
  e.g. "Name a Minecraft mob you'd least want to see at night." -> Creeper 35, Enderman 25, Skeleton 15, ...
- "deep" (epic): more specific, answers are spread out, you really have to think about what most people would say (top answer share 15-28%).
  e.g. "Name a snack people sneak into class." -> Chips 24, Gummy Bears 20, Candy 15, Granola Bar 12, ...
  "Deep" means more thinking, NOT harder knowledge. Any student who plays/watches/does the thing could answer.

Only mention things that really exist. Never invent game mechanics, items, characters, events or people. Answers must be real, well-known things that actual players/fans would type.
This is a family-friendly party game. NEVER touch: shootings, weapons used on people, emergencies or disasters, death, illness, crime, drugs, alcohol abuse, sexual content, slurs, politics, religion, or anything upsetting.

Each question has 5-7 answers with an estimated % of people giving each (shares sum to 80-100).
Answer labels: plain words someone would actually type, 1-3 words, distinct. No slashes, no parentheses, no jokey nicknames.
  Good: "Phone", "Water Bucket", "Coffee". Bad: "The Phone-Absorbed Drifter", "Water Bucket (MLG)", "Dog Bites / Attacks".
Output JSON: {"questions":[{"type":"pleco"|"schooler"|"reef"|"deep","text":"...","answers":[{"label":"...","share":n}]}]}`;

const REVIEW_SYSTEM = `You are a strict fact-checker and editor for a survey party game played by ${AUDIENCE}. Output only JSON.`;

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['pleco', 'schooler', 'reef', 'deep'] },
          text: { type: 'string' },
          answers: {
            type: 'array',
            items: {
              type: 'object',
              properties: { label: { type: 'string' }, share: { type: 'integer' } },
              required: ['label', 'share'],
            },
          },
        },
        required: ['type', 'text', 'answers'],
      },
    },
  },
  required: ['questions'],
};
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        properties: { index: { type: 'integer' }, ok: { type: 'boolean' }, reason: { type: 'string' } },
        required: ['index', 'ok', 'reason'],
      },
    },
  },
  required: ['reviews'],
};
const SUBTOPICS_SCHEMA = {
  type: 'object',
  properties: { subtopics: { type: 'array', items: { type: 'string' } } },
  required: ['subtopics'],
};

async function writeBatch(cat, subtopic) {
  const text = await chat({
    model: SMART_MODEL,
    system: WRITER_SYSTEM,
    user: `Category: ${cat.name} - Subtopic: "${subtopic}".
Write ${Object.values(PER_BATCH).reduce((a, b) => a + b, 0)} questions: ${PER_BATCH.pleco} "pleco", ${PER_BATCH.schooler} "schooler", ${PER_BATCH.reef} "reef" and ${PER_BATCH.deep} "deep". Every question must be clearly different from the others.`,
    maxTokens: 9000,
    temperature: 0.85,
    timeoutMs: 240000,
    schema: QUESTIONS_SCHEMA,
  });
  const out = extractJSON(text, 'object');
  if (!Array.isArray(out.questions)) throw new Error('no questions array');
  return out.questions;
}

// Returns the set of indices to DROP. A question survives only if the reviewer explicitly marks it ok.
async function reviewBatch(cat, questions) {
  const numbered = questions.map((q, i) => `${i}. [${q.type}] ${q.text} -> ${q.answers.map((a) => a.label).join(' | ')}`).join('\n');
  const text = await chat({
    model: SMART_MODEL,
    system: REVIEW_SYSTEM,
    user: `Category: ${cat.name}. Review each survey-game question. Mark ok=false ONLY if it has a clear problem:
- a factual error or false premise (a game mechanic, item, character or event that does not exist),
- an answer that is made up or does not exist,
- trivia: it has an objectively correct answer you could look up (a name, colour, item, date, recipe) instead of asking what most people would SAY or CHOOSE,
- too vague or generic,
- is too hard, too long or confusing for a typical middle or high school student, uses hard words, or needs knowledge most teens would not have,
- is about adult life (jobs, bills, parenting, alcohol, dating details, expensive designer items),
- could be offensive or upsetting, or touches violence, shootings, emergencies, death, illness, crime, drugs, sex, politics or religion.
Otherwise ok=true.

${numbered}

Return {"reviews":[{"index":n,"ok":bool,"reason":"short"}]} for every question.`,
    maxTokens: 4000,
    temperature: 0,
    timeoutMs: 180000,
    schema: REVIEW_SCHEMA,
  });
  const out = extractJSON(text, 'object');
  const okSet = new Set((out.reviews || []).filter((r) => r && r.ok === true).map((r) => Number(r.index)));
  const drop = new Set();
  questions.forEach((_, i) => { if (!okSet.has(i)) drop.add(i); });
  return drop;
}

async function main() {
  if (!hasKey()) {
    console.error('NVIDIA_API_KEY is not set. Set it first: setx NVIDIA_API_KEY "your-key"');
    process.exit(1);
  }
  await mkdir(GEN_DIR, { recursive: true });
  const subtopics = await loadSubtopics();
  const progress = existsSync(PROGRESS_FILE) ? JSON.parse(await readFile(PROGRESS_FILE, 'utf8')) : { done: [] };
  const done = new Set(progress.done);

  // Known question texts across all categories, for de-duplication.
  const seenText = new Set();
  let total = 0;
  for (const cat of CATEGORIES) {
    const file = path.join(GEN_DIR, `${cat.id}.jsonl`);
    if (!existsSync(file)) continue;
    for (const line of (await readFile(file, 'utf8')).split('\n')) {
      if (!line.trim()) continue;
      try { seenText.add(normalize(JSON.parse(line).text)); total++; } catch { /* skip bad line */ }
    }
  }

  // Interleave jobs across categories so a partial run still has variety.
  const jobs = [];
  for (let i = 0; i < SUBTOPICS_PER_CATEGORY; i++) {
    for (const cat of CATEGORIES) {
      const sub = subtopics[cat.id]?.[i];
      if (!sub) continue;
      const key = `${cat.id}::${sub}`;
      if (!done.has(key)) jobs.push({ cat, sub, key });
    }
  }
  const queue = jobs.slice(0, MAX_JOBS);
  const queueTotal = queue.length;
  console.log(`${total} questions already saved. ${jobs.length} batches left; running ${queueTotal} with ${WORKERS} workers on ${SMART_MODEL}.`);

  let finished = 0, kept = 0, rejected = 0;
  const started = Date.now();
  let saveChain = Promise.resolve();

  async function worker() {
    while (queue.length) {
      const job = queue.shift();
      try {
        const raw = await withRetry(() => writeBatch(job.cat, job.sub), job.key);
        const valid = raw.map(sanitizeQuestion).filter(Boolean);
        let bad = new Set();
        try { bad = await withRetry(() => reviewBatch(job.cat, valid), `review ${job.key}`); }
        catch (e) { console.warn(`  review failed for ${job.key}, keeping batch unreviewed: ${e.message}`); }

        const lines = [];
        valid.forEach((q, i) => {
          if (bad.has(i)) { rejected++; return; }
          const norm = normalize(q.text);
          if (seenText.has(norm)) { rejected++; return; }
          seenText.add(norm);
          lines.push(JSON.stringify({ id: questionId(q.text), category: job.cat.id, subtopic: job.sub, ...q }));
        });
        rejected += raw.length - valid.length;
        kept += lines.length;
        console.log(`  ${job.key}: ${raw.length} written, ${valid.length} well-formed, ${bad.size} flagged by review, ${lines.length} kept`);

        // Serialize file writes so progress and data never disagree.
        saveChain = saveChain.then(async () => {
          if (lines.length) await appendFile(path.join(GEN_DIR, `${job.cat.id}.jsonl`), lines.join('\n') + '\n');
          done.add(job.key);
          await writeFile(PROGRESS_FILE, JSON.stringify({ done: [...done] }));
        });
        await saveChain;
      } catch (err) {
        console.error(`  FAILED ${job.key}: ${err.message}`);
      }
      finished++;
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      console.log(`[${finished}/${queueTotal}] ${job.key} | total saved: ${total + kept} | rejected: ${rejected} | ${mins} min`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, worker));
  console.log(`Done. ${total + kept} questions saved in total (${kept} new, ${rejected} rejected).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
