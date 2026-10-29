// Muse Voice Transcribe: POST /v1/asr/transcribe (multipart: request JSON + WAV audio).
// Audio must be mono 16-bit PCM WAV at 16 or 24 kHz; the browser converts before upload.
import { config } from './config.js';

export async function transcribeWav(wavBuffer) {
  if (!config.apiKey) throw new Error('MODEL_API_KEY not set: paste a transcript instead');
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify({ model: 'muse-voice-transcribe-1.0', audioEncoding: 'WAV', mode: 'PUSH_TO_TALK' })], { type: 'application/json' }));
  form.append('audio', new Blob([wavBuffer], { type: 'audio/wav' }), 'note.wav');
  const r = await fetch(`${config.baseUrl}/asr/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, Accept: 'application/json' }, body: form });
  if (!r.ok) throw new Error(`Transcribe API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).transcript || '';
}

export function addNote(state, text, origin) {
  const t = String(text || '').trim();
  if (!t) throw new Error('empty note');
  const note = { id: `voice-${state.notes.length}`, source_id: 'notes:ramblings', title: t.slice(0, 50), ts: new Date().toISOString(), text: t, origin };
  state.notes.push(note);
  return note;
}
