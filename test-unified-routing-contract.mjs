import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const unified = await readFile(new URL('./syfo-webdev/SKILL.md', import.meta.url), 'utf8');
const staticSkill = await readFile(new URL('./syfo-webdev-static/SKILL.md', import.meta.url), 'utf8');
const fullstackSkill = await readFile(new URL('./syfo-webdev-fullstack/SKILL.md', import.meta.url), 'utf8');

test('unified create contract accepts only frozen pairs', () => {
  assert.match(unified, /--template unified --preset site --from-template --clone <dir>/);
  assert.match(unified, /--template unified --preset app --confirm-tidb --from-template --clone <dir>/);
  assert.doesNotMatch(unified, /syfo app init[^\n]*--preset site[^\n]*--confirm-tidb/);
  assert.doesNotMatch(unified, /syfo app init[^\n]*--database/);
  assert.match(unified, /daemon sends the complete Core pair `site\/none`/);
  assert.match(unified, /daemon sends the complete Core pair `app\/tidb`/);
  assert.match(unified, /Do not expose or pass `--database`, infer a preset from prose/);
  assert.match(unified, /Only after that confirmation may the exact command include `--confirm-tidb`/);
  assert.match(unified, /Never pass `--confirm-tidb` for `preset=site` or before the App\/TiDB confirmation/);
});

test('legacy aliases preserve flow and require explicit upgrade consent', () => {
  for (const source of [staticSkill, fullstackSkill]) {
    assert.match(source, /legacy compatibility/i);
    assert.match(source, /Preserve the old/);
    assert.match(source, /separate explicit human authorization|separate human consent/);
  }
  assert.match(unified, /Detection is read-only\. A classification result is not migration consent/);
  assert.match(unified, /Never infer `none -> tidb`/);
  assert.match(unified, /only Skill for creating any new Syfo website or Hosted App/i);
  assert.match(unified, /compatibility aliases for historical Apps only/);
  assert.match(staticSkill, /Do not use for any new website or App/);
  assert.match(fullstackSkill, /Do not use for any new website or App/);
});

test('uncertain Syfo requests ask before choosing a template or mutating', () => {
  assert.match(unified, /If the request says only “new Syfo website\/App”.*ask/s);
  assert.match(unified, /`unknown`.*Ask the minimum focused question/s);
  assert.match(unified, /do not choose a template, initialize, migrate, enable a database, or deploy meanwhile/);
});

test('trigger matrix covers unified, legacy, ambiguous, and no-consent database request', async () => {
  const triggers = JSON.parse(await readFile(new URL('./syfo-webdev/evals/trigger-evals.json', import.meta.url), 'utf8'));
  const cases = [
    [/unified site/, true],
    [/unified app preset/, true],
    [/旧 web-static App/, false],
    [/旧 web-fullstack App/, false],
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
