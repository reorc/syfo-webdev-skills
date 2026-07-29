import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const templates = [
  'syfo-webdev-fullstack/assets/syfo-auth/src/_core/env.ts',
];

for (const template of templates) {
  test(`${template} reads the daemon-injected runtime contract only`, async () => {
    const source = await readFile(new URL(template, import.meta.url), 'utf8');
    for (const name of [
      'DATABASE_URL',
      'BUILT_IN_FORGE_API_URL',
      'BUILT_IN_FORGE_API_KEY',
      'VITE_FRONTEND_FORGE_API_KEY',
      'JWT_SECRET',
    ]) {
      assert.match(source, new RegExp(`process\\.env\\.${name}`));
    }
    assert.doesNotMatch(source, /fetch\s*\(/);
    assert.doesNotMatch(source, /writeFile|dotenv/);
  });
}
