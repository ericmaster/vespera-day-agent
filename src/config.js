import { readFileSync, existsSync } from 'node:fs';
// Tiny .env loader (no dependency). Never logs values.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
export const config = {
  apiKey: process.env.MODEL_API_KEY && process.env.MODEL_API_KEY !== 'replace-me' ? process.env.MODEL_API_KEY : null,
  baseUrl: process.env.MODEL_API_BASE || 'https://api.meta.ai/v1',
  model: process.env.MUSE_MODEL || 'muse-spark-1.3',
  port: Number(process.env.PORT || 3000),
  workingHours: { start: '09:00', end: '18:00' },
  timezone: 'America/Bogota',
};
