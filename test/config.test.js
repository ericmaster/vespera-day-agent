import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveModelConfig, DEFAULTS } from '../src/config.js';

test('defaults to Meta Muse Spark when env is empty', () => {
  assert.deepEqual(resolveModelConfig({}), { apiKey: null, baseUrl: DEFAULTS.baseUrl, model: DEFAULTS.model });
  assert.equal(DEFAULTS.model, 'muse-spark-1.3');
  assert.equal(resolveModelConfig({ MODEL_API_KEY: 'replace-me' }).apiKey, null);
});

test('new env vars override, legacy vars still honored, trailing slash trimmed', () => {
  const c = resolveModelConfig({ MODEL_BASE_URL: 'https://gw.example/v1/', MODEL_NAME: 'other', MODEL_API_KEY: 'k', MODEL_API_BASE: 'x', MUSE_MODEL: 'y' });
  assert.deepEqual(c, { apiKey: 'k', baseUrl: 'https://gw.example/v1', model: 'other' });
  assert.equal(resolveModelConfig({ MODEL_API_BASE: 'https://legacy', MUSE_MODEL: 'm' }).model, 'm');
});
