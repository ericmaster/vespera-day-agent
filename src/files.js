// File reads go through here so the Cloudflare Worker build can serve bundled copies
// (globalThis.__VDA_FILES, keyed by repo-relative path); Node reads from disk.
import { readFileSync } from 'node:fs';
export const readText = (p) => globalThis.__VDA_FILES?.[p] ?? readFileSync(p, 'utf8');
