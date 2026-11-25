// ================= Pleco — browser game =================
import { sfx } from './sfx.js';

// ---------- animated pixel sea background ----------
function startSea() {
  const canvas = document.getElementById('sea');
  const ctx = canvas.getContext('2d');
  const W = 192;
  let H = 108;
  const bubbles = [];
  const weeds = [];
  const fish = { x: 20, dir: 1 };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const swimmer = document.getElementById('swimmer');

  function resize() {
    H = Math.max(80, Math.round((W * innerHeight) / innerWidth));
    canvas.width = W; canvas.height = H;
    weeds.length = 0;
    for (let i = 0; i < 9; i++) weeds.push({ x: 8 + Math.floor((i * W) / 9 + ((i * 37) % 11)), h: 10 + ((i * 7) % 14), phase: i });
  }
  resize();
  addEventListener('resize', resize);

  const bands = ['#123a52', '#10334a', '#0e2d42', '#0c263a', '#0b2133', '#0a1c2c', '#091827'];

  function draw(t) {
    const bandH = Math.ceil(H / bands.length);
    bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bandH, W, bandH); });

    // light shafts
    ctx.fillStyle = 'rgba(120, 220, 230, 0.04)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 53 + Math.floor(t / 400)) % (W + 40)) - 20;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 30, H); ctx.lineTo(x + 16, H); ctx.fill();
    }

    // sand
    const sandY = H - 8;
    ctx.fillStyle = '#3a3222'; ctx.fillRect(0, sandY, W, 8);
    ctx.fillStyle = '#4f4430'; ctx.fillRect(0, sandY, W, 2);
    ctx.fillStyle = '#2a2418';
    for (let x = 3; x < W; x += 11) ctx.fillRect(x, sandY + 4 + (x % 3), 2, 1);

    // seaweed
    for (const w of weeds) {
      for (let y = 0; y < w.h; y++) {
        const sway = reduce ? 0 : Math.round(Math.sin(t / 700 + w.phase + y / 4) * (y / 6));
        ctx.fillStyle = y % 3 === 0 ? '#1f6b4a' : '#2a8a5c';
        ctx.fillRect(w.x + sway, sandY - y, 2, 1);
      }
    }

    // bubbles
    if (!reduce && Math.random() < 0.08) bubbles.push({ x: Math.floor(Math.random() * W), y: H, s: Math.random() < 0.3 ? 2 : 1, v: 0.15 + Math.random() * 0.25 });
    ctx.fillStyle = 'rgba(200, 240, 255, 0.55)';
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= b.v;
      const wob = Math.round(Math.sin((b.y + b.x) / 6));
      ctx.fillRect(Math.round(b.x + wob), Math.round(b.y), b.s, b.s);
      if (b.y < -2) bubbles.splice(i, 1);
    }

    // the pleco (your pixel art), cruising along the sea floor
    if (!reduce) {
      fish.x += 0.12 * fish.dir;
      if (fish.x > W - 22) fish.dir = -1;
      if (fish.x < 2) fish.dir = 1;
    }
    const scale = innerWidth / W;
    const bob = Math.floor(t / 500) % 2;
    // The art faces left, so mirror it while swimming right.
    swimmer.style.transform = `translate(${Math.round(fish.x * scale)}px, ${-Math.round((8 - 1 + bob) * (innerHeight / H))}px) scaleX(${fish.dir === 1 ? -1 : 1})`;
  }

  let last = 0;
  function loop(t) {
    if (t - last > 66) { draw(t); last = t; } // ~15 fps keeps the chunky retro feel
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function show(screen) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${screen}`));
  window.scrollTo({ top: 0 });
}

const TIER_ICONS = { pleco: 'tiers/pleco.png', schooler: 'tiers/schooler.png', reef: 'tiers/reef-crab.png', deep: 'tiers/deep-angler.png' };

const TIER_NAMES = { pleco: 'PLECO', schooler: 'SCHOOLER', reef: 'REEF', deep: 'DEEP' };
const TIER_COLORS = { pleco: '#ffd166', schooler: '#8fb8ff', reef: '#ff8a5c', deep: '#b892ff' };

// ---------- effects ----------
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, REDUCED ? 0 : ms));

/** Restart a CSS animation class on an element. */
function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Count a number up in chunky steps. */
function countUp(el, to, ms = 600, from = 0, suffix = '') {
  if (REDUCED || to === from) { el.textContent = to + suffix; return Promise.resolve(); }
  const steps = Math.max(4, Math.min(16, Math.round(ms / 50)));
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      i++;
      el.textContent = Math.round(from + ((to - from) * i) / steps) + suffix;
      if (i < steps) setTimeout(tick, ms / steps); else resolve();
    };
    tick();
  });
}

/** Burst of square pixel particles from the center of an element. */
function burst(el, colors, count = 24, spread = 140) {
  if (REDUCED || !el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const size = [4, 6, 8][i % 3];
    p.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;background:${colors[i % colors.length]}`;
    $('fx').appendChild(p);
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = spread * (0.5 + Math.random() * 0.6);
    p.animate(
      [
        { transform: 'translate(-50%,-50%)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist + 30}px))`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 300, easing: 'steps(8)' }
    ).onfinish = () => p.remove();
  }
}

/** Rising bubbles from an element (for misses). */
function bubbles(el, count = 10) {
  if (REDUCED || !el) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const b = document.createElement('i');
    b.className = 'bubble';
    b.style.cssText = `left:${r.left + Math.random() * r.width}px;top:${r.top + r.height / 2}px`;
    $('fx').appendChild(b);
    b.animate(
      [{ transform: 'translateY(0)', opacity: 0.9 }, { transform: `translateY(-${60 + Math.random() * 60}px)`, opacity: 0 }],
      { duration: 900 + Math.random() * 500, delay: i * 40, easing: 'steps(6)', fill: 'backwards' }
    ).onfinish = () => b.remove();
  }
}

/** "+125" flies from the banner up to the HUD score. */
function flyPoints(fromEl, toEl, text) {
  if (REDUCED) return Promise.resolve();
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const f = document.createElement('span');
  f.className = 'fly-pts';
  f.textContent = text;
  f.style.cssText = `left:${a.left + a.width / 2}px;top:${a.top + a.height / 2}px`;
  $('fx').appendChild(f);
  const anim = f.animate(
    [
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 40}px)) scale(1.4)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.6)`, opacity: 0.2 },
    ],
    { duration: 700, easing: 'steps(10)' }
  );
  return anim.finished.then(() => f.remove());
}

function setTierIcon(img, type) {
  img.src = TIER_ICONS[type] || TIER_ICONS.pleco;
  img.alt = `${TIER_NAMES[type] || ''} tier`;
  img.classList.remove('pleco', 'schooler', 'reef', 'deep');
  img.classList.add(type);
}

const MARK = (r) => (!r.valid || r.points === 0 ? '⬛' : r.rank === 1 ? '🥇' : r.rank <= 3 ? '🐟' : '🫧');

// ---------- state ----------
const state = {
  mode: 'daily', // 'daily' | 'practice'
  day: 0,
  categoryName: '',
  questions: [],
  index: 0,
  score: 0,
  results: [],
  answered: false,
};

const dailyKey = (day) => `pleco-daily-${day}`;

// ---------- home ----------
async function renderHome() {
  show('home');
  const date = localDate();
  try {
    const status = await api(`/api/status?date=${date}`);
    state.day = status.day;
    $('day-label').textContent = `#${status.day}`;
    $('bank-status').textContent = `${status.questions.toLocaleString()} questions in the tank` + (status.ai ? '' : ' · AI judge offline');

    const saved = JSON.parse(localStorage.getItem(dailyKey(status.day)) || 'null');
    const action = $('daily-action');
    if (saved) {
      action.innerHTML = `
        <div class="done-box">
          <p class="muted">You already dove today. New dive at midnight.</p>
          <div class="big-score"><span>${saved.score}</span><small>/ ${saved.max}</small></div>
          ${saved.cards ? `<div class="end-cards mini">${saved.cards.map(cardHTML).join('')}</div>` : `<div class="marks">${saved.marks.join('')}</div>`}
          <button class="btn gold" id="share-saved">COPY RESULT</button>
          <p id="share-saved-msg" class="msg ok center"></p>
        </div>`;
      $('share-saved').onclick = () => copyShare(saved, $('share-saved-msg'));
    } else if (status.questions === 0) {
      action.innerHTML = `<p class="muted">The questions are still being written. Check back in a minute!</p>`;
    } else {
      action.innerHTML = `<button class="btn gold big" id="start-daily">START TODAY'S DIVE ▶</button>`;
      $('start-daily').onclick = startDaily;
    }

    const cats = await api('/api/categories');
    $('categories').innerHTML = cats
      .map((c) => `<button class="cat" data-id="${esc(c.id)}" ${c.count ? '' : 'disabled'} title="${c.count} questions"><span class="ico">${esc(c.icon)}</span><span>${esc(c.name)}</span></button>`)
      .join('');
    $('categories').querySelectorAll('.cat').forEach((b) => (b.onclick = () => startPractice(b.dataset.id, b.textContent.trim())));
  } catch (err) {
    $('daily-action').innerHTML = `<p class="msg">Can't reach the Pleco server: ${esc(err.message)}</p>`;
  }
}

async function startDaily() {
  const data = await api(`/api/daily?date=${localDate()}`);
  startRound('daily', data.questions, '');
}

async function startPractice(id, name) {
  const data = await api(`/api/practice?category=${encodeURIComponent(id)}`);
  startRound('practice', data.questions, name);
}

function startRound(mode, questions, categoryName) {
  if (!questions.length) return;
  Object.assign(state, { mode, questions, categoryName, index: 0, score: 0, results: [] });
  show('play');
  renderQuestion();
}

// ---------- play ----------
function renderQuestion() {
  const q = state.questions[state.index];
  state.answered = false;
  $('q-type').textContent = q.type.toUpperCase();
  $('q-type').className = `badge ${q.type}`;
  setTierIcon($('q-tier-icon'), q.type);
  $('q-tier-icon').classList.add('tier-anim');
  replay($('q-tier-icon'), 'swim-in');
  replay(document.querySelector('.question-panel'), 'panel-enter');
  sfx.tier(q.type);
  $('q-cat').textContent = `${q.icon || ''} ${q.categoryName || ''}`;
  $('q-count').textContent = `${state.index + 1}/${state.questions.length}`;
  $('q-text').textContent = q.text;
  $('hud-score').textContent = state.score;
  $('progress-bar').style.width = `${(state.index / state.questions.length) * 100}%`;
  $('guess-msg').textContent = '';
  $('guess-msg').className = 'msg';
  $('reveal').hidden = true;
  $('guess-form').hidden = false;
  const input = $('guess-input');
  input.value = '';
  input.disabled = false;
  $('guess-btn').disabled = false;
  input.focus();
}

async function submitGuess(e) {
  e.preventDefault();
  if (state.answered) return;
  const q = state.questions[state.index];
  const guess = $('guess-input').value.trim();
  if (!guess) { $('guess-msg').textContent = 'Type an answer first.'; sfx.invalid(); replay($('guess-form'), 'shake'); return; }
  sfx.submit();

  $('guess-input').disabled = true;
  $('guess-btn').disabled = true;
  $('guess-msg').className = 'msg ok';
  $('guess-msg').textContent = 'Asking the school…';

  try {
    const r = await api('/api/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, guess }),
    });
    if (!r.valid) {
      $('guess-msg').className = 'msg';
      $('guess-msg').textContent = r.reason || 'Try another answer.';
      replay($('guess-form'), 'shake');
      sfx.invalid();
      $('guess-input').disabled = false;
      $('guess-btn').disabled = false;
      $('guess-input').select();
      return;
    }
    state.answered = true;
    state.score += r.points;
    state.results.push(r);
    showReveal(q, r);
  } catch (err) {
    $('guess-msg').className = 'msg';
    $('guess-msg').textContent = err.message;
    $('guess-input').disabled = false;
    $('guess-btn').disabled = false;
  }
}

async function showReveal(q, r) {
  $('guess-msg').textContent = '';
  $('guess-form').hidden = true;
  $('progress-bar').style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
  const color = TIER_COLORS[q.type];

  // Banner: tier creature, rank, your answer, points.
  const banner = $('result-banner');
  banner.className = `result-banner ${q.type} ${r.rank === 1 ? 'top' : r.isNew || r.points === 0 ? 'miss' : 'mid'}`;
  setTierIcon($('rb-tier'), q.type);
  $('rb-rank').textContent = r.rank === 1 ? '#1 ANSWER!' : r.isNew ? 'NEW ANSWER' : `#${r.rank} ANSWER`;
  $('rb-label').textContent = r.rank === 1
    ? `"${r.yourLabel}" — you think like the school!`
    : r.isNew ? `Nobody said "${r.yourLabel}" yet.` : `"${r.yourLabel}"`;
  $('rb-points').textContent = '+0';

  // Board header with the tier icon.
  setTierIcon($('bh-icon'), q.type);
  $('bh-title').textContent = `${TIER_NAMES[q.type]} BOARD`;
  $('bh-title').style.color = color;

  $('board').innerHTML = r.board
    .map((b, i) => `
      <li class="${b.rank === 1 ? 'first' : ''} ${b.yours ? 'yours' : ''}" style="--i:${i}">
        <span class="fill" data-w="${b.pct}"></span>
        <span class="rk">${b.rank === 1 ? '★1' : '#' + b.rank}</span>
        <span class="lbl">${esc(b.label)}</span>
        ${b.yours ? '<span class="you">YOU</span>' : ''}
        <span class="pct" data-pct="${b.pct}">0%</span>
      </li>`)
    .join('');
  $('crowd-note').textContent = r.players < 5
    ? 'Early board: mostly AI estimates until more players answer.'
    : `${r.players.toLocaleString()} players have answered this one.`;
  $('next-btn').textContent = state.index + 1 >= state.questions.length ? 'FINISH ▶' : 'NEXT ▶';
  $('reveal').hidden = false;
  replay(banner, 'banner-in');

  // Rows fill one after another and their percentages count up.
  $('board').querySelectorAll('li').forEach((li, i) => {
    setTimeout(() => {
      const fill = li.querySelector('.fill');
      fill.style.width = `calc(${Math.max(2, fill.dataset.w)}% - 8px)`;
      const pct = li.querySelector('.pct');
      countUp(pct, Number(pct.dataset.pct), 450, 0, '%');
      sfx.row(i);
      if (li.classList.contains('yours')) setTimeout(() => replay(li, 'pop'), 450);
    }, REDUCED ? 0 : 250 + i * 110);
  });

  // Points count up in the banner, then fly to the score.
  await wait(350);
  await countUp($('rb-points'), r.points, 500, 0);
  $('rb-points').textContent = `+${r.points}`;
  if (r.rank === 1) {
    sfx.top();
    burst($('rb-tier'), [color, '#ffffff', '#ffd166', '#2ec4b6'], 32, 170);
    replay(document.querySelector('.question-panel'), 'shake-big');
  } else if (r.points > 0) {
    sfx.good();
    burst($('rb-points'), [color, '#ffffff'], 14, 90);
  } else {
    sfx.miss();
    bubbles(banner, 12);
  }
  const before = state.score - r.points;
  if (r.points > 0) {
    await flyPoints($('rb-points'), $('hud-score'), `+${r.points}`);
    sfx.coin();
  }
  replay($('hud-score').parentElement, 'bump');
  countUp($('hud-score'), state.score, 400, before);
  if (!state.answered || state.questions[state.index] !== q) return;
  $('next-btn').focus();
}

function next() {
  state.index++;
  if (state.index >= state.questions.length) return finish();
  renderQuestion();
}

// ---------- end ----------
const cardOf = (q, r) => ({ type: q.type, rank: r.rank, points: r.points, max: q.maxPoints, label: r.yourLabel });

function cardHTML(c, i) {
  const cls = c.rank === 1 ? 'top' : c.rank && c.rank <= 3 ? 'good' : c.points > 0 ? 'ok' : 'miss';
  const rank = c.rank === 1 ? '★1' : c.rank ? `#${c.rank}` : '✕';
  return `<div class="ecard ${c.type} ${cls}" style="--i:${i}" title="${esc(TIER_NAMES[c.type] || '')}: ${esc(c.label || '')}">
    <img class="tier-anim ${c.type}" src="${TIER_ICONS[c.type] || TIER_ICONS.pleco}" alt="">
    <span class="ec-rank">${rank}</span>
    <span class="ec-pts">+${c.points}</span>
  </div>`;
}

function tierSummaryHTML(cards) {
  return Object.keys(TIER_ICONS).map((t) => {
    const mine = cards.filter((c) => c.type === t);
    if (!mine.length) return '';
    const pts = mine.reduce((s, c) => s + c.points, 0);
    const max = mine.reduce((s, c) => s + c.max, 0);
    const firsts = mine.filter((c) => c.rank === 1).length;
    return `<div class="ts ${t}"><img class="tier-anim ${t}" src="${TIER_ICONS[t]}" alt=""><b>${TIER_NAMES[t]}</b><span>${firsts}/${mine.length} #1 · ${pts}/${max}</span></div>`;
  }).join('');
}

async function finish() {
  const max = state.questions.reduce((s, q) => s + q.maxPoints, 0);
  const marks = state.results.map(MARK);
  const cards = state.results.map((r, i) => cardOf(state.questions[i], r));
  const firsts = state.results.filter((r) => r.rank === 1).length;
  $('end-title').textContent = state.mode === 'daily' ? 'DIVE COMPLETE' : 'PRACTICE DONE';
  $('end-day').textContent = state.mode === 'daily' ? `#${state.day}` : state.categoryName;
  $('end-score').textContent = '0';
  $('end-max').textContent = max;
  const pct = state.score / max;
  const title = pct >= 0.8 ? 'School Leader 🐠' : pct >= 0.6 ? 'Part of the School' : pct >= 0.4 ? 'Drifting Along' : 'Lone Bottom-Feeder';
  $('end-rank').textContent = `${title} · ${firsts} #1 answer${firsts === 1 ? '' : 's'}`;
  $('end-tiers').innerHTML = tierSummaryHTML(cards);
  $('end-cards').innerHTML = cards.map(cardHTML).join('');
  $('share-msg').textContent = '';

  const result = { day: state.day, score: state.score, max, marks, cards, mode: state.mode, name: state.categoryName };
  if (state.mode === 'daily') localStorage.setItem(dailyKey(state.day), JSON.stringify(result));
  $('share-btn').onclick = () => copyShare(result, $('share-msg'));
  show('end');

  // Cards flip in one by one, then the score counts up.
  if (!REDUCED) cards.forEach((_, i) => setTimeout(() => sfx.flip(i), i * 90 + 150));
  await wait(cards.length * 90 + 300);
  await countUp($('end-score'), state.score, 900);
  replay($('end-score'), 'bump');
  sfx.finale(pct >= 0.6);
  if (pct >= 0.6) burst($('end-score'), ['#ffd166', '#8fb8ff', '#ff8a5c', '#b892ff', '#ffffff'], 40, 220);
}

async function copyShare(result, msgEl) {
  const head = result.mode === 'practice' ? `Pleco practice: ${result.name}` : `Pleco #${result.day}`;
  const rows = [];
  // One row per Pleco -> Schooler -> Reef -> Deep set.
  for (let i = 0; i < result.marks.length; i += 4) rows.push(result.marks.slice(i, i + 4).join(''));
  // The link at the end makes Discord show the Pleco preview card under the result.
  const text = `${head} 🐟 ${result.score}/${result.max}\n${rows.join('\n')}\n${location.origin}`;
  try {
    await navigator.clipboard.writeText(text);
    msgEl.className = 'msg ok center';
    msgEl.textContent = 'Copied! Paste it anywhere.';
  } catch {
    msgEl.className = 'msg center';
    msgEl.textContent = text;
  }
}

// ---------- wire up ----------
$('guess-form').addEventListener('submit', submitGuess);
$('next-btn').addEventListener('click', next);
$('home-btn').addEventListener('click', renderHome);
$('quit-btn').addEventListener('click', () => {
  if (state.index > 0 && state.mode === 'daily' && !confirm('Leave this dive? Your progress will be lost.')) return;
  renderHome();
});
// Sounds: unlock audio on the first interaction, click on buttons, tick while typing.
const unlock = () => sfx.unlock();
addEventListener('pointerdown', unlock, { once: true });
addEventListener('keydown', unlock, { once: true });
document.addEventListener('click', (e) => {
  const b = e.target.closest('.btn, .cat');
  if (b && b.id !== 'guess-btn' && b.id !== 'mute-btn' && !b.disabled) sfx.click();
}, true);
$('guess-input').addEventListener('input', () => sfx.type());

const muteBtn = $('mute-btn');
const paintMute = () => {
  muteBtn.textContent = sfx.muted ? '🔇' : '🔊';
  muteBtn.title = sfx.muted ? 'Sound off (click to turn on)' : 'Sound on (click to mute)';
  muteBtn.setAttribute('aria-pressed', String(sfx.muted));
};
muteBtn.addEventListener('click', () => { sfx.toggleMute(); paintMute(); });
paintMute();

startSea();
renderHome();
