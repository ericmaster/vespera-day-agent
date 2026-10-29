import { readFileSync, existsSync } from 'node:fs';
// Tiny .env loader (no dependency). Never logs values.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
export const DEFAULTS = { baseUrl: 'https://api.meta.ai/v1', model: 'muse-spark-1.3' };
// Provider is swappable via env: any OpenAI-compatible /chat/completions endpoint works.
// MODEL_BASE_URL / MODEL_NAME (legacy MODEL_API_BASE / MUSE_MODEL still honored). Defaults = Meta Muse Spark.
export function resolveModelConfig(env = process.env) {
  const key = env.MODEL_API_KEY;
  return {
    apiKey: key && key !== 'replace-me' ? key : null,
    baseUrl: (env.MODEL_BASE_URL || env.MODEL_API_BASE || DEFAULTS.baseUrl).replace(/\/+$/, ''),
    model: env.MODEL_NAME || env.MUSE_MODEL || DEFAULTS.model,
  };
}
export const config = {
  ...resolveModelConfig(),
  port: Number(process.env.PORT || 3000),
  workingHours: { start: '09:00', end: '18:00' },
  timezone: 'America/Bogota',
};
