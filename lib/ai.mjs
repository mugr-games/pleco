// NVIDIA-hosted model access (OpenAI-compatible chat completions endpoint).
// The API key is read from the NVIDIA_API_KEY environment variable and never sent to the browser.
import { execSync } from 'node:child_process';

const ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Fast model for live guess matching, smart model for writing/reviewing questions.
export const FAST_MODEL = process.env.PLECO_FAST_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b';
export const SMART_MODEL = process.env.PLECO_SMART_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b';

let cachedKey;
export function getKey() {
  if (cachedKey !== undefined) return cachedKey;
  let key = process.env.NVIDIA_API_KEY || '';
  // On Windows, `setx` only affects new processes; fall back to reading the user variable directly.
  if (!key && process.platform === 'win32') {
    try {
      key = execSync(
        `powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('NVIDIA_API_KEY','User')"`,
        { stdio: ['ignore', 'pipe', 'ignore'] }
      ).toString().trim();
    } catch { key = ''; }
  }
  cachedKey = key;
  return key;
}

export function hasKey() { return Boolean(getKey()); }

export class AIError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

/** Send a chat request and return the assistant's text content. */
export async function chat({ model, system, user, maxTokens = 1024, temperature = 0.2, thinking = false, timeoutMs = 60000, schema }) {
  const key = getKey();
  if (!key) throw new AIError('NVIDIA_API_KEY is not set', 0);
  const body = {
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
    temperature,
    chat_template_kwargs: { enable_thinking: thinking },
  };
  // Constrained decoding: the model can only produce JSON matching this schema.
  if (schema) body.response_format = { type: 'json_schema', json_schema: { name: 'output', schema, strict: true } };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AIError(`NVIDIA API ${res.status}: ${text.slice(0, 200)}`, res.status);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new AIError('Model returned no content', res.status);
  }
  return content;
}

/** Pull the first JSON object/array out of model text (handles ```json fences and chatter). */
export function extractJSON(text, kind = 'any') {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const opens = kind === 'array' ? ['['] : kind === 'object' ? ['{'] : ['[', '{'];
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (opens.includes(cleaned[i])) { start = i; break; }
  }
  if (start < 0) throw new Error('No JSON found in model output');
  const close = cleaned[start] === '[' ? ']' : '}';
  const end = cleaned.lastIndexOf(close);
  if (end <= start) throw new Error('Unterminated JSON in model output');
  return JSON.parse(cleaned.slice(start, end + 1));
}
