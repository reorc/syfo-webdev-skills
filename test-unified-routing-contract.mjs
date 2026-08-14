import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const unified = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const staticSkill = await readFile(new URL('./syfo-webdev-static/SKILL.md', import.meta.url), 'utf8');
const fullstackSkill = await readFile(new URL('./syfo-webdev-fullstack/SKILL.md', import.meta.url), 'utf8');

test('unified create contract accepts only frozen pairs', () => {
  assert.match(unified, /--template unified --preset site --database none/);
  assert.match(unified, /--template unified --preset app --database tidb/);
  assert.match(unified, /Do not omit fields, infer a pair from prose, coerce crossed pairs/);
});

test('legacy aliases preserve flow and require explicit upgrade consent', () => {
  for (const source of [staticSkill, fullstackSkill]) {
    assert.match(source, /legacy compatibility/i);
    assert.match(source, /Preserve the old/);
    assert.match(source, /separate explicit human authorization|separate human consent/);
  }
  assert.match(unified, /Detection is read-only\. A classification result is not migration consent/);
  assert.match(unified, /Never infer `none -> tidb`/);
});

test('trigger matrix covers unified, legacy, ambiguous, and no-consent database request', async () => {
  const triggers = JSON.parse(await readFile(new URL('./syfo-webdev/evals/trigger-evals.json', import.meta.url), 'utf8'));
  const cases = [
    [/unified site/, true],
    [/unified app preset/, true],
    [/web-static/, false],
    [/fullstack 模板/, false],
    [/markers 冲突/, true],
    [/还没授权迁移或启用 TiDB/, true],
  ];
  for (const [pattern, expected] of cases) {
    assert.ok(
      triggers.some(({ query, should_trigger }) => should_trigger === expected && pattern.test(query)),
      `missing trigger case ${pattern} => ${expected}`,
    );
  }
  assert.match(unified, /Ambiguous.*Stop and ask/s);
  assert.match(unified, /Feature requirements are not treated as migration consent|Requests such as “add login,”/);
});
