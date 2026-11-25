# Pleco

A daily survey game for middle and high school students: guess the answer **most people** would give.

Each daily dive has 16 questions: 4 from each rarity tier, in the order Pleco → Schooler → Reef → Deep, four times over.

| Tier | Icon | Rarity | Top answer share | Max points |
|---|---|---|---|---|
| **Pleco** | pleco | common | 55–85% | 100 |
| **Schooler** | school of fish | uncommon | 42–55% | 125 |
| **Reef** | spider crab | rare | 28–42% | 150 |
| **Deep** | anglerfish | epic | 15–28% | 175 |

The icons are in `public/tiers/`. The server sorts each question into a tier by its top answer share (`tierFor` in `lib/text.mjs`).

## Run it

```powershell
node server.mjs
```

Then open http://localhost:8140.

The server reads your NVIDIA key from the `NVIDIA_API_KEY` environment variable. It never sends the key to the browser.

## Questions

```powershell
node tools/generate.mjs --workers 10
```

- This writes about 10,000 questions: 20 categories × 25 subtopics × about 20 each.
- Output goes to `data/generated/<category>.jsonl`.
- It resumes if stopped, and the running server picks up new questions every 30 s.
- Writer and reviewer: `nvidia/nemotron-3-ultra-550b-a55b`.
- Live guess judge: `nvidia/nemotron-3.5-lightning-30b-a3b` with thinking off, about 0.3 s per guess.
- To change models, set `PLECO_SMART_MODEL` or `PLECO_FAST_MODEL`.

## Deploy on Render

1. Push this folder to a GitHub repository. A private repository is fine.
2. In Render, go to **New + → Blueprint** and pick the repository. Render reads `render.yaml`.
3. When Render asks for `NVIDIA_API_KEY`, paste your key there. Never put it in the code.

On the free plan:
- The server sleeps after 15 minutes without visitors, and the first visit after that takes about a minute to wake it.
- The crowd tallies reset on every deploy or restart. To keep them, add a persistent disk (a paid plan); `render.yaml` shows how.
- To add newly generated questions, commit `data/generated/` and push. Render redeploys automatically.

## How scoring works

- Each question starts with AI-estimated answer shares, counted as 50 "virtual" players.
- Every real answer joins the crowd, so the board shifts toward what players actually say.
- Points are based on how popular your answer was before you answered. Matching #1 gives full points: Pleco 100, Schooler 125, Reef 150, Deep 175.
- Crowd tallies live in `data/tallies.json`.
