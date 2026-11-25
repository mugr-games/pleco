// Renders tools/og-card.html to public/og-image.png (1200x630) with a headless Edge or Chrome.
// Usage: node tools/render-og.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browser = candidates.find((p) => existsSync(p));
if (!browser) throw new Error('No Edge/Chrome found. Set BROWSER=path/to/browser');

const out = path.join(ROOT, 'public', 'og-image.png');
execFileSync(browser, [
  '--headless=new',
  `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'pleco-og-'))}`, // separate profile so a running browser doesn't swallow the job
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--virtual-time-budget=5000', // give the web fonts time to load
  `--window-size=1200,630`,
  `--screenshot=${out}`,
  pathToFileURL(path.join(ROOT, 'tools', 'og-card.html')).href,
], { stdio: 'inherit' });
console.log('Wrote', out);
