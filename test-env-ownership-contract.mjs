import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('env setup never depends on a preliminary deploy or matching owner', async () => {
  const source = await read('syfo-webdev/SKILL.md');
  const env = source.split('## Website environment variables')[1].split('## Existing unified')[0];
  assert.match(env, /Developer Agent may save dev or prod variables/);
  assert.match(env, /before\nhuman ownership is established/);
  assert.match(env, /Prod reads remain masked/);
  assert.match(env, /Older servers may still require/);
  assert.doesNotMatch(env, /only when.*owned by|Owner-owned developer Agents may set/);
  assert.match(env, /references\/ownership-and-permissions\.md/);
});

test('owner-dependent actions route to explicit human claim and keep separate authority', async () => {
  const source = await read('syfo-webdev/references/ownership-and-permissions.md');
  assert.match(source, /syfo app claim <app-id> --target "<reply-target>" --json/);
  assert.match(source, /does not assign ownership by itself/);
  assert.match(source, /Claiming for an unrelated human does\nnot make the current Agent that Owner's Agent/);
  assert.match(source, /an immutable source commit alone does not pin all environment settings/);
  assert.match(source, /independent claim cards are separate action-card records/);
  const evals = JSON.parse(await read('syfo-webdev/evals/evals.json')).evals;
  for (const id of [20, 21, 22, 23]) assert.ok(evals.some((entry) => entry.id === id));
});
