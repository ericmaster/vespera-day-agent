// Cloudflare Worker entry for the hosted demo. One Durable Object instance holds the demo state
// (grants, proposals, simulated clock) so every request sees the same in-memory app, as with node:http.
// Fixtures and the UI are bundled as text modules; the model key is a Worker secret (MODEL_API_KEY).
import { DurableObject } from 'cloudflare:workers';
import day from '../fixtures/day.json';
import calendar from '../fixtures/calendar.json';
import chat from '../fixtures/chat.json';
import emails from '../fixtures/emails.json';
import github from '../fixtures/github.json';
import githubLive from '../fixtures/github-live-sample.json';
import repo from '../fixtures/repo.json';
import tasks from '../fixtures/tasks.json';
import attention from '../fixtures/attention.json';
import ramblings from '../fixtures/ramblings.txt';
import agentSession from '../fixtures/agent-session.md';
import indexHtml from '../public/index.html';
import widgetHtml from '../public/widget.html';

globalThis.__VDA_FILES = {
  'fixtures/day.json': day, 'fixtures/calendar.json': calendar, 'fixtures/chat.json': chat, 'fixtures/emails.json': emails,
  'fixtures/github.json': github, 'fixtures/github-live-sample.json': githubLive, 'fixtures/repo.json': repo,
  'fixtures/tasks.json': tasks, 'fixtures/attention.json': attention, 'fixtures/ramblings.txt': ramblings, 'fixtures/agent-session.md': agentSession,
  'public/index.html': indexHtml, 'public/widget.html': widgetHtml,
};

export class DemoApp extends DurableObject {
  async fetch(request) {
    const { handle, audit } = await import('../src/app.js'); // after __VDA_FILES and process.env are ready
    // Decision record lives in this Durable Object's storage: one key per record, append-only.
    if (!this.auditLoaded) {
      const m = await this.ctx.storage.list({ prefix: 'audit:' });
      audit.load([...m.values()]);
      audit.sink = (r, i) => { this.ctx.storage.put(`audit:${String(i).padStart(9, '0')}`, r); };
      this.auditLoaded = true;
    }
    const url = new URL(request.url);
    const out = await handle({
      method: request.method, url: url.pathname + url.search, headers: request.headers,
      ip: request.headers.get('cf-connecting-ip') || 'unknown',
      raw: async () => new Uint8Array(await request.arrayBuffer()),
    });
    return new Response(out.body, { status: out.code, headers: { 'Content-Type': out.type } });
  }
}

export default {
  fetch(request, env) {
    return env.DEMO.get(env.DEMO.idFromName('public-demo')).fetch(request);
  },
};
