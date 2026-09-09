import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const skill = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const lifecycle = await readFile(
  new URL('./syfo-webdev/references/deployment-lifecycle.md', import.meta.url),
  'utf8',
);

test('webdev never exposes the internal Syfo website repository as an artifact', () => {
  assert.match(skill, /Never declare a `gitlab\.syfo\.ai` source URL as an artifact/);
  assert.match(skill, /declare the deployed website\/App result instead/);
  assert.match(skill, /never a `gitlab\.syfo\.ai`[\s\S]*declared through `syfo artifact`/);
  assert.match(lifecycle, /parsed hostname is exactly `gitlab\.syfo\.ai`/);
  assert.match(lifecycle, /Never declare any URL[\s\S]*through `syfo artifact declare`/);
  assert.match(lifecycle, /Do not evade this boundary with URL shorteners/);
});
